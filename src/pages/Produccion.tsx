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
  const load = () => api.get<ValRow[]>('/produccion/valores').then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);

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
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Valor hora de producción (por empleado)</h3>
      <p className="muted" style={{ fontSize: 13 }}>El valor es individual y ya incluye presentismo. El cálculo toma, para cada empleado, el valor vigente más reciente a la fecha del período.</p>

      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12, gap: 12, background: 'var(--bg2)', padding: 12, borderRadius: 8 }}>
        <div className="field"><label>Vigencia (para importar/cargar)</label><input className="input" type="date" value={vig} onChange={(e) => setVig(e.target.value)} /></div>
        <label className="btn" style={{ cursor: 'pointer' }}>↑ Importar de planilla (Excel)
          <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={importar} disabled={busy} />
        </label>
        <span className="muted" style={{ fontSize: 12, maxWidth: 360 }}>Detecta la hoja <b>LIQUIDACION</b>: legajo de la columna <b>AO</b>, valor hora = <b>"VALOR JORNAL" ÷ "CANTIDAD DE HS"</b> (respeta 8 o 9 hs). También acepta una hoja con columnas Legajo/CUIL, Categoria, "Valor hora" y "Horas".</span>
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
  );
}

// ───────────── Corrida masiva ─────────────
type CorridaItem = {
  empleado: { id: number; nom: string; legNum: string | number; cat: string };
  jornadaHoras: number; cantidades: { diasNormales: number; hsSemana: number; hsSabado: number; hsDomingo: number; hsFeriado: number };
  basico: number; extraSemana: number; sabado: number; domingo: number; feriado: number;
  bono: number; retro: number; sac: number; ajustesTotal: number; contratosTotal: number;
  totalSinContrato: number; totalConContrato: number;
};
type Candidato = { id: number; nom: string; leg_num: string | number; cat: string; empresa: string };
function Masiva() {
  const [mes, setMes] = useState(new Date().getMonth() + 1); const [anio, setAnio] = useState(new Date().getFullYear()); const [quincena, setQuincena] = useState(1);
  const [empresas, setEmpresas] = useState<string[]>([]); const [empresa, setEmpresa] = useState('');
  const [cats, setCats] = useState<string[]>([]); const [catSel, setCatSel] = useState<string[]>([]);
  const [cands, setCands] = useState<Candidato[]>([]); const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [res, setRes] = useState<{ totalSinContrato: number; totalConContrato: number; items: CorridaItem[] } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');

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
    try { setRes(await api.post('/produccion/corrida', { anio, mes, quincena, empleadoIds: ids })); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  function exportar() {
    if (!res) return;
    const data = res.items.map((it) => ({
      Legajo: it.empleado.legNum, Empleado: it.empleado.nom, Categoría: it.empleado.cat, Hs: it.jornadaHoras,
      Días: it.cantidades.diasNormales, Básico: it.basico, 'Extra semana': it.extraSemana, Sábado: it.sabado, Domingo: it.domingo, Feriado: it.feriado,
      Bono: it.bono, Retro: it.retro, SAC: it.sac, Ajustes: it.ajustesTotal, 'Total sin contrato': it.totalSinContrato, Contratos: it.contratosTotal, 'Total con contrato': it.totalConContrato,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Producción');
    XLSX.writeFile(wb, `produccion_${anio}-${String(mes).padStart(2, '0')}_q${quincena}.xlsx`);
  }
  async function importContratos(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    setBusy(true); setErr(''); setMsg('');
    try {
      const buf = await file.arrayBuffer(); const wb = XLSX.read(buf, { type: 'array' });
      const shName = wb.SheetNames.find((n: string) => /contrat/i.test(n)) || wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[shName], { defval: '', raw: false });
      const r = await api.post<{ importados: number; sinMatch: string[] }>('/produccion/contratos/import', { rows, anio, mes, quincena });
      const sm = r.sinMatch?.length ? ` · ${r.sinMatch.length} sin match` : '';
      setMsg(`Contratos importados: ${r.importados}${sm}. Volvé a liquidar para verlos reflejados.`);
    } catch (er: any) { setErr('No se pudo importar: ' + er.message); } finally { setBusy(false); }
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
              <label className="btn-ghost" style={{ cursor: 'pointer' }}>↑ Importar contratos (Excel)<input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={importContratos} /></label>
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
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Resultado ({res.items.length})</h3>
            <button className="btn-ghost" onClick={exportar}>↓ Exportar Excel</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead><tr>
                <th>Legajo</th><th>Empleado</th><th>Cat.</th><th style={{ textAlign: 'center' }}>Hs</th><th style={{ textAlign: 'right' }}>Días</th>
                <th style={{ textAlign: 'right' }}>Básico</th><th style={{ textAlign: 'right' }}>Extras</th><th style={{ textAlign: 'right' }}>Ajustes</th>
                <th style={{ textAlign: 'right' }}>Total s/contrato</th><th style={{ textAlign: 'right' }}>Contratos</th><th style={{ textAlign: 'right' }}>Total c/contrato</th>
              </tr></thead>
              <tbody>
                {res.items.map((it) => {
                  const extras = it.extraSemana + it.sabado + it.domingo + it.feriado;
                  return (
                    <tr key={it.empleado.id}>
                      <td>{it.empleado.legNum}</td><td>{it.empleado.nom}</td><td>{it.empleado.cat || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{it.jornadaHoras}</td><td style={{ textAlign: 'right' }}>{it.cantidades.diasNormales}</td>
                      <td style={{ textAlign: 'right' }}>{$(it.basico)}</td><td style={{ textAlign: 'right' }}>{$(extras)}</td>
                      <td style={{ textAlign: 'right', color: it.ajustesTotal < 0 ? 'var(--danger)' : undefined }}>{$(it.ajustesTotal)}</td>
                      <td style={{ textAlign: 'right' }}>{$(it.totalSinContrato)}</td><td style={{ textAlign: 'right' }}>{$(it.contratosTotal)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{$(it.totalConContrato)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                  <td colSpan={8} style={{ textAlign: 'right' }}>Totales</td>
                  <td style={{ textAlign: 'right' }}>{$(res.totalSinContrato)}</td><td></td><td style={{ textAlign: 'right' }}>{$(res.totalConContrato)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default function Produccion() {
  const [tab, setTab] = useState<'liquidar' | 'masiva' | 'valores'>('liquidar');
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
        <button className={tab === 'valores' ? 'btn' : 'btn-ghost'} onClick={() => setTab('valores')}>Valores hora</button>
      </div>
      {tab === 'liquidar' ? <Liquidar /> : tab === 'masiva' ? <Masiva /> : <Valores />}
    </div>
  );
}
