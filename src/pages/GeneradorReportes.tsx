import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

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
  const [busy, setBusy] = useState(false);
  const [tramoMap, setTramoMap] = useState<Record<string, string>>({});
  const [calcs, setCalcs] = useState<Calc[]>([]);
  const [cNombre, setCNombre] = useState('');
  const [cFormula, setCFormula] = useState('');
  const [cErr, setCErr] = useState('');

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
  // Persistencia de campos calculados por dataset (localStorage).
  useEffect(() => {
    setEmpresa(''); setQ(''); setFiltrarPer(false);
    let saved: Calc[] = [];
    try { saved = JSON.parse(localStorage.getItem(`rep_calc_${dsKey}`) || '[]'); } catch { saved = []; }
    setCalcs(Array.isArray(saved) ? saved : []);
    const def: string[] = [];
    setSel(def); setOrdenPor('');
    cargar(); /* eslint-disable-next-line */
  }, [dsKey]);
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
    return [...aug].sort((a, b) => { const x = a[ordenPor], y = b[ordenPor]; if (['num', 'int'].includes(tipoDe(ordenPor))) return (Number(x) || 0) - (Number(y) || 0); return String(x ?? '').localeCompare(String(y ?? '')); });
  }, [data, empresa, q, ordenPor, calcs]);

  const toggle = (k: string) => setSel((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  const selCampos = useMemo(() => sel.filter((k) => data?.campos.some((c) => c[0] === k) || calcs.some((c) => c.key === k)), [sel, data, calcs]);

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

  function csv() {
    if (!data) return;
    const head = selCampos.map(labelDe).join(',');
    const lines = filas.map((r) => selCampos.map((k) => {
      const v = r[k]; const t = tipoDe(k);
      const s = v == null ? '' : esCalc(k) ? Number(v) : k === 'tramo' ? (tramoMap[String(v)] || String(v))
        : t === 'num' || t === 'int' ? Number(v) : t === 'bool' ? (v === true || v === 't' ? 'Sí' : 'No') : String(v);
      return `"${String(s).replace(/"/g, '""')}"`;
    }).join(','));
    const usaPer = meta && (meta.periodo === 'req' || (meta.periodo === 'opt' && filtrarPer));
    const suf = usaPer ? `_${anio}-${String(mes).padStart(2, '0')}` : '';
    const blob = new Blob(['﻿' + [head, ...lines].join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `reporte_${dsKey}${suf}.csv`; a.click();
  }

  const numKeys = (data?.campos || []).filter((c) => c[2] === 'num' || c[2] === 'int').map((c) => c[0]);

  return (
    <>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {datasets.map((d) => <button key={d.key} className={`btn ${dsKey === d.key ? '' : 'ghost'}`} style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => setDsKey(d.key)}>{d.label}</button>)}
      </div>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}

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
        <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Campos a incluir</div>
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
          <button className="btn" onClick={csv} disabled={!filas.length}>⬇ CSV</button>
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
          <thead><tr>{selCampos.map((k) => <th key={k} style={{ textAlign: ['num', 'int'].includes(tipoDe(k)) || esCalc(k) ? 'right' : 'left' }}>{labelDe(k)}</th>)}</tr></thead>
          <tbody>
            {filas.map((r, i) => (
              <tr key={i}>{selCampos.map((k) => <td key={k} style={{ textAlign: ['num', 'int'].includes(tipoDe(k)) || esCalc(k) ? 'right' : 'left', fontFamily: ['num', 'int'].includes(tipoDe(k)) || esCalc(k) ? 'monospace' : undefined }}>{fmt(r, k)}</td>)}</tr>
            ))}
            {!filas.length && <tr><td colSpan={selCampos.length || 1} className="muted" style={{ textAlign: 'center', padding: 24 }}>{busy ? 'Cargando…' : 'Sin datos'}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>{filas.length} fila(s){data ? ` · ${data.label}` : ''}</p>
    </>
  );
}
