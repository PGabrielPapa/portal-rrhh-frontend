import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const $ = (n: any) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Contrato = { id: number; obra?: string; especialidad?: string; monto: number; fecha_fin?: string };
type Ajuste = { id: number; concepto: string; monto: number };
type Calc = {
  empleado: { id: number; nom: string; legNum: number; cat: string };
  periodo: { anio: number; mes: number; quincena: number; desde: string; hasta: string };
  cantidades: { diasNormales: number; hsSemana: number; hsSabado: number; hsDomingo: number; hsFeriado: number };
  sugeridas: { diasNormales: number; hsSemana: number; hsSabado: number; hsDomingo: number; hsFeriado: number };
  contratos: Contrato[]; ajustes: Ajuste[];
  valorHora: number; jornal: number; basico: number; extraSemana: number; sabado: number; domingo: number; feriado: number;
  bono: number; retro: number; sac: number; difAnterior: number; ajustesTotal: number; contratosTotal: number;
  totalSinContrato: number; totalConContrato: number;
};

// ───────────── Liquidar por producción ─────────────
function Liquidar() {
  const [q, setQ] = useState(''); const [matches, setMatches] = useState<Empleado[]>([]); const [sel, setSel] = useState<Empleado | null>(null);
  const [empresa, setEmpresa] = useState(''); const [empresas, setEmpresas] = useState<string[]>([]);
  const [mes, setMes] = useState(new Date().getMonth() + 1); const [anio, setAnio] = useState(new Date().getFullYear()); const [quincena, setQuincena] = useState(1);
  const [ov, setOv] = useState<Record<string, string>>({});   // overrides de cantidades y extras (editable)
  const [calc, setCalc] = useState<Calc | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  // altas de contrato / ajuste
  const [nc, setNc] = useState<Record<string, string>>({}); const [na, setNa] = useState<Record<string, string>>({});

  useEffect(() => { api.get<Empleado[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {}); }, []);

  async function buscar(v: string) { setQ(v); setSel(null); if (v.trim().length < 2) { setMatches([]); return; } try { const qs = `/empleados?q=${encodeURIComponent(v)}${empresa ? `&empresa=${encodeURIComponent(empresa)}` : ''}`; setMatches((await api.get<Empleado[]>(qs)).slice(0, 8)); } catch { /* */ } }
  function elegir(e: Empleado) { setSel(e); setQ(`${e.nom} (${e.legNum})`); setMatches([]); setCalc(null); setOv({}); setMsg(''); }

  function bodyOver() {
    const b: any = {};
    const map: [string, string][] = [['diasNormales', 'diasNormales'], ['hsSemana', 'hsSemana'], ['hsSabado', 'hsSabado'], ['hsDomingo', 'hsDomingo'], ['hsFeriado', 'hsFeriado'], ['bono', 'bono'], ['retro', 'retro'], ['sac', 'sac'], ['difAnterior', 'difAnterior'], ['valorHora', 'valorHora']];
    for (const [k, f] of map) if (ov[f] !== undefined && String(ov[f]).trim() !== '') b[k] = Number(ov[f]);
    return b;
  }
  async function calcular(useOverrides = false) {
    if (!sel) return; setErr(''); setMsg(''); setBusy(true);
    try {
      const body: any = { empleadoId: sel.id, anio, mes, quincena, ...(useOverrides ? bodyOver() : {}) };
      const r = await api.post<Calc>('/produccion/calcular', body);
      setCalc(r);
      if (!useOverrides) setOv({}); // primera corrida: mostrar cantidades sugeridas por fichadas
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  // valor mostrado en el input: override si existe, sino el de la última corrida
  const val = (f: keyof Calc['cantidades'] | 'bono' | 'retro' | 'sac' | 'difAnterior' | 'valorHora') =>
    ov[f] !== undefined ? ov[f] : (calc ? String((calc as any)[f] ?? (calc.cantidades as any)[f] ?? '') : '');

  async function addContrato() {
    if (!sel) return; if (!nc.monto) return;
    setBusy(true); setErr('');
    try {
      await api.post('/produccion/contratos', { empleadoId: sel.id, anio, mes, quincena, obra: nc.obra, especialidad: nc.especialidad, monto: Number(nc.monto), fechaFin: nc.fechaFin || undefined, nota: nc.nota });
      setNc({}); await calcular(true);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function delContrato(id: number) { setBusy(true); try { await api.del(`/produccion/contratos/${id}`); await calcular(true); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }
  async function addAjuste() {
    if (!sel) return; if (!na.concepto || !na.monto) return;
    setBusy(true); setErr('');
    try { await api.post('/produccion/ajustes', { empleadoId: sel.id, anio, mes, quincena, concepto: na.concepto, monto: Number(na.monto) }); setNa({}); await calcular(true); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function delAjuste(id: number) { setBusy(true); try { await api.del(`/produccion/ajustes/${id}`); await calcular(true); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }

  async function importContratos(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    setBusy(true); setErr(''); setMsg('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      // busca una hoja llamada "Contratos" o usa la primera
      const shName = wb.SheetNames.find((n: string) => /contrat/i.test(n)) || wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[shName], { defval: '', raw: false });
      const res = await api.post<{ importados: number; sinMatch: string[] }>('/produccion/contratos/import', { rows, anio, mes, quincena });
      const sm = res.sinMatch?.length ? ` · ${res.sinMatch.length} sin match` : '';
      setMsg(`Contratos importados: ${res.importados}${sm}.`);
      if (sel) await calcular(true);
    } catch (er: any) { setErr('No se pudo importar: ' + er.message); } finally { setBusy(false); }
  }

  const numField = (label: string, f: any, sug?: number) => (
    <div className="field">
      <label>{label}{sug !== undefined && <span className="muted" style={{ fontWeight: 400 }}> · fichadas: {sug}</span>}</label>
      <input className="input" type="number" step="any" value={val(f)} onChange={(ev) => setOv({ ...ov, [f]: ev.target.value })} style={{ width: 130 }} />
    </div>
  );

  return (
    <>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="field" style={{ marginBottom: 12, maxWidth: 360 }}>
          <label>Empresa</label>
          <select className="input" value={empresa} onChange={(e) => { setEmpresa(e.target.value); setSel(null); setMatches([]); setQ(''); }}>
            <option value="">Todas las empresas</option>
            {empresas.map((em) => <option key={em} value={em}>{em}</option>)}
          </select>
        </div>
        <div className="field" style={{ position: 'relative', marginBottom: 12 }}>
          <label>Empleado</label>
          <input className="input" placeholder="Buscar por nombre, legajo o DNI…" value={q} onChange={(e) => buscar(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && matches.length) { e.preventDefault(); elegir(matches[0]); } }} />
          {matches.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 240, overflow: 'auto' }}>
              {matches.map((e) => <div key={e.id} onClick={() => elegir(e)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{e.nom} <span className="muted">· {e.legNum} · {e.empresa}</span></div>)}
            </div>
          )}
        </div>
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
          <div className="field"><label>Año</label><input className="input" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 100 }} /></div>
          <div className="field"><label>Quincena</label><select className="input" value={quincena} onChange={(e) => setQuincena(Number(e.target.value))}><option value={1}>1ª (1–15)</option><option value={2}>2ª (16–fin)</option></select></div>
          <button className="btn" disabled={!sel || busy} onClick={() => calcular(false)}>Traer de fichadas</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Valor hora ya incluye presentismo. Esta liquidación es bruto = neto: <b>no descuenta aportes ni contribuciones</b>.</div>
        {err && <div className="alert error" style={{ marginTop: 10 }}>{err}</div>}
        {msg && <div className="alert ok" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      {calc && (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>{calc.empleado.nom} <span className="muted">· leg. {calc.empleado.legNum} · {calc.empleado.cat || 's/categoría'}</span></h3>
              <div className="muted" style={{ fontSize: 12 }}>Período {calc.periodo.desde} → {calc.periodo.hasta} · Valor jornal ({$(calc.jornal)})</div>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {numField('Valor hora', 'valorHora')}
              {numField('Días normales', 'diasNormales', calc.sugeridas.diasNormales)}
              {numField('Hs extra semana', 'hsSemana', calc.sugeridas.hsSemana)}
              {numField('Hs sábado', 'hsSabado', calc.sugeridas.hsSabado)}
              {numField('Hs domingo', 'hsDomingo', calc.sugeridas.hsDomingo)}
              {numField('Hs feriado', 'hsFeriado', calc.sugeridas.hsFeriado)}
            </div>
            <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 6 }}>
              {numField('Bono', 'bono')}
              {numField('Retroactivo', 'retro')}
              {numField('SAC', 'sac')}
              {numField('Dif. liq. anterior', 'difAnterior')}
              <button className="btn" disabled={busy} onClick={() => calcular(true)}>Recalcular</button>
            </div>
          </div>

          <div className="grid2" style={{ gap: 18, alignItems: 'start' }}>
            <div>
              {/* Contratos */}
              <div className="card" style={{ marginBottom: 18 }}>
                <h3 style={{ marginTop: 0 }}>Contratos <span className="muted" style={{ fontSize: 12 }}>(se suman aparte)</span></h3>
                <table className="table" style={{ width: '100%', fontSize: 13 }}>
                  <thead><tr><th>Obra</th><th>Especialidad</th><th style={{ textAlign: 'right' }}>Monto</th><th></th></tr></thead>
                  <tbody>
                    {calc.contratos.length === 0 && <tr><td colSpan={4} className="muted">Sin contratos en el período.</td></tr>}
                    {calc.contratos.map((c) => (
                      <tr key={c.id}><td>{c.obra || '—'}</td><td>{c.especialidad || '—'}</td><td style={{ textAlign: 'right' }}>{$(c.monto)}</td><td><button className="btn-ghost" onClick={() => delContrato(c.id)} title="Eliminar">✕</button></td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
                  <div className="field"><label>Obra</label><input className="input" value={nc.obra || ''} onChange={(e) => setNc({ ...nc, obra: e.target.value })} /></div>
                  <div className="field"><label>Especialidad</label><input className="input" value={nc.especialidad || ''} onChange={(e) => setNc({ ...nc, especialidad: e.target.value })} /></div>
                  <div className="field"><label>Monto</label><input className="input" type="number" value={nc.monto || ''} onChange={(e) => setNc({ ...nc, monto: e.target.value })} style={{ width: 120 }} /></div>
                  <button className="btn" disabled={busy || !nc.monto} onClick={addContrato}>+ Agregar</button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <label className="btn-ghost" style={{ cursor: 'pointer' }}>↑ Importar contratos (Excel)
                    <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={importContratos} />
                  </label>
                </div>
              </div>
            </div>

            <div>
              {/* Ajustes */}
              <div className="card" style={{ marginBottom: 18 }}>
                <h3 style={{ marginTop: 0 }}>Ajustes <span className="muted" style={{ fontSize: 12 }}>(herramientas, préstamos… negativo = descuento)</span></h3>
                <table className="table" style={{ width: '100%', fontSize: 13 }}>
                  <thead><tr><th>Concepto</th><th style={{ textAlign: 'right' }}>Monto</th><th></th></tr></thead>
                  <tbody>
                    {calc.ajustes.length === 0 && <tr><td colSpan={3} className="muted">Sin ajustes en el período.</td></tr>}
                    {calc.ajustes.map((a) => (
                      <tr key={a.id}><td>{a.concepto}</td><td style={{ textAlign: 'right', color: a.monto < 0 ? 'var(--danger)' : undefined }}>{$(a.monto)}</td><td><button className="btn-ghost" onClick={() => delAjuste(a.id)} title="Eliminar">✕</button></td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
                  <div className="field"><label>Concepto</label><input className="input" value={na.concepto || ''} onChange={(e) => setNa({ ...na, concepto: e.target.value })} placeholder="Ej: Herramienta perdida" /></div>
                  <div className="field"><label>Monto (+/-)</label><input className="input" type="number" value={na.monto || ''} onChange={(e) => setNa({ ...na, monto: e.target.value })} style={{ width: 120 }} /></div>
                  <button className="btn" disabled={busy || !na.concepto || !na.monto} onClick={addAjuste}>+ Agregar</button>
                </div>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Resumen</h3>
            <table className="table" style={{ width: '100%', maxWidth: 460, fontSize: 14 }}>
              <tbody>
                <tr><td>Básico (jornal × días)</td><td style={{ textAlign: 'right' }}>{$(calc.basico)}</td></tr>
                {calc.extraSemana > 0 && <tr><td>Extra semana (×1,5)</td><td style={{ textAlign: 'right' }}>{$(calc.extraSemana)}</td></tr>}
                {calc.sabado > 0 && <tr><td>Sábado (×1,5)</td><td style={{ textAlign: 'right' }}>{$(calc.sabado)}</td></tr>}
                {calc.domingo > 0 && <tr><td>Domingo (×2)</td><td style={{ textAlign: 'right' }}>{$(calc.domingo)}</td></tr>}
                {calc.feriado > 0 && <tr><td>Feriado (×2)</td><td style={{ textAlign: 'right' }}>{$(calc.feriado)}</td></tr>}
                {calc.bono > 0 && <tr><td>Bono</td><td style={{ textAlign: 'right' }}>{$(calc.bono)}</td></tr>}
                {calc.retro > 0 && <tr><td>Retroactivo</td><td style={{ textAlign: 'right' }}>{$(calc.retro)}</td></tr>}
                {calc.sac > 0 && <tr><td>SAC</td><td style={{ textAlign: 'right' }}>{$(calc.sac)}</td></tr>}
                {calc.difAnterior !== 0 && <tr><td>Dif. liq. anterior</td><td style={{ textAlign: 'right' }}>{$(calc.difAnterior)}</td></tr>}
                {calc.ajustesTotal !== 0 && <tr><td>Ajustes</td><td style={{ textAlign: 'right', color: calc.ajustesTotal < 0 ? 'var(--danger)' : undefined }}>{$(calc.ajustesTotal)}</td></tr>}
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}><td>Total sin contrato</td><td style={{ textAlign: 'right' }}>{$(calc.totalSinContrato)}</td></tr>
                {calc.contratosTotal > 0 && <tr><td>Contratos</td><td style={{ textAlign: 'right' }}>{$(calc.contratosTotal)}</td></tr>}
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700, fontSize: 15 }}><td>Total con contrato</td><td style={{ textAlign: 'right' }}>{$(calc.totalConContrato)}</td></tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

// ───────────── Valores hora de producción (por empleado) ─────────────
type ValRow = { empleado_id: number; nom: string; leg_num: string | number; cat?: string; vigencia: string; valor_hora: number; jornada_horas: number; categoria?: string };
function Valores() {
  const primerDiaMes = new Date().toISOString().slice(0, 8) + '01';
  const [rows, setRows] = useState<ValRow[]>([]);
  const [vig, setVig] = useState(primerDiaMes);   // vigencia para importación y altas
  const [filtro, setFiltro] = useState('');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  // alta manual
  const [q, setQ] = useState(''); const [matches, setMatches] = useState<Empleado[]>([]); const [sel, setSel] = useState<Empleado | null>(null); const [valor, setValor] = useState(''); const [horas, setHoras] = useState('8');
  const [pct, setPct] = useState('');
  const load = () => api.get<ValRow[]>('/produccion/valores').then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  async function aumentar() {
    if (!pct) return;
    if (!window.confirm(`Aumentar todos los valores hora un ${pct}% con vigencia ${vig}?`)) return;
    setBusy(true); setErr(''); setMsg('');
    try { const r = await api.post<{ actualizados: number }>('/produccion/valores/aumentar', { pct: Number(pct), vigencia: vig }); setMsg(`Aumento aplicado a ${r.actualizados} empleado(s) (+${pct}%, vig. ${vig}).`); setPct(''); load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function buscar(v: string) { setQ(v); setSel(null); if (v.trim().length < 2) { setMatches([]); return; } try { setMatches((await api.get<Empleado[]>(`/empleados?q=${encodeURIComponent(v)}`)).slice(0, 8)); } catch { /* */ } }
  function elegir(e: Empleado) { setSel(e); setQ(`${e.nom} (${e.legNum})`); setMatches([]); }
  async function guardar() {
    if (!sel || !valor) return;
    setBusy(true); setErr(''); setMsg('');
    try { await api.put('/produccion/valores', { valores: [{ empleadoId: sel.id, vigencia: vig, valor_hora: Number(valor), jornada_horas: Number(horas) || 8, categoria: sel.cat }] }); setMsg('Guardado ✓'); setQ(''); setSel(null); setValor(''); setHoras('8'); load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    setBusy(true); setErr(''); setMsg('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      let importRows: any[] = [];
      const shLiq = wb.SheetNames.find((n: string) => /liquidac/i.test(n));
      if (shLiq) {
        // hoja LIQUIDACION. El legajo se toma de la columna AO (índice 40): la columna "Legajo"
        // suele ser una fórmula que se lee vacía. Valor hora = "VALOR JORNAL" ÷ "CANTIDAD DE HS".
        const COL_AO = 40; // columna AO (0-based)
        const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[shLiq], { header: 1, defval: '', raw: true, blankrows: false });
        const hi = aoa.findIndex((r) => (r || []).some((c) => ['legajo', 'valor jornal', 'categoria'].includes(String(c).trim().toLowerCase())));
        if (hi >= 0) {
          const hdr = (aoa[hi] || []).map((h) => String(h).trim());
          const col = (name: string) => hdr.findIndex((h) => h.toLowerCase() === name.toLowerCase());
          const cLeg = col('Legajo'), cCat = col('Categoria'), cHs = col('CANTIDAD DE HS'), cJor = col('VALOR JORNAL');
          for (let i = hi + 1; i < aoa.length; i++) {
            const r = aoa[i] || [];
            let leg = r[COL_AO];                                   // columna AO
            if (leg === '' || leg == null || isNaN(Number(leg))) leg = cLeg >= 0 ? r[cLeg] : '';   // respaldo
            if (leg === '' || leg == null || isNaN(Number(leg))) continue;
            importRows.push({
              Legajo: leg,
              Categoria: cCat >= 0 ? r[cCat] : '',
              'CANTIDAD DE HS': cHs >= 0 ? r[cHs] : '',
              'VALOR JORNAL': cJor >= 0 ? r[cJor] : '',
            });
          }
        }
      }
      if (!importRows.length) {
        // hoja simple con encabezados propios (Legajo/CUIL, Categoria, Valor hora)
        importRows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      }
      if (!importRows.length) { setErr('No se encontraron filas para importar.'); setBusy(false); return; }
      const res = await api.post<{ importados: number; sinMatch: string[] }>('/produccion/valores/import', { rows: importRows, vigencia: vig });
      const sm = res.sinMatch?.length ? ` · ${res.sinMatch.length} sin match (legajo/CUIL no encontrado)` : '';
      setMsg(`Valores importados: ${res.importados} con vigencia ${vig}${sm}.`);
      load();
    } catch (er: any) { setErr('No se pudo importar: ' + er.message); } finally { setBusy(false); }
  }

  const vis = rows.filter((r) => !filtro || String(r.nom).toLowerCase().includes(filtro.toLowerCase()) || String(r.leg_num).includes(filtro));
  return (
    <>
    <div className="card" style={{ marginBottom: 18 }}>
      <h3 style={{ marginTop: 0 }}>Valor hora de producción (por empleado)</h3>
      <p className="muted" style={{ fontSize: 13 }}>El valor es individual y ya incluye presentismo. El cálculo toma, para cada empleado, el valor vigente más reciente a la fecha del período.</p>

      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12, gap: 12, background: 'var(--bg2)', padding: 12, borderRadius: 8 }}>
        <div className="field"><label>Vigencia (para importar/cargar/aumentar)</label><input className="input" type="date" value={vig} onChange={(e) => setVig(e.target.value)} /></div>
        <label className="btn" style={{ cursor: 'pointer' }}>↑ Importar de planilla (Excel)
          <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={importar} disabled={busy} />
        </label>
        <span className="muted" style={{ fontSize: 12, maxWidth: 360 }}>Detecta la hoja <b>LIQUIDACION</b>: legajo de la columna <b>AO</b>, valor hora = <b>"VALOR JORNAL" ÷ "CANTIDAD DE HS"</b> (respeta 8 o 9 hs). También acepta una hoja con columnas Legajo/CUIL, Categoria, "Valor hora" y "Horas".</span>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12, gap: 12, background: 'var(--bg2)', padding: 12, borderRadius: 8 }}>
        <div className="field"><label>Aumentar todos los valores en %</label><input className="input" type="number" step="any" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Ej: 8" style={{ width: 120 }} /></div>
        <button className="btn" disabled={busy || !pct} onClick={aumentar}>Aplicar aumento (vig. {vig})</button>
        <span className="muted" style={{ fontSize: 12, maxWidth: 380 }}>Crea una <b>nueva vigencia</b> con el valor actual × (1 + %). No pisa el histórico y evita reimportar la planilla cuando cambia la paritaria.</span>
      </div>

      <div className="field" style={{ maxWidth: 280, marginBottom: 8 }}><input className="input" placeholder="Filtrar por nombre o legajo…" value={filtro} onChange={(e) => setFiltro(e.target.value)} /></div>
      <table className="table" style={{ width: '100%', maxWidth: 720, fontSize: 14, marginBottom: 16 }}>
        <thead><tr><th>Legajo</th><th>Empleado</th><th>Categoría</th><th style={{ textAlign: 'center' }}>Horas</th><th>Vigencia</th><th style={{ textAlign: 'right' }}>Valor hora</th></tr></thead>
        <tbody>
          {vis.length === 0 && <tr><td colSpan={6} className="muted">Sin valores cargados.</td></tr>}
          {vis.map((r) => <tr key={r.empleado_id}><td>{r.leg_num}</td><td>{r.nom}</td><td>{r.categoria || r.cat || '—'}</td><td style={{ textAlign: 'center' }}>{r.jornada_horas}</td><td>{r.vigencia}</td><td style={{ textAlign: 'right' }}>{$(r.valor_hora)}</td></tr>)}
        </tbody>
      </table>

      <h4 style={{ margin: '0 0 8px' }}>Cargar / actualizar un empleado</h4>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ position: 'relative', minWidth: 260 }}>
          <label>Empleado</label>
          <input className="input" placeholder="Buscar…" value={q} onChange={(e) => buscar(e.target.value)} />
          {matches.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 220, overflow: 'auto' }}>
              {matches.map((e) => <div key={e.id} onClick={() => elegir(e)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{e.nom} <span className="muted">· {e.legNum} · {e.empresa}</span></div>)}
            </div>
          )}
        </div>
        <div className="field"><label>Horas (8/9)</label><input className="input" type="number" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} style={{ width: 90 }} /></div>
        <div className="field"><label>Valor hora</label><input className="input" type="number" value={valor} onChange={(e) => setValor(e.target.value)} style={{ width: 130 }} /></div>
        <button className="btn" disabled={busy || !sel || !valor} onClick={guardar}>Guardar (vig. {vig})</button>
      </div>
      {err && <div className="alert error" style={{ marginTop: 10 }}>{err}</div>}
      {msg && <div className="alert ok" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
    <BonosCategoria />
    </>
  );
}

// ───────────── Bono (no rem.) por categoría según paritaria ─────────────
type BonoRow = { categoria: string; vigencia: string; monto: number };
function BonosCategoria() {
  const primerDiaMes = new Date().toISOString().slice(0, 8) + '01';
  const [rows, setRows] = useState<BonoRow[]>([]); const [cats, setCats] = useState<string[]>([]);
  const [nb, setNb] = useState<Record<string, string>>({ vigencia: primerDiaMes });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = () => api.get<BonoRow[]>('/produccion/bonos').then(setRows).catch(() => {});
  useEffect(() => { load(); api.get<string[]>('/produccion/categorias').then((c) => setCats(c.filter((x) => x !== '(sin categoría)'))).catch(() => {}); }, []);
  async function guardar() {
    if (!nb.categoria || !nb.vigencia || nb.monto === undefined) return;
    setBusy(true); setErr(''); setMsg('');
    try { await api.put('/produccion/bonos', { bonos: [{ categoria: nb.categoria.trim(), vigencia: nb.vigencia, monto: Number(nb.monto) }] }); setMsg('Guardado ✓'); setNb({ vigencia: nb.vigencia }); load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function borrar(r: BonoRow) { setBusy(true); try { await api.del(`/produccion/bonos?categoria=${encodeURIComponent(r.categoria)}&vigencia=${r.vigencia}`); load(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Bono por categoría (paritaria)</h3>
      <p className="muted" style={{ fontSize: 13 }}>Cargá el bono no remunerativo por categoría y vigencia. En la corrida masiva, el botón "Aplicar bono paritaria" completa la columna Bono de cada empleado según su categoría.</p>
      <table className="table" style={{ width: '100%', maxWidth: 520, fontSize: 14, marginBottom: 14 }}>
        <thead><tr><th>Categoría</th><th>Vigencia</th><th style={{ textAlign: 'right' }}>Bono</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="muted">Sin bonos cargados.</td></tr>}
          {rows.map((r, i) => <tr key={i}><td>{r.categoria}</td><td>{r.vigencia}</td><td style={{ textAlign: 'right' }}>{$(r.monto)}</td><td><button className="btn-ghost" onClick={() => borrar(r)} style={{ padding: '2px 6px' }}>✕</button></td></tr>)}
        </tbody>
      </table>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Categoría</label>
          {cats.length ? (
            <select className="input" value={nb.categoria || ''} onChange={(e) => setNb({ ...nb, categoria: e.target.value })}><option value="">Elegir…</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          ) : <input className="input" value={nb.categoria || ''} onChange={(e) => setNb({ ...nb, categoria: e.target.value })} placeholder="Ej: OFICIAL" />}
        </div>
        <div className="field"><label>Vigencia</label><input className="input" type="date" value={nb.vigencia || ''} onChange={(e) => setNb({ ...nb, vigencia: e.target.value })} /></div>
        <div className="field"><label>Bono</label><input className="input" type="number" value={nb.monto || ''} onChange={(e) => setNb({ ...nb, monto: e.target.value })} style={{ width: 130 }} /></div>
        <button className="btn" disabled={busy || !nb.categoria || !nb.monto} onClick={guardar}>Guardar</button>
      </div>
      {err && <div className="alert error" style={{ marginTop: 10 }}>{err}</div>}
      {msg && <div className="alert ok" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}

// ───────────── Corrida masiva ─────────────
type CorridaItem = {
  empleado: { id: number; nom: string; legNum: string | number; cat: string };
  jornadaHoras: number; valorHora: number; cantidades: { diasNormales: number; hsSemana: number; hsSabado: number; hsDomingo: number; hsFeriado: number };
  basico: number; extraSemana: number; sabado: number; domingo: number; feriado: number;
  bono: number; retro: number; sac: number; difAnterior: number; ajustesTotal: number; contratosTotal: number;
  totalSinContrato: number; totalConContrato: number;
};
type Edit = { dias: number; hsSem: number; hsSab: number; hsDom: number; hsFer: number; bono: number; ajuste: number; sac: number };
type Candidato = { id: number; nom: string; leg_num: string | number; cat: string; empresa: string };
function Masiva() {
  const [mes, setMes] = useState(new Date().getMonth() + 1); const [anio, setAnio] = useState(new Date().getFullYear()); const [quincena, setQuincena] = useState(1);
  const [empresas, setEmpresas] = useState<string[]>([]); const [empresa, setEmpresa] = useState('');
  const [cats, setCats] = useState<string[]>([]); const [catSel, setCatSel] = useState<string[]>([]);
  const [cands, setCands] = useState<Candidato[]>([]); const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [res, setRes] = useState<{ totalSinContrato: number; totalConContrato: number; items: CorridaItem[]; debug?: any } | null>(null);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');

  function initEdits(items: CorridaItem[]) {
    setEdits((prev) => Object.fromEntries(items.map((it) => [it.empleado.id, {
      dias: it.cantidades.diasNormales, hsSem: it.cantidades.hsSemana, hsSab: it.cantidades.hsSabado,
      hsDom: it.cantidades.hsDomingo, hsFer: it.cantidades.hsFeriado, bono: it.bono, ajuste: it.ajustesTotal,
      sac: prev[it.empleado.id]?.sac ?? it.sac ?? 0,   // conserva el SAC ya calculado si lo hubiera
    }])));
  }
  const setE = (id: number, k: keyof Edit, v: string) => setEdits((s) => ({ ...s, [id]: { ...s[id], [k]: Number(v) || 0 } }));
  function resetRow(it: CorridaItem) {
    setEdits((s) => ({ ...s, [it.empleado.id]: { dias: it.cantidades.diasNormales, hsSem: it.cantidades.hsSemana, hsSab: it.cantidades.hsSabado, hsDom: it.cantidades.hsDomingo, hsFer: it.cantidades.hsFeriado, bono: it.bono, ajuste: it.ajustesTotal, sac: 0 } }));
  }
  // Recálculo en vivo de una fila con lo editado (misma fórmula que el backend).
  function calcRow(it: CorridaItem) {
    const e = edits[it.empleado.id];
    if (!e) return { basico: it.basico, extras: it.extraSemana + it.sabado + it.domingo + it.feriado, ajuste: it.ajustesTotal, totalSin: it.totalSinContrato, totalCon: it.totalConContrato };
    const jh = it.jornadaHoras || 8;
    // valor hora: el que vino de la corrida; si falta, se deduce del básico/extra ya calculados.
    let vh = Number(it.valorHora) || 0;
    if (!vh) {
      if (it.cantidades.diasNormales > 0) vh = it.basico / (jh * it.cantidades.diasNormales);
      else if (it.cantidades.hsSemana > 0) vh = it.extraSemana / (1.5 * it.cantidades.hsSemana);
      else if (it.cantidades.hsSabado > 0) vh = it.sabado / (1.5 * it.cantidades.hsSabado);
    }
    const jornal = vh * jh;
    const basico = jornal * e.dias;
    const extras = vh * 1.5 * e.hsSem + vh * 1.5 * e.hsSab + vh * 2 * e.hsDom + vh * 2 * e.hsFer;
    const fijos = (it.retro || 0) + (it.difAnterior || 0);
    const totalSin = basico + extras + e.bono + (e.sac || 0) + fijos + e.ajuste;
    return { basico, extras, ajuste: e.ajuste, totalSin, totalCon: totalSin + it.contratosTotal };
  }
  const totales = (res?.items || []).reduce((a, it) => { const c = calcRow(it); a.sin += c.totalSin; a.con += c.totalCon; return a; }, { sin: 0, con: 0 });

  useEffect(() => { api.get<string[]>('/produccion/empresas').then(setEmpresas).catch(() => {}); }, []);
  useEffect(() => { api.get<string[]>(`/produccion/categorias${empresa ? `?empresa=${encodeURIComponent(empresa)}` : ''}`).then(setCats).catch(() => {}); setCatSel([]); }, [empresa]);

  async function cargar() {
    setBusy(true); setErr(''); setMsg(''); setRes(null);
    try {
      const qs = new URLSearchParams();
      if (empresa) qs.set('empresa', empresa);
      if (catSel.length) qs.set('categoria', catSel.join(','));
      const c = await api.get<Candidato[]>(`/produccion/candidatos?${qs.toString()}`);
      setCands(c); setChecked(Object.fromEntries(c.map((x) => [x.id, true])));
      if (!c.length) setMsg('No hay empleados de producción con esos filtros (¿cargaste los valores hora?).');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const nSel = Object.values(checked).filter(Boolean).length;
  async function liquidar() {
    const ids = cands.filter((c) => checked[c.id]).map((c) => c.id);
    if (!ids.length) return;
    setBusy(true); setErr(''); setMsg('');
    try { const r = await api.post<{ totalSinContrato: number; totalConContrato: number; items: CorridaItem[]; debug?: any }>('/produccion/corrida', { anio, mes, quincena, empleadoIds: ids }); setRes(r); initEdits(r.items); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  function exportar() {
    if (!res) return;
    const data = res.items.map((it) => {
      const e = edits[it.empleado.id]; const c = calcRow(it);
      return {
        Legajo: it.empleado.legNum, Empleado: it.empleado.nom, Categoría: it.empleado.cat, Hs: it.jornadaHoras,
        Días: e?.dias ?? it.cantidades.diasNormales, Básico: c.basico,
        'Hs semana': e?.hsSem ?? it.cantidades.hsSemana, 'Hs sábado': e?.hsSab ?? it.cantidades.hsSabado, 'Hs domingo': e?.hsDom ?? it.cantidades.hsDomingo, 'Hs feriado': e?.hsFer ?? it.cantidades.hsFeriado,
        Extras: c.extras, Bono: e?.bono ?? it.bono, Retro: it.retro, SAC: e?.sac ?? it.sac, Ajustes: c.ajuste,
        'Total sin contrato': c.totalSin, Contratos: it.contratosTotal, 'Total con contrato': c.totalCon,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Producción');
    XLSX.writeFile(wb, `produccion_${anio}-${String(mes).padStart(2, '0')}_q${quincena}.xlsx`);
  }
  // Autocompleta la columna Bono según la categoría de cada empleado (paritaria vigente al período).
  async function aplicarBono() {
    if (!res) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const bonos = await api.get<{ categoria: string; vigencia: string; monto: number }[]>('/produccion/bonos');
      const ref = quincena === 1 ? `${anio}-${String(mes).padStart(2, '0')}-15` : `${anio}-${String(mes).padStart(2, '0')}-28`;
      const norm = (s: string) => String(s || '').trim().toUpperCase();
      const map: Record<string, number> = {};
      for (const b of bonos) {
        if (b.vigencia > ref) continue;                    // sólo vigencia ≤ período
        const k = norm(b.categoria);
        if (!(k in map)) map[k] = b.monto;                 // bonos vienen ordenados por vigencia DESC → el primero es el vigente
      }
      let aplicados = 0;
      setEdits((s) => {
        const next = { ...s };
        for (const it of res.items) {
          const m = map[norm(it.empleado.cat)];
          if (m !== undefined) { next[it.empleado.id] = { ...next[it.empleado.id], bono: m }; aplicados++; }
        }
        return next;
      });
      setMsg(`Bono aplicado a ${aplicados} empleado(s) por categoría. Revisá y "Exportar" o seguí editando.`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  // Calcula el SAC (50% de la mejor remuneración mensual del semestre) de las corridas guardadas.
  async function calcularSac() {
    if (!res) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const ids = res.items.map((it) => it.empleado.id);
      const r = await api.post<Record<number, { sac: number; mejorRemun: number; mesesConDatos: number }>>('/produccion/sac/masivo', { anio, mes, empleadoIds: ids });
      let conDatos = 0;
      setEdits((s) => {
        const next = { ...s };
        for (const it of res.items) { const d = r[it.empleado.id]; if (d) { next[it.empleado.id] = { ...next[it.empleado.id], sac: d.sac }; if (d.mesesConDatos > 0) conDatos++; } }
        return next;
      });
      setMsg(`SAC calculado para ${conDatos} empleado(s) con historial. Los que no tienen corridas guardadas quedan en 0 (guardá las quincenas del semestre primero).`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  // Guarda la corrida actual (foto editada) en el historial.
  async function guardarCorrida() {
    if (!res) return;
    if (!window.confirm(`Guardar esta liquidación (${res.items.length} empleados, ${MESES[mes - 1]} ${anio} q${quincena}) en el historial?`)) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const items = res.items.map((it) => {
        const e = edits[it.empleado.id]; const c = calcRow(it);
        return {
          empleadoId: it.empleado.id, legNum: String(it.empleado.legNum), nom: it.empleado.nom, cat: it.empleado.cat,
          jornadaHoras: it.jornadaHoras, valorHora: it.valorHora,
          dias: e?.dias ?? 0, hsSem: e?.hsSem ?? 0, hsSab: e?.hsSab ?? 0, hsDom: e?.hsDom ?? 0, hsFer: e?.hsFer ?? 0,
          basico: c.basico, extras: c.extras, bono: e?.bono ?? 0, retro: it.retro, sac: e?.sac ?? 0, ajuste: e?.ajuste ?? 0,
          contratos: it.contratosTotal, totalSin: c.totalSin, totalCon: c.totalCon,
        };
      });
      const r = await api.post<{ id: number; cantidad: number }>('/produccion/corridas', { anio, mes, quincena, empresa: empresa || null, items });
      setMsg(`Liquidación guardada en el historial (#${r.id}, ${r.cantidad} empleados).`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  // Persiste la columna de ajustes/descuentos editada (reemplaza el ajuste guardado por empleado/período).
  async function guardarAjustes() {
    if (!res) return;
    if (!window.confirm('Guarda los ajustes/descuentos de esta corrida por empleado (reemplaza el ajuste anterior del período). ¿Continuar?')) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const items = res.items.map((it) => ({ empleadoId: it.empleado.id, monto: edits[it.empleado.id]?.ajuste ?? 0 }));
      const r = await api.post<{ guardados: number }>('/produccion/ajustes/masivo', { anio, mes, quincena, items });
      setMsg(`Ajustes guardados: ${r.guardados}. (Las horas/bono editados afectan esta corrida y el Excel; para fijarlos usá la pestaña individual.)`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function reliquidar() {
    const ids = cands.filter((c) => checked[c.id]).map((c) => c.id);
    if (!ids.length) return;
    const rr = await api.post<{ totalSinContrato: number; totalConContrato: number; items: CorridaItem[]; debug?: any }>('/produccion/corrida', { anio, mes, quincena, empleadoIds: ids });
    setRes(rr); initEdits(rr.items);
  }
  async function importContratos(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    setBusy(true); setErr(''); setMsg('');
    try {
      const buf = await file.arrayBuffer(); const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const shName = wb.SheetNames.find((n: string) => /contrat/i.test(n)) || wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[shName], { defval: '', raw: true });
      const r = await api.post<{ importados: number; sinMatch: string[] }>('/produccion/contratos/import', { rows, anio, mes, quincena });
      const sm = r.sinMatch?.length ? ` · ${r.sinMatch.length} sin match` : '';
      await reliquidar();
      setMsg(`Contratos importados: ${r.importados}${sm}.`);
    } catch (er: any) { setErr('No se pudo importar: ' + er.message); } finally { setBusy(false); }
  }
  // Importa el bono por empleado desde la hoja LIQUIDACION (columna "Bono", legajo de AO).
  async function importBono(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    setBusy(true); setErr(''); setMsg('');
    try {
      const buf = await file.arrayBuffer(); const wb = XLSX.read(buf, { type: 'array' });
      const shLiq = wb.SheetNames.find((n: string) => /liquidac/i.test(n));
      if (!shLiq) { setErr('El archivo no tiene hoja LIQUIDACION.'); setBusy(false); return; }
      const COL_AO = 40;
      const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[shLiq], { header: 1, defval: '', raw: true, blankrows: false });
      const hi = aoa.findIndex((r) => (r || []).some((c) => ['legajo', 'valor jornal', 'categoria'].includes(String(c).trim().toLowerCase())));
      const hdr = (aoa[hi] || []).map((h) => String(h).trim());
      const cBono = hdr.findIndex((h) => h.toLowerCase() === 'bono');
      const cLeg = hdr.findIndex((h) => h.toLowerCase() === 'legajo');
      const rows: any[] = [];
      for (let i = hi + 1; i < aoa.length; i++) {
        const r = aoa[i] || []; let leg = r[COL_AO];
        if (leg === '' || leg == null || isNaN(Number(leg))) leg = cLeg >= 0 ? r[cLeg] : '';
        if (leg === '' || leg == null || isNaN(Number(leg))) continue;
        rows.push({ Legajo: leg, Bono: cBono >= 0 ? r[cBono] : 0 });
      }
      const r = await api.post<{ importados: number; sinMatch: string[] }>('/produccion/bono/import', { rows, anio, mes, quincena });
      const sm = r.sinMatch?.length ? ` · ${r.sinMatch.length} sin match` : '';
      await reliquidar();
      setMsg(`Bono importado: ${r.importados}${sm}.`);
    } catch (er: any) { setErr('No se pudo importar el bono: ' + er.message); } finally { setBusy(false); }
  }

  function toggleCat(c: string) { setCatSel((s) => s.includes(c) ? s.filter((x) => x !== c) : [...s, c]); }
  const allChecked = cands.length > 0 && cands.every((c) => checked[c.id]);

  return (
    <>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field"><label>Empresa</label><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select></div>
          <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
          <div className="field"><label>Año</label><input className="input" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 100 }} /></div>
          <div className="field"><label>Quincena</label><select className="input" value={quincena} onChange={(e) => setQuincena(Number(e.target.value))}><option value={1}>1ª (1–15)</option><option value={2}>2ª (16–fin)</option></select></div>
          <button className="btn" disabled={busy} onClick={cargar}>Cargar empleados</button>
        </div>
        {cats.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Filtrar por categoría/tarea (opcional)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {cats.map((c) => (
                <label key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, background: catSel.includes(c) ? 'var(--accent)' : 'var(--bg2)', color: catSel.includes(c) ? '#fff' : undefined, padding: '4px 10px', borderRadius: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={catSel.includes(c)} onChange={() => toggleCat(c)} style={{ display: 'none' }} />{c}
                </label>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Elegí categorías y volvé a "Cargar empleados". Sin selección = todas.</div>
          </div>
        )}
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Sólo aparecen empleados con valor hora cargado. Si ingresa alguien nuevo, cargale el valor hora y aparece acá automáticamente.</div>
        {err && <div className="alert error" style={{ marginTop: 10 }}>{err}</div>}
        {msg && <div className="alert ok" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      {cands.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Empleados ({nSel}/{cands.length} seleccionados)</h3>
            <div className="row" style={{ gap: 8 }}>
              <label className="btn-ghost" style={{ cursor: 'pointer' }}>↑ Importar contratos<input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={importContratos} /></label>
              <label className="btn-ghost" style={{ cursor: 'pointer' }}>↑ Importar bono (planilla)<input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={importBono} /></label>
              <button className="btn" disabled={busy || !nSel} onClick={liquidar}>Liquidar seleccionados</button>
            </div>
          </div>
          <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead><tr>
                <th style={{ width: 32 }}><input type="checkbox" checked={allChecked} onChange={(e) => setChecked(Object.fromEntries(cands.map((c) => [c.id, e.target.checked])))} /></th>
                <th>Legajo</th><th>Empleado</th><th>Categoría</th><th>Empresa</th>
              </tr></thead>
              <tbody>
                {cands.map((c) => (
                  <tr key={c.id}>
                    <td><input type="checkbox" checked={!!checked[c.id]} onChange={(e) => setChecked({ ...checked, [c.id]: e.target.checked })} /></td>
                    <td>{c.leg_num}</td><td>{c.nom}</td><td>{c.cat || '—'}</td><td>{c.empresa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {res && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0 }}>Resultado ({res.items.length}) <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>— editá días, horas, bono o descuento; el total se actualiza solo</span></h3>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-ghost" onClick={calcularSac} disabled={busy}>Calcular SAC</button>
              <button className="btn-ghost" onClick={aplicarBono} disabled={busy}>Aplicar bono paritaria</button>
              <button className="btn-ghost" onClick={guardarAjustes} disabled={busy}>Guardar descuentos</button>
              <button className="btn" onClick={guardarCorrida} disabled={busy}>Guardar liquidación</button>
              <button className="btn-ghost" onClick={exportar}>↓ Exportar Excel</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead><tr>
                <th>Legajo</th><th>Empleado</th><th style={{ textAlign: 'center' }}>Hs</th>
                <th style={{ textAlign: 'center' }}>Días</th><th style={{ textAlign: 'center' }}>Hs sem</th><th style={{ textAlign: 'center' }}>Hs sáb</th><th style={{ textAlign: 'center' }}>Hs dom</th><th style={{ textAlign: 'center' }}>Hs fer</th>
                <th style={{ textAlign: 'center' }}>Bono</th><th style={{ textAlign: 'center' }}>SAC</th><th style={{ textAlign: 'center' }}>Ajuste/desc.</th>
                <th style={{ textAlign: 'right' }}>Total s/contr.</th><th style={{ textAlign: 'right' }}>Contr.</th><th style={{ textAlign: 'right' }}>Total c/contr.</th><th></th>
              </tr></thead>
              <tbody>
                {res.items.map((it) => {
                  const e = edits[it.empleado.id]; const c = calcRow(it); const id = it.empleado.id;
                  const nInput = (k: keyof Edit, w = 56) => (
                    <input className="input" type="number" step="any" value={e ? String(e[k]) : ''} onChange={(ev) => setE(id, k, ev.target.value)} style={{ width: w, padding: '2px 6px', textAlign: 'right' }} />
                  );
                  return (
                    <tr key={id}>
                      <td>{it.empleado.legNum}</td>
                      <td>{it.empleado.nom}<div className="muted" style={{ fontSize: 11 }}>{it.empleado.cat || '—'}</div></td>
                      <td style={{ textAlign: 'center' }}>{it.jornadaHoras}</td>
                      <td style={{ textAlign: 'center' }}>{nInput('dias', 48)}</td>
                      <td style={{ textAlign: 'center' }}>{nInput('hsSem')}</td>
                      <td style={{ textAlign: 'center' }}>{nInput('hsSab')}</td>
                      <td style={{ textAlign: 'center' }}>{nInput('hsDom')}</td>
                      <td style={{ textAlign: 'center' }}>{nInput('hsFer')}</td>
                      <td style={{ textAlign: 'center' }}>{nInput('bono', 80)}</td>
                      <td style={{ textAlign: 'center' }}>{nInput('sac', 80)}</td>
                      <td style={{ textAlign: 'center' }}>{nInput('ajuste', 80)}</td>
                      <td style={{ textAlign: 'right' }}>{$(c.totalSin)}</td>
                      <td style={{ textAlign: 'right' }}>{$(it.contratosTotal)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{$(c.totalCon)}</td>
                      <td><button className="btn-ghost" title="Restaurar valores de fichadas" onClick={() => resetRow(it)} style={{ padding: '2px 6px' }}>↺</button></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                  <td colSpan={11} style={{ textAlign: 'right' }}>Totales</td>
                  <td style={{ textAlign: 'right' }}>{$(totales.sin)}</td><td></td><td style={{ textAlign: 'right' }}>{$(totales.con)}</td><td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>El descuento va en negativo (ej. −15000). "Guardar descuentos" fija la columna Ajuste/desc. por empleado en el período; las horas y el bono editados afectan esta corrida y el Excel exportado.</div>
          {res.debug && (
            <div style={{ fontSize: 11, marginTop: 8, padding: 8, background: 'var(--bg2)', borderRadius: 6 }} className="muted">
              <b>Diagnóstico</b> · contratos en este período (mes {mes}, q{quincena}): <b>{res.debug.contratosEnPeriodo}</b> (de {res.debug.contratosEmpleadosEnPeriodo} empleados) · contratos en base (todos los períodos): {res.debug.contratosTotalDB} · períodos con contratos: {(res.debug.periodosContratos || []).join(', ') || '—'} · bonos por categoría cargados: {res.debug.bonosCargados}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ───────────── Historial de liquidaciones guardadas ─────────────
type CorridaHist = { id: number; anio: number; mes: number; quincena: number; empresa?: string; nota?: string; total_sin: number; total_con: number; usuario?: string; creada: string; cantidad: number };
function Historial() {
  const [rows, setRows] = useState<CorridaHist[]>([]); const [det, setDet] = useState<any | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const load = () => api.get<CorridaHist[]>('/produccion/corridas').then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  async function ver(id: number) { setBusy(true); setErr(''); try { setDet(await api.get(`/produccion/corridas/${id}`)); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }
  async function borrar(id: number) { if (!window.confirm('¿Eliminar esta liquidación del historial?')) return; setBusy(true); try { await api.del(`/produccion/corridas/${id}`); if (det?.id === id) setDet(null); load(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }
  function exportarDet() {
    if (!det) return;
    const data = det.items.map((i: any) => ({ Legajo: i.leg_num, Empleado: i.nom, Categoría: i.cat, Hs: i.jornada_horas, Días: i.dias, Básico: i.basico, Extras: i.extras, Bono: i.bono, SAC: i.sac, Ajuste: i.ajuste, 'Total s/contrato': i.total_sin, Contratos: i.contratos, 'Total c/contrato': i.total_con }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Liquidación');
    XLSX.writeFile(wb, `produccion_hist_${det.anio}-${String(det.mes).padStart(2, '0')}_q${det.quincena}.xlsx`);
  }
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Historial de liquidaciones</h3>
      {err && <div className="alert error" style={{ marginBottom: 10 }}>{err}</div>}
      <table className="table" style={{ width: '100%', fontSize: 13, marginBottom: 16 }}>
        <thead><tr><th>Fecha</th><th>Período</th><th>Empresa</th><th style={{ textAlign: 'right' }}>Empl.</th><th style={{ textAlign: 'right' }}>Total s/contr.</th><th style={{ textAlign: 'right' }}>Total c/contr.</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} className="muted">Sin liquidaciones guardadas.</td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.creada}</td><td>{MESES[r.mes - 1]} {r.anio} · {r.quincena}ª</td><td>{r.empresa || 'Todas'}</td>
              <td style={{ textAlign: 'right' }}>{r.cantidad}</td><td style={{ textAlign: 'right' }}>{$(r.total_sin)}</td><td style={{ textAlign: 'right' }}>{$(r.total_con)}</td>
              <td><button className="btn-ghost" onClick={() => ver(r.id)} style={{ padding: '2px 8px' }}>Ver</button> <button className="btn-ghost" onClick={() => borrar(r.id)} style={{ padding: '2px 6px' }}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {det && (
        <div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ margin: 0 }}>{MESES[det.mes - 1]} {det.anio} · {det.quincena}ª quincena {det.empresa ? `· ${det.empresa}` : ''} <span className="muted" style={{ fontSize: 12 }}>({det.items.length} empleados)</span></h4>
            <button className="btn-ghost" onClick={exportarDet} disabled={busy}>↓ Exportar Excel</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead><tr><th>Legajo</th><th>Empleado</th><th style={{ textAlign: 'right' }}>Días</th><th style={{ textAlign: 'right' }}>Básico</th><th style={{ textAlign: 'right' }}>Extras</th><th style={{ textAlign: 'right' }}>Bono</th><th style={{ textAlign: 'right' }}>SAC</th><th style={{ textAlign: 'right' }}>Ajuste</th><th style={{ textAlign: 'right' }}>Total s/c</th><th style={{ textAlign: 'right' }}>Contr.</th><th style={{ textAlign: 'right' }}>Total c/c</th></tr></thead>
              <tbody>
                {det.items.map((i: any) => (
                  <tr key={i.id}><td>{i.leg_num}</td><td>{i.nom}</td><td style={{ textAlign: 'right' }}>{i.dias}</td><td style={{ textAlign: 'right' }}>{$(i.basico)}</td><td style={{ textAlign: 'right' }}>{$(i.extras)}</td><td style={{ textAlign: 'right' }}>{$(i.bono)}</td><td style={{ textAlign: 'right' }}>{$(i.sac)}</td><td style={{ textAlign: 'right' }}>{$(i.ajuste)}</td><td style={{ textAlign: 'right' }}>{$(i.total_sin)}</td><td style={{ textAlign: 'right' }}>{$(i.contratos)}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{$(i.total_con)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}><td colSpan={8} style={{ textAlign: 'right' }}>Totales</td><td style={{ textAlign: 'right' }}>{$(det.total_sin)}</td><td></td><td style={{ textAlign: 'right' }}>{$(det.total_con)}</td></tr></tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Produccion() {
  const [tab, setTab] = useState<'liquidar' | 'masiva' | 'historial' | 'valores'>('liquidar');
  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Liquidación por producción</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>Premios y contratos, en paralelo a la liquidación de convenio. Sin aportes ni contribuciones.</p>
        </div>
      </div>
      <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={tab === 'liquidar' ? 'btn' : 'btn-ghost'} onClick={() => setTab('liquidar')}>Liquidar (individual)</button>
        <button className={tab === 'masiva' ? 'btn' : 'btn-ghost'} onClick={() => setTab('masiva')}>Corrida masiva</button>
        <button className={tab === 'historial' ? 'btn' : 'btn-ghost'} onClick={() => setTab('historial')}>Historial</button>
        <button className={tab === 'valores' ? 'btn' : 'btn-ghost'} onClick={() => setTab('valores')}>Valores hora</button>
      </div>
      {tab === 'liquidar' ? <Liquidar /> : tab === 'masiva' ? <Masiva /> : tab === 'historial' ? <Historial /> : <Valores />}
    </div>
  );
}
