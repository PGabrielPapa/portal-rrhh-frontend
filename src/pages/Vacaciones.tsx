import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import EmpleadoPicker from '../components/EmpleadoPicker';
import type { Empleado } from '../lib/types';

interface Saldo { empleadoId: number; nom: string; legNum: string; empresa: string; antiguedad: number; corresponden: number; tomadas: number; saldo: number }
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
          <div className="row" style={{ marginBottom: 8 }}><span className="muted" style={{ flex: 1 }}>Días por antigüedad (LCT art. 150): &lt;5a 14 · 5–10a 21 · 10–20a 28 · +20a 35.</span><button className="btn ghost" onClick={exportar}>⬇ Excel</button></div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg2)' }}>{['Leg.', 'Empleado', 'Antig.', 'Corresponden', 'Tomadas', 'Saldo'].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: i < 2 ? 'left' : 'right', borderBottom: '2px solid var(--border)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {saldos.map((s) => (
                <tr key={s.empleadoId}>
                  <td style={{ padding: '4px 8px' }}>{s.legNum}</td><td style={{ padding: '4px 8px' }}>{s.nom}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{s.antiguedad}a</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{s.corresponden}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{s.tomadas}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: s.saldo < 0 ? '#b91c1c' : s.saldo === 0 ? undefined : '#15803d' }}>{s.saldo}</td>
                </tr>
              ))}
              {!saldos.length && <tr><td colSpan={6} className="muted" style={{ padding: 10 }}>Sin empleados activos.</td></tr>}
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
