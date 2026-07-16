import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import * as XLSX from 'xlsx';

type Campo = [string, string, ('text' | 'num' | 'int' | 'date' | 'bool')?];
interface DatasetMeta { key: string; label: string; periodo: string; }
interface DatasetResp { key: string; label: string; periodo: string; anio: number; mes: number; campos: Campo[]; rows: any[]; }
interface Calc { key: string; nombre: string; formula: string; }

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const $ = (n: any) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Evaluador de fórmulas seguro (recursive-descent, sin eval) ──
// Soporta + - * / % , paréntesis, números y referencias a claves de campo.
function evalFormula(expr: string, scope: Record<string, number>): number | null {
  const t = (expr.match(/(\d+\.?\d*|[A-Za-z_][A-Za-z0-9_]*|[-+*/%()])/g)) || [];
  let i = 0;
  const peek = () => t[i];
  const next = () => t[i++];
  function factor(): number {
    const tk = peek();
    if (tk === '(') { next(); const v = expr2(); if (peek() === ')') next(); return v; }
    if (tk === '-') { next(); return -factor(); }
    if (tk === '+') { next(); return factor(); }
    next();
    if (tk == null) return 0;
    if (/^\d/.test(tk)) return parseFloat(tk);
    const v = scope[tk];
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }
  function term(): number {
    let v = factor();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next(); const r = factor();
      v = op === '*' ? v * r : (r === 0 ? NaN : (op === '/' ? v / r : v % r));
    }
    return v;
  }
  function expr2(): number {
    let v = term();
    while (peek() === '+' || peek() === '-') { const op = next(); const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  const r = expr2();
  return Number.isFinite(r) ? r : null;
}

export default function GeneradorReportes() {
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [dsKey, setDsKey] = useState('empleados');
  const [data, setData] = useState<DatasetResp | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [empresa, setEmpresa] = useState('');
  const [q, setQ] = useState('');
  const [ordenPor, setOrdenPor] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [filtrarPer, setFiltrarPer] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const nombreRef = useRef<HTMLInputElement>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [mostrarTotales, setMostrarTotales] = useState(true);
  const [subtotalEmpresa, setSubtotalEmpresa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tramoMap, setTramoMap] = useState<Record<string, string>>({});
  const [calcs, setCalcs] = useState<Calc[]>([]);
  const [cNombre, setCNombre] = useState('');
  const [cFormula, setCFormula] = useState('');
  const [cErr, setCErr] = useState('');
  const [defs, setDefs] = useState<{ id: number; nombre: string; config: any }[]>([]);
  const [defId, setDefId] = useState<number | ''>('');
  const [nombreDef, setNombreDef] = useState('');
  const pendingCfg = useRef<any>(null);
  async function loadDefs() { try { setDefs(await api.get<{ id: number; nombre: string; config: any }[]>('/reportes/definiciones')); } catch { /* */ } }
  useEffect(() => { loadDefs(); }, []);

  useEffect(() => { api.get<DatasetMeta[]>('/reportes/datasets').then(setDatasets).catch(() => {}); }, []);
  useEffect(() => {
    api.get<{ tramos?: { key: string; label: string }[] }>('/escala/activa')
      .then((e) => setTramoMap(Object.fromEntries((e.tramos || []).map((t) => [t.key, t.label])))).catch(() => {});
  }, []);

  const meta = datasets.find((d) => d.key === dsKey);
  const campoDe = (k: string): Campo | undefined => data?.campos.find((c) => c[0] === k) || (calcs.find((c) => c.key === k) ? [k, calcs.find((c) => c.key === k)!.nombre, 'num'] : undefined);
  const tipoDe = (k: string) => campoDe(k)?.[2] || 'text';
  const labelDe = (k: string) => campoDe(k)?.[1] || k;
  const esCalc = (k: string) => calcs.some((c) => c.key === k);

  async function cargar() {
    setErr(''); setBusy(true);
    try {
      const p = new URLSearchParams();
      const usaPer = meta?.periodo === 'req' || (meta?.periodo === 'opt' && filtrarPer);
      if (usaPer) { p.set('anio', String(anio)); p.set('mes', String(mes)); }
      if (meta?.periodo === 'opt' && filtrarPer) p.set('periodo', '1');
      const r = await api.get<DatasetResp>(`/reportes/dataset/${dsKey}?${p}`);
      setData(r);
      const def = r.campos.slice(0, 8).map((c) => c[0]);
      setSel((prev) => prev.length && prev.every((k) => r.campos.some((c) => c[0] === k) || calcs.some((c) => c.key === k)) ? prev : def);
      setOrdenPor((prev) => prev || def[0] || (r.campos[0]?.[0] ?? ''));
    } catch (e: any) { setErr(e.message); setData(null); } finally { setBusy(false); }
  }
  // Al cambiar de dataset: resetea filtros y calculados (salvo que se esté cargando un reporte guardado).
  useEffect(() => {
    const pc = pendingCfg.current;
    setEmpresa(pc?.empresa || ''); setQ(''); setFiltrarPer(!!pc?.filtrarPer);
    let saved: Calc[] = Array.isArray(pc?.calcs) ? pc.calcs : [];
    if (!Array.isArray(pc?.calcs)) { try { saved = JSON.parse(localStorage.getItem(`rep_calc_${dsKey}`) || '[]'); } catch { saved = []; } }
    setCalcs(Array.isArray(saved) ? saved : []);
    setSel([]); setOrdenPor('');
    cargar(); /* eslint-disable-next-line */
  }, [dsKey]);
  // Cuando llegan los datos, si hay un reporte guardado pendiente, aplica sus campos/orden.
  useEffect(() => {
    const pc = pendingCfg.current;
    if (data && pc) { setSel(Array.isArray(pc.sel) ? pc.sel : []); setOrdenPor(pc.ordenPor || ''); pendingCfg.current = null; }
    /* eslint-disable-next-line */
  }, [data]);
  useEffect(() => { if (meta && meta.periodo !== 'no') cargar(); /* eslint-disable-next-line */ }, [anio, mes, filtrarPer]);
  useEffect(() => { try { localStorage.setItem(`rep_calc_${dsKey}`, JSON.stringify(calcs)); } catch { /* */ } }, [calcs, dsKey]);

  const empresas = useMemo(() => [...new Set((data?.rows || []).map((r) => r.empresa).filter(Boolean))].sort(), [data]);

  // Aplica filtros y agrega los campos calculados a cada fila.
  const filas = useMemo(() => {
    let f = data?.rows || [];
    if (empresa) f = f.filter((r) => r.empresa === empresa);
    if (q.trim()) { const ql = q.toLowerCase(); f = f.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(ql))); }
    const aug = f.map((r) => {
      const sc: Record<string, number> = {};
      for (const c of (data?.campos || [])) sc[c[0]] = Number(r[c[0]]) || 0;
      const out: any = { ...r };
      for (const c of calcs) { const v = evalFormula(c.formula, sc); out[c.key] = v; sc[c.key] = v ?? 0; }
      return out;
    });
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...aug].sort((a, b) => { const x = a[ordenPor], y = b[ordenPor]; const c = (['num', 'int'].includes(tipoDe(ordenPor)) || esCalc(ordenPor)) ? ((Number(x) || 0) - (Number(y) || 0)) : String(x ?? '').localeCompare(String(y ?? '')); return c * dir; });
  }, [data, empresa, q, ordenPor, sortDir, calcs]);

  const toggle = (k: string) => setSel((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  const selCampos = useMemo(() => sel.filter((k) => data?.campos.some((c) => c[0] === k) || calcs.some((c) => c.key === k)), [sel, data, calcs]);
  const selNum = useMemo(() => selCampos.filter((k) => ['num', 'int'].includes(tipoDe(k)) || esCalc(k)), [selCampos, data, calcs]);
  const hayEmpresa = useMemo(() => selCampos.includes('empresa') && (data?.campos || []).some((c) => c[0] === 'empresa'), [selCampos, data]);
  const labelIdx = useMemo(() => { const i = selCampos.findIndex((k) => !(['num', 'int'].includes(tipoDe(k)) || esCalc(k))); return i < 0 ? 0 : i; }, [selCampos]);
  const sumar = (rows: any[]) => { const o: any = {}; for (const k of selNum) o[k] = rows.reduce((a, r) => a + (Number(r[k]) || 0), 0); return o; };
  function moverCampo(k: string, dir: -1 | 1) { setSel((p) => { const arr = [...p]; const i = arr.indexOf(k); const j = i + dir; if (i < 0 || j < 0 || j >= arr.length) return p; [arr[i], arr[j]] = [arr[j], arr[i]]; return arr; }); }
  const filasVista = useMemo(() => {
    const out: { kind: 'data' | 'subtotal' | 'total'; r: any; label?: string }[] = [];
    if (subtotalEmpresa && hayEmpresa) {
      const groups: Record<string, any[]> = {};
      for (const r of filas) (groups[r.empresa || '—'] ||= []).push(r);
      for (const emp of Object.keys(groups).sort()) { for (const r of groups[emp]) out.push({ kind: 'data', r }); out.push({ kind: 'subtotal', r: sumar(groups[emp]), label: `Subtotal ${emp}` }); }
    } else { for (const r of filas) out.push({ kind: 'data', r }); }
    if ((mostrarTotales || subtotalEmpresa) && filas.length) out.push({ kind: 'total', r: sumar(filas), label: 'TOTAL' });
    return out;
  }, [filas, subtotalEmpresa, mostrarTotales, hayEmpresa, selNum]);

  function agregarCalc() {
    setCErr('');
    if (!cNombre.trim() || !cFormula.trim()) { setCErr('Poné nombre y fórmula'); return; }
    // validación: evaluar con un scope de 1s para detectar tokens inválidos
    const sc: Record<string, number> = {};
    for (const c of (data?.campos || [])) sc[c[0]] = 1;
    for (const c of calcs) sc[c.key] = 1;
    if (evalFormula(cFormula, sc) == null) { setCErr('Fórmula inválida (revisá paréntesis/operadores)'); return; }
    const n = calcs.length + 1;
    const key = `c${n}`;
    setCalcs((p) => [...p, { key, nombre: cNombre.trim(), formula: cFormula.trim() }]);
    setSel((p) => [...p, key]);
    setCNombre(''); setCFormula('');
  }
  function quitarCalc(key: string) { setCalcs((p) => p.filter((c) => c.key !== key)); setSel((p) => p.filter((k) => k !== key)); }

  const buildConfig = () => ({ dsKey, sel, empresa, ordenPor, filtrarPer, calcs });
  function aplicarDef(cfg: any) {
    if (!cfg) return;
    pendingCfg.current = cfg;
    if (cfg.dsKey && cfg.dsKey !== dsKey) { setDsKey(cfg.dsKey); }
    else { setEmpresa(cfg.empresa || ''); setFiltrarPer(!!cfg.filtrarPer); setCalcs(Array.isArray(cfg.calcs) ? cfg.calcs : []); cargar(); }
  }
  async function guardarDef(comoNuevo: boolean) {
    const nombre = nombreDef.trim();
    if (!nombre) { setOkMsg(''); setErr('Escribí un nombre para el reporte en el campo «Nombre del reporte…» y volvé a tocar Guardar.'); nombreRef.current?.focus(); return; }
    try {
      const body: any = { nombre, config: buildConfig() };
      if (!comoNuevo && defId) body.id = defId;
      const r = await api.post<{ id: number }>('/reportes/definiciones', body);
      await loadDefs(); setDefId(r.id); setNombreDef(nombre); setErr(''); setOkMsg(`Reporte «${nombre}» guardado ✓`);
    } catch (e: any) { setOkMsg(''); setErr(e.message); }
  }
  async function eliminarDef() {
    if (!defId) return; const d = defs.find((x) => x.id === defId);
    if (!window.confirm(`¿Eliminar el reporte guardado "${d?.nombre}"?`)) return;
    try { await api.del(`/reportes/definiciones/${defId}`); setDefId(''); await loadDefs(); } catch (e: any) { setErr(e.message); }
  }

  function fmt(r: any, k: string) {
    const v = r[k];
    if (esCalc(k)) return v == null ? '—' : '$ ' + $(v);
    if (v == null || v === '') return '—';
    if (k === 'tramo') return tramoMap[String(v)] || String(v);
    const t = tipoDe(k);
    if (t === 'num') return '$ ' + $(v);
    if (t === 'int') return String(Math.round(Number(v)));
    if (t === 'date') return String(v).slice(0, 10);
    if (t === 'bool') return v === true || v === 't' || v === 'true' ? 'Sí' : 'No';
    return String(v);
  }

  // Valor tipado de una celda para exportar (números como number, resto como texto).
  function valExport(r: any, k: string): any {
    const v = r[k]; const t = tipoDe(k);
    if (v == null || v === '') return '';
    if (esCalc(k)) return Number(v) || 0;
    if (k === 'tramo') return tramoMap[String(v)] || String(v);
    if (t === 'num') return Number(v) || 0;
    if (t === 'int') return Math.round(Number(v) || 0);
    if (t === 'bool') return (v === true || v === 't' || v === 'true') ? 'Sí' : 'No';
    if (t === 'date') return String(v).slice(0, 10);
    return String(v);
  }
  const esNum = (k: string) => ['num', 'int'].includes(tipoDe(k)) || esCalc(k);
  // Matriz de exportación (incluye filas de subtotal/total).
  function filasExport(): any[][] {
    return filasVista.map((fv) => selCampos.map((k, ci) => {
      if (fv.kind === 'data') return valExport(fv.r, k);
      if (esNum(k)) return Number(fv.r[k]) || 0;
      return ci === labelIdx ? (fv.label || '') : '';
    }));
  }
  const sufPeriodo = () => (meta && (meta.periodo === 'req' || (meta.periodo === 'opt' && filtrarPer))) ? `_${anio}-${String(mes).padStart(2, '0')}` : '';

  function csv() {
    if (!data) return;
    const head = selCampos.map(labelDe);
    const lines = filasExport().map((row) => row.map((s) => `"${String(s).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `reporte_${dsKey}${sufPeriodo()}.csv`; a.click();
  }

  function excel() {
    if (!data) return;
    const aoa = [selCampos.map(labelDe), ...filasExport()];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = selCampos.map((k) => ({ wch: Math.max(10, labelDe(k).length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `reporte_${dsKey}${sufPeriodo()}.xlsx`);
  }

  const numKeys = (data?.campos || []).filter((c) => c[2] === 'num' || c[2] === 'int').map((c) => c[0]);

  return (
    <>
      <div className="card" style={{ marginBottom: 12, padding: '10px 12px' }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <b style={{ fontSize: 13 }}>Reportes:</b>
          <select className="input" style={{ maxWidth: 240 }} value={defId} onChange={(e) => { const id = e.target.value ? Number(e.target.value) : ''; setDefId(id); const d = defs.find((x) => x.id === id); if (d) { setNombreDef(d.nombre); aplicarDef(d.config); } else { setNombreDef(''); } }}>
            <option value="">— Elegí un reporte guardado —</option>
            {defs.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          <button className="btn ghost" onClick={() => { setDefId(''); setNombreDef(''); setErr(''); setOkMsg('Nuevo reporte: elegí el dataset y los campos, escribí un nombre acá al lado y tocá Guardar.'); setTimeout(() => nombreRef.current?.focus(), 0); }}>➕ Nuevo</button>
          <input ref={nombreRef} className="input" style={{ maxWidth: 220 }} placeholder="Nombre del reporte…" value={nombreDef} onChange={(e) => setNombreDef(e.target.value)} />
          <button className="btn" onClick={() => guardarDef(false)}>💾 Guardar</button>
          <button className="btn ghost" onClick={() => guardarDef(true)}>Guardar como nuevo</button>
          {defId !== '' && <button className="btn ghost" onClick={eliminarDef}>🗑 Eliminar</button>}
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Nuevo → elegí el dataset y tildá los campos; abajo podés agregar columnas calculadas con nombre; poné un nombre arriba y «Guardar».</div>
      </div>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {datasets.map((d) => <button key={d.key} className={`btn ${dsKey === d.key ? '' : 'ghost'}`} style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => { setDefId(''); setDsKey(d.key); }}>{d.label}</button>)}
      </div>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {okMsg && <div className="ok" style={{ marginBottom: 12 }}>✓ {okMsg}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        {meta && meta.periodo !== 'no' && (
          <div className="row" style={{ gap: 10, marginBottom: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {meta.periodo === 'opt' && (
              <label className="row muted" style={{ gap: 6, paddingBottom: 8 }}>
                <input type="checkbox" checked={filtrarPer} onChange={(e) => setFiltrarPer(e.target.checked)} /> Filtrar por período
              </label>
            )}
            <div className="field"><label>Mes</label><select className="input" value={mes} disabled={meta.periodo === 'opt' && !filtrarPer} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
            <div className="field"><label>Año</label><input className="input" type="number" style={{ width: 100 }} disabled={meta.periodo === 'opt' && !filtrarPer} value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
            <span className="muted" style={{ fontSize: 12, paddingBottom: 8 }}>{meta.periodo === 'req' ? 'Datos del período seleccionado.' : (filtrarPer ? 'Vigentes / movimientos del mes seleccionado.' : 'Sin filtro de período (todos los registros).')}</span>
          </div>
        )}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
          <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Campos a incluir <span style={{ textTransform: 'none' }}>({selCampos.length} de {(data?.campos || []).length + calcs.length})</span></span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" style={{ padding: '2px 10px', fontSize: 11 }} onClick={() => setSel([...(data?.campos || []).map((c) => c[0]), ...calcs.map((c) => c.key)])}>Todos</button>
            <button className="btn ghost" style={{ padding: '2px 10px', fontSize: 11 }} onClick={() => setSel([])}>Ninguno</button>
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(data?.campos || []).map(([k, l]) => (
            <label key={k} className="badge" style={{ cursor: 'pointer', background: sel.includes(k) ? 'var(--accent-glow, rgba(61,127,255,.15))' : 'var(--bg2)', border: `1px solid ${sel.includes(k) ? 'var(--accent2)' : 'var(--border)'}` }}>
              <input type="checkbox" style={{ marginRight: 4 }} checked={sel.includes(k)} onChange={() => toggle(k)} />{l}
            </label>
          ))}
          {calcs.map((c) => (
            <label key={c.key} className="badge" style={{ cursor: 'pointer', background: sel.includes(c.key) ? 'rgba(168,85,247,.18)' : 'var(--bg2)', border: `1px solid ${sel.includes(c.key) ? 'rgb(168,85,247)' : 'var(--border)'}` }}>
              <input type="checkbox" style={{ marginRight: 4 }} checked={sel.includes(c.key)} onChange={() => toggle(c.key)} />ƒ {c.nombre}
            </label>
          ))}
        </div>
        <div className="row" style={{ gap: 12, marginTop: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field"><label>Empresa</label>
            <select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select>
          </div>
          <div className="field"><label>Buscar</label><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="texto" /></div>
          <div className="field"><label>Ordenar por</label>
            <select className="input" value={ordenPor} onChange={(e) => setOrdenPor(e.target.value)}>{selCampos.map((k) => <option key={k} value={k}>{labelDe(k)}</option>)}</select>
          </div>
          <label className="row muted" style={{ gap: 6, paddingBottom: 8, fontSize: 13 }} title="Fila con la suma de las columnas numéricas"><input type="checkbox" checked={mostrarTotales} onChange={(e) => setMostrarTotales(e.target.checked)} /> Totales</label>
          {hayEmpresa && <label className="row muted" style={{ gap: 6, paddingBottom: 8, fontSize: 13 }} title="Agrupa por empresa con subtotales"><input type="checkbox" checked={subtotalEmpresa} onChange={(e) => setSubtotalEmpresa(e.target.checked)} /> Subtotales x empresa</label>}
          <button className="btn ghost" onClick={csv} disabled={!filas.length}>⬇ CSV</button>
          <button className="btn" onClick={excel} disabled={!filas.length}>⬇ Excel</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Campos calculados (fórmulas)</div>
        <div className="row" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field"><label>Nombre de la columna</label><input className="input" value={cNombre} onChange={(e) => setCNombre(e.target.value)} placeholder="Ej.: Costo neto" /></div>
          <div className="field" style={{ flex: 1, minWidth: 260 }}><label>Fórmula</label><input className="input" value={cFormula} onChange={(e) => setCFormula(e.target.value)} placeholder="Ej.: bruto - neto   ·   costoTotal / empleados   ·   remun * 0.11" /></div>
          <button className="btn ghost" onClick={agregarCalc}>+ Agregar campo</button>
        </div>
        {cErr && <div className="err" style={{ marginTop: 8 }}>⚠ {cErr}</div>}
        {!!numKeys.length && (
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Campos numéricos disponibles: {numKeys.map((k) => <code key={k} style={{ marginRight: 6 }}>{k}</code>)}
            {calcs.length > 0 && <> · calculados: {calcs.map((c) => <code key={c.key} style={{ marginRight: 6 }}>{c.key}</code>)}</>}
          </div>
        )}
        {calcs.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {calcs.map((c) => (
              <div key={c.key} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span><b style={{ color: 'rgb(168,85,247)' }}>ƒ {c.nombre}</b> <span className="muted" style={{ fontFamily: 'monospace' }}>({c.key}) = {c.formula}</span></span>
                <button className="btn ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => quitarCalc(c.key)}>Quitar</button>
              </div>
            ))}
          </div>
        )}
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Operadores: + − * / % y paréntesis. Las columnas calculadas se incluyen en la tabla y el CSV, y quedan guardadas para este reporte.</div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr>{selCampos.map((k) => (
            <th key={k} style={{ textAlign: esNum(k) ? 'right' : 'left', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
                title="Clic para ordenar · ◀ ▶ para mover la columna"
                onClick={() => { if (ordenPor === k) setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); else { setOrdenPor(k); setSortDir('asc'); } }}>
              <span style={{ opacity: .45, marginRight: 4 }} onClick={(e) => { e.stopPropagation(); moverCampo(k, -1); }}>◀</span>
              {labelDe(k)}{ordenPor === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
              <span style={{ opacity: .45, marginLeft: 4 }} onClick={(e) => { e.stopPropagation(); moverCampo(k, 1); }}>▶</span>
            </th>
          ))}</tr></thead>
          <tbody>
            {filasVista.map((fv, i) => {
              if (fv.kind === 'data') return (
                <tr key={i}>{selCampos.map((k) => <td key={k} style={{ textAlign: esNum(k) ? 'right' : 'left', fontFamily: esNum(k) ? 'monospace' : undefined }}>{fmt(fv.r, k)}</td>)}</tr>
              );
              const esTotal = fv.kind === 'total';
              return (
                <tr key={i} style={{ fontWeight: 500, background: esTotal ? 'var(--accent-glow, rgba(61,127,255,.12))' : 'var(--bg2)', borderTop: '2px solid var(--border)' }}>
                  {selCampos.map((k, ci) => esNum(k)
                    ? <td key={k} style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(fv.r, k)}</td>
                    : <td key={k}>{ci === labelIdx ? fv.label : ''}</td>)}
                </tr>
              );
            })}
            {!filas.length && <tr><td colSpan={selCampos.length || 1} className="muted" style={{ textAlign: 'center', padding: 24 }}>{busy ? 'Cargando…' : 'Sin datos'}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>{filas.length} fila(s){data ? ` · ${data.label}` : ''}</p>
    </>
  );
}
