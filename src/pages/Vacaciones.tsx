import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import EmpleadoPicker from '../components/EmpleadoPicker';
import type { Empleado } from '../lib/types';

interface Saldo { empleadoId: number; nom: string; legNum: string; empresa: string; antiguedad: number; saldoInicial: number; corresponden: number; tomadas: number; saldo: number }
interface Vac { id: number; empleadoId: number; nom: string; legNum: string; anio: number; desde?: string; hasta?: string; dias: number; estado: string; obs?: string }
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };

export default function Vacaciones() {
  const [tab, setTab] = useState<'saldos' | 'registros'>('saldos');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [regs, setRegs] = useState<Vac[]>([]);
  const [emp, setEmp] = useState<Empleado | null>(null);
  const [form, setForm] = useState<{ desde: string; hasta: string; dias: string; estado: string; obs: string }>({ desde: '', hasta: '', dias: '', estado: 'programada', obs: '' });
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [importando, setImportando] = useState(false);
  const [noMatch, setNoMatch] = useState<{ legNum: string; empresa: string; dias: number }[]>([]);

  async function load() {
    try {
      setSaldos((await api.get<{ filas: Saldo[] }>(`/vacaciones/saldos?anio=${anio}`)).filas);
      setRegs(await api.get<Vac[]>(`/vacaciones?anio=${anio}`));
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [anio]);

  async function guardar() {
    if (!emp) { setMsg({ t: 'Elegí un empleado', ok: false }); return; }
    try { await api.post('/vacaciones', { empleadoId: emp.id, anio, ...form, dias: form.dias ? Number(form.dias) : undefined }); setMsg({ t: 'Vacaciones registradas', ok: true }); setForm({ desde: '', hasta: '', dias: '', estado: 'programada', obs: '' }); setEmp(null); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(v: Vac) { if (!confirm(`¿Eliminar las vacaciones de ${v.nom}?`)) return; try { await api.del(`/vacaciones/${v.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  function exportar() {
    const ws = XLSX.utils.json_to_sheet(saldos.map((s) => ({ Legajo: s.legNum, Empleado: s.nom, Empresa: s.empresa, Antigüedad: s.antiguedad, Corresponden: s.corresponden, Tomadas: s.tomadas, Saldo: s.saldo })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Saldos vacaciones'); XLSX.writeFile(wb, `vacaciones_saldos_${anio}.xlsx`);
  }

  // Importa el saldo inicial (arrastre histórico) desde la PRIMERA hoja del Excel.
  // Busca las columnas por su encabezado: legajo, empresa y "días pendientes".
  async function importarSaldos(file: File) {
    setImportando(true); setMsg(null); setNoMatch([]);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // defval:'' evita "huecos" (undefined) en las celdas vacías, que rompían el .includes.
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
      const norm = (s: any) => String(s ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
      const hi = aoa.findIndex((r) => Array.isArray(r) && r.some((c) => norm(c) === 'LEGAJO'));
      if (hi < 0) throw new Error('No encontré la fila de encabezados (columna LEGAJO) en la primera hoja.');
      const head = (aoa[hi] || []).map(norm);
      const idxLeg = head.findIndex((h) => h === 'LEGAJO');
      const idxEmp = head.findIndex((h) => h.includes('EMPRESA'));
      const idxPen = head.findIndex((h) => h.includes('PENDIENTE'));
      if (idxPen < 0) throw new Error('No encontré la columna de DÍAS PENDIENTES.');
      const filas: { legNum: string; empresa: string; dias: number }[] = [];
      for (const r of aoa.slice(hi + 1)) {
        const leg = r[idxLeg]; if (leg === undefined || leg === null || String(leg).trim() === '') continue;
        const dias = Number(r[idxPen]);
        filas.push({ legNum: String(leg).trim(), empresa: idxEmp >= 0 ? String(r[idxEmp] ?? '').trim() : '', dias: isNaN(dias) ? 0 : dias });
      }
      if (!filas.length) throw new Error('No encontré filas con datos debajo del encabezado.');
      const res = await api.post<{ actualizados: number; noEncontrados: typeof filas }>('/vacaciones/saldo-inicial/import', { filas });
      setNoMatch(res.noEncontrados || []);
      setMsg({ t: `Saldos iniciales cargados: ${res.actualizados} de ${filas.length}.${res.noEncontrados?.length ? ` ${res.noEncontrados.length} sin coincidencia (ver abajo).` : ''}`, ok: true });
      load();
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
    finally { setImportando(false); }
  }

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
        <button className={tab === 'saldos' ? 'btn' : 'btn ghost'} onClick={() => setTab('saldos')}>Saldos</button>
        <button className={tab === 'registros' ? 'btn' : 'btn ghost'} onClick={() => setTab('registros')}>Registrar / historial</button>
        <div className="field" style={{ marginLeft: 'auto' }}><label>Año</label><input className="input" style={{ width: 100 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
      </div>
      {msg && <p className={msg.ok ? 'ok' : 'err'}>{msg.t}</p>}

      {tab === 'saldos' ? (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="row" style={{ marginBottom: 8, alignItems: 'center' }}>
            <span className="muted" style={{ flex: 1 }}>Días por antigüedad (LCT art. 150): &lt;5a 14 · 5–10a 21 · 10–20a 28 · +20a 35. El saldo suma el pendiente anterior.</span>
            <label className="btn ghost" style={{ cursor: 'pointer', margin: 0 }}>
              {importando ? 'Importando…' : '⬆ Importar pendientes'}
              <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} disabled={importando}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importarSaldos(f); e.target.value = ''; }} />
            </label>
            <button className="btn ghost" onClick={exportar}>⬇ Excel</button>
          </div>
          {noMatch.length > 0 && (
            <div className="card" style={{ background: 'var(--bg2)', marginBottom: 8, padding: 8, fontSize: 12 }}>
              <strong>No se pudieron vincular {noMatch.length} fila(s)</strong> (legajo/empresa sin coincidencia en el sistema):
              <div style={{ marginTop: 4 }}>{noMatch.map((n, i) => <span key={i} style={{ marginRight: 10 }}>• {n.legNum} {n.empresa} ({n.dias}d)</span>)}</div>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg2)' }}>{['Leg.', 'Empleado', 'Antig.', 'Pendiente ant.', 'Corresponden', 'Tomadas', 'Saldo'].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: i < 2 ? 'left' : 'right', borderBottom: '2px solid var(--border)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {saldos.map((s) => (
                <tr key={s.empleadoId}>
                  <td style={{ padding: '4px 8px' }}>{s.legNum}</td><td style={{ padding: '4px 8px' }}>{s.nom}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{s.antiguedad}a</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{s.saldoInicial || 0}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{s.corresponden}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{s.tomadas}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: s.saldo < 0 ? '#b91c1c' : s.saldo === 0 ? undefined : '#15803d' }}>{s.saldo}</td>
                </tr>
              ))}
              {!saldos.length && <tr><td colSpan={7} className="muted" style={{ padding: 10 }}>Sin empleados activos.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="grid2">
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Empleado</label><EmpleadoPicker onSelect={setEmp} /></div>
              <div className="field"><label>Desde</label><input className="input" type="date" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} /></div>
              <div className="field"><label>Hasta</label><input className="input" type="date" value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} /></div>
              <div className="field"><label>Días (opcional, si no se calcula por fechas)</label><input className="input" type="number" value={form.dias} onChange={(e) => setForm({ ...form, dias: e.target.value })} /></div>
              <div className="field"><label>Estado</label><select className="input" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}><option value="programada">Programada</option><option value="aprobada">Aprobada</option><option value="gozada">Gozada</option></select></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Observaciones</label><input className="input" value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} /></div>
            </div>
            <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={guardar}>Registrar vacaciones</button></div>
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--bg2)' }}>{['Empleado', 'Desde', 'Hasta', 'Días', 'Estado', ''].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {regs.map((v) => (
                  <tr key={v.id}><td style={{ padding: '4px 8px' }}>{v.nom} <span className="muted">· {v.legNum}</span></td><td style={{ padding: '4px 8px' }}>{fmt(v.desde)}</td><td style={{ padding: '4px 8px' }}>{fmt(v.hasta)}</td><td style={{ padding: '4px 8px' }}>{v.dias}</td><td style={{ padding: '4px 8px' }}>{v.estado}</td><td style={{ padding: '4px 8px' }}><button className="btn danger" onClick={() => borrar(v)}>Eliminar</button></td></tr>
                ))}
                {!regs.length && <tr><td colSpan={6} className="muted" style={{ padding: 10 }}>Sin registros de vacaciones para {anio}.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
