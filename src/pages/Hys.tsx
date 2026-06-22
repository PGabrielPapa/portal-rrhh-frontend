import { useEffect, useMemo, useState } from 'react';
import { api, fetchBlob } from '../lib/api';
import * as XLSX from 'xlsx';

const hoy = () => new Date().toISOString().slice(0, 10);
const fmt = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR') : '—';
function vence(fecha: string, meses?: number | null) {
  if (!meses) return null;
  const d = new Date(String(fecha).slice(0, 10) + 'T12:00:00'); d.setMonth(d.getMonth() + meses);
  return d;
}

interface CapTipo { codigo: string; nombre: string; obligatorio: boolean; vigencia_meses: number | null; }
interface EppTipo { codigo: string; nombre: string; categoria: string; }
interface TalleTipo { codigo: string; nombre: string; }
interface Alertas { sinInduccion: boolean; sinTalles: boolean; porVencer: boolean; vencida: boolean; eppPorVencer: boolean; eppVencido: boolean; }
interface Alerta { empleadoId: number; empresa: string; legNum: string; nom: string; lugar: string; tipo: string; item: string; fecha: string; vence: string; dias: number; estado: string; }
interface EmpRow { id: number; empresa: string; legNum: string; nom: string; cuil?: string; lugar: string; tarea: string; talles: boolean; induccion: string | null; capacit: number; epp12m: number; ultimaCap: string | null; alertas: Alertas; tieneAlerta: boolean; }
interface Grupo { empresa: string; empleados: EmpRow[]; }

export default function Hys() {
  const [vista, setVista] = useState<'dash' | 'alert' | 'cat' | 'man'>('dash');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [aEstado, setAEstado] = useState('');
  const [aTipo, setATipo] = useState('');
  const [cat, setCat] = useState<{ capacitaciones: CapTipo[]; epp: EppTipo[]; talles: TalleTipo[] }>({ capacitaciones: [], epp: [], talles: [] });
  const [empresa, setEmpresa] = useState('');
  const [centro, setCentro] = useState('');
  const [q, setQ] = useState('');
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [sel, setSel] = useState<EmpRow | null>(null);
  const [manuales, setManuales] = useState<any[]>([]);
  const [mform, setMform] = useState<Record<string, any>>({});
  const [marchivo, setMarchivo] = useState<File | null>(null);
  const [cform, setCform] = useState<Record<string, any>>({});
  const [carchivo, setCarchivo] = useState<File | null>(null);
  const [acusesDoc, setAcusesDoc] = useState<any | null>(null);
  const [acusesList, setAcusesList] = useState<any[]>([]);
  const [err, setErr] = useState('');

  async function load() {
    try { const d = await api.get<{ empresas: Grupo[]; alertas: Alerta[] }>('/hys/dashboard'); setGrupos(d.empresas || []); setAlertas(d.alertas || []); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); api.get('/hys/catalogos').then(setCat as any).catch(() => {}); loadManuales(); }, []);

  const todos = useMemo(() => grupos.flatMap((g) => g.empleados), [grupos]);
  const empresas = useMemo(() => [...new Set(todos.map((e) => e.empresa))].sort(), [todos]);
  const centros = useMemo(() => [...new Set(todos.map((e) => e.lugar).filter(Boolean))].sort(), [todos]);

  const filtrados = useMemo(() => todos.filter((e) => {
    if (empresa && e.empresa !== empresa) return false;
    if (centro && e.lugar !== centro) return false;
    if (q.trim() && !`${e.nom} ${e.legNum} ${e.cuil || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (soloAlertas && !e.tieneAlerta) return false;
    return true;
  }), [todos, empresa, centro, q, soloAlertas]);

  const kpis = useMemo(() => ({
    total: filtrados.length,
    sinTalles: filtrados.filter((e) => !e.talles).length,
    sinInduccion: filtrados.filter((e) => !e.induccion).length,
    porVencer: filtrados.filter((e) => e.alertas.porVencer).length,
    vencidas: filtrados.filter((e) => e.alertas.vencida).length,
    eppPorVencer: filtrados.filter((e) => e.alertas.eppPorVencer).length,
    eppVencidas: filtrados.filter((e) => e.alertas.eppVencido).length,
  }), [filtrados]);

  const porEmpresa = useMemo(() => {
    const m: Record<string, EmpRow[]> = {};
    for (const e of filtrados) (m[e.empresa] ||= []).push(e);
    return Object.entries(m);
  }, [filtrados]);

  const alertasF = useMemo(() => alertas.filter((a) => {
    if (empresa && a.empresa !== empresa) return false;
    if (centro && a.lugar !== centro) return false;
    if (q.trim() && !`${a.nom} ${a.legNum}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (aEstado && a.estado !== aEstado) return false;
    if (aTipo && a.tipo !== aTipo) return false;
    return true;
  }), [alertas, empresa, centro, q, aEstado, aTipo]);

  function exportar() {
    const head = 'Empresa,Legajo,Nombre,CUIL,Centro,Tarea,Talles cargados,Inducción,Capacitaciones,EPP (12m),Última capacitación,Alertas';
    const lines = filtrados.map((e) => {
      const al = [e.alertas.sinInduccion && 'sin inducción', e.alertas.sinTalles && 'sin talles', e.alertas.porVencer && 'cap. por vencer', e.alertas.vencida && 'cap. vencida'].filter(Boolean).join('; ');
      return [e.empresa, e.legNum, e.nom, e.cuil || '', e.lugar, e.tarea, e.talles ? 'Sí' : 'No', e.induccion || '', e.capacit, e.epp12m, e.ultimaCap || '', al].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',');
    });
    const blob = new Blob(['﻿' + [head, ...lines].join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hys_consolidado.csv'; a.click();
  }

  function exportarAlertas() {
    const head = 'Vence,Estado,Tipo,Item,Empleado,Legajo,Empresa,Centro,Dias';
    const lines = alertasF.map((a) => [a.vence, a.estado === 'vencida' ? 'Vencida' : 'Por vencer', a.tipo, a.item, a.nom, a.legNum, a.empresa, a.lugar, a.dias].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob(['\ufeff' + [head, ...lines].join('\r\n')], { type: 'text/csv' });
    const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = 'hys_alertas.csv'; el.click();
  }

  async function loadManuales() { try { setManuales(await api.get<any[]>('/hys/manuales')); } catch { /* */ } }
  async function importarCat(tipo: string, file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const r = await api.post<{ importados: number }>('/hys/catalogo/import', { tipo, rows });
      const c = await api.get('/hys/catalogos'); setCat(c as any);
      alert(`Importados ${r.importados} ítems.`);
    } catch (e: any) { setErr('Import: ' + e.message); }
  }
  async function delCat(tipo: string, codigo: string) { await api.del(`/hys/catalogo/${tipo}/${encodeURIComponent(codigo)}`); const c = await api.get('/hys/catalogos'); setCat(c as any); }
  async function subirManual(e: React.FormEvent) {
    e.preventDefault();
    if (!mform.titulo) { setErr('El manual necesita un título.'); return; }
    const fd = new FormData();
    fd.append('titulo', mform.titulo || ''); fd.append('categoria', mform.categoria || ''); fd.append('descripcion', mform.descripcion || '');
    fd.append('visibleEmpleado', mform.visible ? '1' : '0');
    fd.append('tipo', 'manual');
    if (marchivo) fd.append('archivo', marchivo);
    try { await api.postForm('/hys/manuales', fd); setMform({}); setMarchivo(null); loadManuales(); }
    catch (e: any) { setErr(e.message); }
  }
  async function subirCatDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!cform.titulo) { setErr('El documento necesita un título.'); return; }
    const fd = new FormData();
    fd.append('tipo', 'catalogo');
    fd.append('titulo', cform.titulo || ''); fd.append('categoria', cform.categoria || ''); fd.append('descripcion', cform.descripcion || '');
    fd.append('visibleEmpleado', cform.visible ? '1' : '0');
    if (carchivo) fd.append('archivo', carchivo);
    try { await api.postForm('/hys/manuales', fd); setCform({}); setCarchivo(null); loadManuales(); }
    catch (e: any) { setErr(e.message); }
  }
  async function verManual(m: any) { try { const b = await fetchBlob(`/hys/manuales/${m.id}/descargar`); window.open(URL.createObjectURL(b), '_blank'); } catch { /* */ } }
  async function descManual(m: any) { try { const b = await fetchBlob(`/hys/manuales/${m.id}/descargar`); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = m.filename || m.titulo; a.click(); } catch { /* */ } }
  async function toggleVis(m: any) { await api.patch(`/hys/manuales/${m.id}`, { visibleEmpleado: !m.visible_empleado }); loadManuales(); }
  async function delManual(m: any) { if (!confirm('¿Eliminar este manual?')) return; await api.del(`/hys/manuales/${m.id}`); loadManuales(); }
  async function verAcuses(m: any) { setAcusesDoc(m); try { setAcusesList(await api.get<any[]>(`/hys/manuales/${m.id}/acuses`)); } catch { setAcusesList([]); } }

  const docsCatalogo = manuales.filter((m) => (m.tipo || 'manual') === 'catalogo');
  const docsManuales = manuales.filter((m) => (m.tipo || 'manual') === 'manual');
  const Kpi = ({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) => (
    <div className="card" style={{ flex: 1, minWidth: 180 }}>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: color || 'inherit', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 8 }}>
          <button className={`btn ${vista === 'dash' ? '' : 'ghost'}`} onClick={() => setVista('dash')}>📊 Dashboard</button>
          <button className={`btn ${vista === 'alert' ? '' : 'ghost'}`} onClick={() => setVista('alert')}>🔔 Alertas{alertas.length ? ` (${alertas.length})` : ''}</button>
          <button className={`btn ${vista === 'cat' ? '' : 'ghost'}`} onClick={() => setVista('cat')}>📋 Catálogos</button>
          <button className={`btn ${vista === 'man' ? '' : 'ghost'}`} onClick={() => setVista('man')}>📁 Manuales</button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost" onClick={() => alert('Importación de Excel: definí el formato de columnas con RR.HH. y lo conecto (talles / capacitaciones / EPP).')}>↑ Importar Excel</button>
          <button className="btn ghost" onClick={exportar}>↓ Exportar consolidado</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14, fontSize: 13, background: 'rgba(234,179,8,.06)', border: '1px solid rgba(234,179,8,.3)' }}>
        🚨 <b>Marco normativo:</b> Ley 19.587 (Higiene y Seguridad en el Trabajo) · Ley 24.557 (Riesgos del Trabajo) · Res. SRT 905/2015 (capacitaciones obligatorias) · Res. SRT 299/2011 (constancia de entrega de EPP).
      </div>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}

      {vista === 'dash' && (
        <>
          <div className="row" style={{ gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <Kpi label="Total empleados" value={kpis.total} />
            <Kpi label="Sin talles cargados" value={kpis.sinTalles} color="var(--yellow)" />
            <Kpi label="Sin inducción inicial" value={kpis.sinInduccion} color="var(--yellow)" />
            <Kpi label="Capacit. por vencer" value={kpis.porVencer} sub="Empleados afectados (≤30 días)" color="var(--yellow)" />
            <Kpi label="Capacit. vencidas" value={kpis.vencidas} sub="Empleados afectados" color="var(--red)" />
            <Kpi label="EPP por vencer" value={kpis.eppPorVencer} sub="Empleados afectados (≤30 días)" color="var(--yellow)" />
            <Kpi label="EPP vencidos" value={kpis.eppVencidas} sub="Empleados afectados" color="var(--red)" />
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="field" style={{ marginBottom: 10 }}>
              <select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas las empresas</option>{empresas.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            </div>
            <div className="field" style={{ marginBottom: 10 }}>
              <select className="input" value={centro} onChange={(e) => setCentro(e.target.value)}><option value="">Todos los centros</option>{centros.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            </div>
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              <input className="input" style={{ flex: 1 }} placeholder="Buscar por nombre, legajo o CUIL…" value={q} onChange={(e) => setQ(e.target.value)} />
              <label className="row muted" style={{ gap: 6, whiteSpace: 'nowrap' }}><input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} /> Solo con alertas</label>
              <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{filtrados.length} resultados</span>
            </div>
          </div>

          {porEmpresa.map(([emp, list]) => (
            <div key={emp} style={{ marginBottom: 14 }}>
              <div className="muted" style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: '.05em', margin: '6px 0' }}>🏢 {emp} · {list.length} empleados</div>
              <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                <table>
                  <thead><tr><th>Empleado</th><th style={{ textAlign: 'center' }}>Talles</th><th style={{ textAlign: 'center' }}>Capacit.</th><th style={{ textAlign: 'center' }}>EPP (12M)</th><th style={{ textAlign: 'center' }}>Última cap.</th></tr></thead>
                  <tbody>
                    {list.map((e) => (
                      <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setSel(e)}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{e.nom}
                            {e.alertas.sinInduccion && <span className="badge" style={{ marginLeft: 8, color: 'rgb(168,85,247)', border: '1px solid rgba(168,85,247,.5)' }}>⚠ SIN INDUCCIÓN</span>}
                            {e.alertas.vencida && <span className="badge" style={{ marginLeft: 6, color: 'var(--red)', border: '1px solid rgba(239,68,68,.5)' }}>CAP. VENCIDA</span>}
                            {e.alertas.porVencer && <span className="badge" style={{ marginLeft: 6, color: 'var(--yellow)', border: '1px solid rgba(234,179,8,.5)' }}>POR VENCER</span>}
                            {e.alertas.eppVencido && <span className="badge" style={{ marginLeft: 6, color: 'var(--red)', border: '1px solid rgba(239,68,68,.5)' }}>EPP VENCIDO</span>}
                            {e.alertas.eppPorVencer && <span className="badge" style={{ marginLeft: 6, color: 'var(--yellow)', border: '1px solid rgba(234,179,8,.5)' }}>EPP POR VENCER</span>}
                          </div>
                          <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{e.legNum} · {e.cuil || '—'} · 📍 {e.lugar || '—'} · {e.tarea || '—'}</div>
                        </td>
                        <td style={{ textAlign: 'center', color: e.talles ? 'var(--green)' : 'var(--yellow)' }}>{e.talles ? '✓' : '—'}</td>
                        <td style={{ textAlign: 'center' }}>{e.capacit}</td>
                        <td style={{ textAlign: 'center' }}>{e.epp12m}</td>
                        <td style={{ textAlign: 'center', fontSize: 12 }}>{fmt(e.ultimaCap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {!filtrados.length && <div className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin empleados para el filtro.</div>}
        </>
      )}

      {vista === 'alert' && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field"><label>Empresa</label><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{empresas.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
              <div className="field"><label>Tipo</label><select className="input" value={aTipo} onChange={(e) => setATipo(e.target.value)}><option value="">Todos</option><option value="Capacitación">Capacitación</option><option value="EPP">EPP</option></select></div>
              <div className="field"><label>Estado</label><select className="input" value={aEstado} onChange={(e) => setAEstado(e.target.value)}><option value="">Todos</option><option value="vencida">Vencidas</option><option value="por_vencer">Por vencer (≤30 días)</option></select></div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}><label>Buscar</label><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="nombre o legajo" /></div>
              <button className="btn ghost" onClick={exportarAlertas} disabled={!alertasF.length}>↓ CSV</button>
              <span className="muted" style={{ fontSize: 12, paddingBottom: 8 }}>{alertasF.length} alertas</span>
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead><tr><th>Vence</th><th>Estado</th><th>Tipo</th><th>Ítem</th><th>Empleado</th><th>Empresa / centro</th></tr></thead>
              <tbody>
                {alertasF.map((a, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12 }}>{fmt(a.vence)}</td>
                    <td>{a.estado === 'vencida'
                      ? <span className="badge" style={{ color: 'var(--red)', border: '1px solid rgba(239,68,68,.5)' }}>Vencida hace {Math.abs(a.dias)}d</span>
                      : <span className="badge" style={{ color: 'var(--yellow)', border: '1px solid rgba(234,179,8,.5)' }}>Vence en {a.dias}d</span>}</td>
                    <td>{a.tipo}</td>
                    <td>{a.item}</td>
                    <td>{a.nom} <span className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>· {a.legNum}</span></td>
                    <td className="muted" style={{ fontSize: 12 }}>{a.empresa}{a.lugar ? ` · ${a.lugar}` : ''}</td>
                  </tr>
                ))}
                {!alertasF.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin vencimientos próximos ni vencidos. 🎉</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {vista === 'cat' && (
        <>
        <div className="grid2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ marginTop: 0 }}>Capacitaciones (Res. SRT 905/2015)</h3>
              <label className="btn ghost" style={{ cursor: 'pointer', fontSize: 12, padding: '3px 10px' }}>↑ Importar<input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importarCat('capacitacion', f); (e.target as HTMLInputElement).value = ''; }} /></label>
            </div>
            {cat.capacitaciones.map((c) => (
              <div key={c.codigo} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span>{c.nombre} {c.obligatorio && <span className="muted">· obligatoria</span>}</span>
                <span className="row" style={{ gap: 8 }}><span className="muted">{c.vigencia_meses ? `vence ${c.vigencia_meses}m` : 'sin venc.'}</span><button className="btn ghost" style={{ padding: '1px 7px', fontSize: 11 }} onClick={() => delCat('capacitacion', c.codigo)}>✕</button></span>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Excel/CSV con columnas: <code>nombre</code>, <code>obligatorio</code> (sí/no), <code>vigencia_meses</code>.</div>
          </div>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ marginTop: 0 }}>EPP (Res. SRT 299/2011)</h3>
              <label className="btn ghost" style={{ cursor: 'pointer', fontSize: 12, padding: '3px 10px' }}>↑ Importar<input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importarCat('epp', f); (e.target as HTMLInputElement).value = ''; }} /></label>
            </div>
            {cat.epp.map((c) => (
              <div key={c.codigo} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span>{c.nombre} <span className="muted">· {c.categoria}</span></span>
                <button className="btn ghost" style={{ padding: '1px 7px', fontSize: 11 }} onClick={() => delCat('epp', c.codigo)}>✕</button>
              </div>
            ))}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <h4 style={{ margin: 0 }}>Talles</h4>
              <label className="btn ghost" style={{ cursor: 'pointer', fontSize: 12, padding: '3px 10px' }}>↑ Importar<input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importarCat('talle', f); (e.target as HTMLInputElement).value = ''; }} /></label>
            </div>
            <div style={{ marginTop: 6 }}>{cat.talles.map((t) => <span key={t.codigo} className="badge" style={{ marginRight: 6 }}>{t.nombre} <button className="btn ghost" style={{ padding: '0 5px', fontSize: 10 }} onClick={() => delCat('talle', t.codigo)}>✕</button></span>)}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Excel/CSV con columna <code>nombre</code> (y <code>categoria</code> en EPP).</div>
          </div>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>Documentos del catálogo (PDF, Word, etc.)</h3>
          <form onSubmit={subirCatDoc} className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Título *</label><input className="input" value={cform.titulo || ''} onChange={(e) => setCform({ ...cform, titulo: e.target.value })} /></div>
            <div className="field"><label>Categoría</label><input className="input" value={cform.categoria || ''} onChange={(e) => setCform({ ...cform, categoria: e.target.value })} placeholder="Catálogo EPP, listado de talles…" /></div>
            <div className="field"><label>Archivo</label><input className="input" type="file" onChange={(e) => setCarchivo(e.target.files?.[0] || null)} /></div>
            <label className="row muted" style={{ gap: 6, paddingBottom: 8 }}><input type="checkbox" checked={!!cform.visible} onChange={(e) => setCform({ ...cform, visible: e.target.checked })} /> Visible para empleados</label>
            <button className="btn">Subir</button>
          </form>
          {docsCatalogo.map((m) => (
            <div key={m.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div><b>{m.titulo}</b> {m.categoria && <span className="muted">· {m.categoria}</span>} {m.visible_empleado ? <span className="badge" style={{ color: 'var(--green)', border: '1px solid rgba(34,197,94,.4)' }}>visible</span> : <span className="badge muted">interno</span>}
                <div className="muted" style={{ fontSize: 11 }}>{m.filename || 'sin archivo'}{m.tamano ? ` · ${(m.tamano / 1024).toFixed(0)} KB` : ''}</div></div>
              <div className="row" style={{ gap: 6 }}>
                {m.filename && <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => verManual(m)}>Ver</button>}
                {m.filename && <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => descManual(m)}>Descargar</button>}
                <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => verAcuses(m)}>Acuses ({m.acuses || 0})</button>
                <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => toggleVis(m)}>{m.visible_empleado ? 'Ocultar' : 'Publicar'}</button>
                <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => delManual(m)}>✕</button>
              </div>
            </div>
          ))}
          {!docsCatalogo.length && <div className="muted" style={{ fontSize: 13 }}>Sin documentos de catálogo cargados. Subí PDF/Word arriba.</div>}
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Estos documentos (y los manuales marcados como visibles) aparecen en el módulo de H&S del empleado.</div>
        </div>
        </>
      )}

      {vista === 'man' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Manuales y documentos</h3>
          <form onSubmit={subirManual} className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Título *</label><input className="input" value={mform.titulo || ''} onChange={(e) => setMform({ ...mform, titulo: e.target.value })} /></div>
            <div className="field"><label>Categoría</label><input className="input" value={mform.categoria || ''} onChange={(e) => setMform({ ...mform, categoria: e.target.value })} placeholder="Procedimientos, Plan de emergencia…" /></div>
            <div className="field"><label>Archivo (PDF, Word, etc.)</label><input className="input" type="file" onChange={(e) => setMarchivo(e.target.files?.[0] || null)} /></div>
            <label className="row muted" style={{ gap: 6, paddingBottom: 8 }}><input type="checkbox" checked={!!mform.visible} onChange={(e) => setMform({ ...mform, visible: e.target.checked })} /> Visible para empleados</label>
            <button className="btn">Subir</button>
          </form>
          {docsManuales.map((m) => (
            <div key={m.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div>
                <b>{m.titulo}</b> {m.categoria && <span className="muted">· {m.categoria}</span>} {m.visible_empleado ? <span className="badge" style={{ color: 'var(--green)', border: '1px solid rgba(34,197,94,.4)' }}>visible</span> : <span className="badge muted">interno</span>}
                <div className="muted" style={{ fontSize: 11 }}>{m.filename || 'sin archivo'}{m.tamano ? ` · ${(m.tamano / 1024).toFixed(0)} KB` : ''} · {new Date(m.created_at).toLocaleDateString('es-AR')}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {m.filename && <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => verManual(m)}>Ver</button>}
                {m.filename && <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => descManual(m)}>Descargar</button>}
                <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => verAcuses(m)}>Acuses ({m.acuses || 0})</button>
                <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => toggleVis(m)}>{m.visible_empleado ? 'Ocultar' : 'Publicar'}</button>
                <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => delManual(m)}>✕</button>
              </div>
            </div>
          ))}
          {!docsManuales.length && <div className="muted" style={{ fontSize: 13 }}>Aún no hay manuales cargados. Subí el primero arriba.</div>}
          <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>Los manuales marcados como "visible para empleados" aparecen en el módulo de Higiene y Seguridad del panel del empleado.</p>
        </div>
      )}

      {acusesDoc && (
        <div className="modal-bg" onClick={() => setAcusesDoc(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540, maxHeight: '85vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Acuses de lectura — {acusesDoc.titulo}</h3>
            {acusesList.length ? acusesList.map((a, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span>{a.nom} <span className="muted" style={{ fontFamily: 'var(--font-mono)' }}>· {a.leg_num} · {a.empresa}</span></span>
                <span className="muted">{new Date(a.fecha).toLocaleString('es-AR')}</span>
              </div>
            )) : <div className="muted" style={{ fontSize: 13 }}>Todavía nadie confirmó la lectura.</div>}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}><button className="btn" onClick={() => setAcusesDoc(null)}>Cerrar</button></div>
          </div>
        </div>
      )}

      {sel && <DetalleEmpleado emp={sel} cat={cat} onClose={() => setSel(null)} onChange={load} />}
    </>
  );
}

// ───────────────────── Detalle por empleado ─────────────────────
function DetalleEmpleado({ emp, cat, onClose, onChange }: { emp: EmpRow; cat: { capacitaciones: CapTipo[]; epp: EppTipo[]; talles: TalleTipo[] }; onClose: () => void; onChange: () => void }) {
  const [talles, setTalles] = useState<Record<string, string>>({});
  const [caps, setCaps] = useState<any[]>([]);
  const [epps, setEpps] = useState<any[]>([]);
  const [fc, setFc] = useState<Record<string, string>>({ fecha: hoy() });
  const [fe, setFe] = useState<Record<string, string>>({ fecha: hoy(), cantidad: '1' });
  const [msg, setMsg] = useState('');
  const [tHist, setTHist] = useState<any[]>([]);

  async function recargar() {
    try {
      setTalles(await api.get<Record<string, string>>(`/hys/talles/${emp.id}`));
      setCaps(await api.get<any[]>(`/hys/capacitaciones?empleadoId=${emp.id}`));
      setEpps(await api.get<any[]>(`/hys/epp?empleadoId=${emp.id}`));
      setTHist(await api.get<any[]>(`/hys/talles-historial/${emp.id}`));
    } catch { /* */ }
  }
  useEffect(() => { recargar(); /* eslint-disable-next-line */ }, [emp.id]);

  async function guardarTalles() { await api.put(`/hys/talles/${emp.id}`, talles); setMsg('Talles guardados'); onChange(); }
  async function addCap(e: React.FormEvent) {
    e.preventDefault(); if (!fc.codigo) return;
    const t = cat.capacitaciones.find((c) => c.codigo === fc.codigo);
    await api.post('/hys/capacitaciones', { empleadoId: emp.id, codigo: fc.codigo, nombre: t?.nombre || fc.codigo, fecha: fc.fecha, vigenciaMeses: t?.vigencia_meses, dictadaPor: fc.dictadaPor, observaciones: fc.observaciones });
    setFc({ fecha: hoy() }); recargar(); onChange();
  }
  async function delCap(id: number) { await api.del(`/hys/capacitaciones/${id}`); recargar(); onChange(); }
  async function addEpp(e: React.FormEvent) {
    e.preventDefault(); if (!fe.codigo) return;
    const t = cat.epp.find((c) => c.codigo === fe.codigo);
    await api.post('/hys/epp', { empleadoId: emp.id, codigo: fe.codigo, nombre: t?.nombre || fe.codigo, cantidad: Number(fe.cantidad) || 1, talle: fe.talle, fecha: fe.fecha, observaciones: fe.observaciones });
    setFe({ fecha: hoy(), cantidad: '1' }); recargar(); onChange();
  }
  async function delEpp(id: number) { await api.del(`/hys/epp/${id}`); recargar(); onChange(); }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820, maxHeight: '92vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{emp.nom} <span className="muted" style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>· {emp.legNum} · {emp.empresa} · {emp.lugar || '—'}</span></h3>
        {msg && <div className="ok" style={{ marginBottom: 10 }}>✓ {msg}</div>}

        <div className="sb-group-label">Talles (Res. SRT 299/2011)</div>
        <div className="grid2">
          {cat.talles.map((t) => (
            <div className="field" key={t.codigo}><label>{t.nombre}</label><input className="input" value={talles[t.codigo] || ''} onChange={(e) => setTalles({ ...talles, [t.codigo]: e.target.value })} /></div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={guardarTalles}>Guardar talles</button></div>
        {tHist.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Histórico de talles</div>
            {tHist.map((h) => (<div key={h.id} className="muted" style={{ fontSize: 12, padding: '2px 0', borderBottom: '1px solid var(--border)' }}>{new Date(h.created_at).toLocaleString('es-AR')} · {h.cambios} <span style={{ opacity: .6 }}>({h.origen})</span></div>))}
          </div>
        )}

        <div className="sb-group-label" style={{ marginTop: 16 }}>Capacitaciones</div>
        <form onSubmit={addCap} className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}><label>Capacitación</label><select className="input" value={fc.codigo || ''} onChange={(e) => setFc({ ...fc, codigo: e.target.value })}><option value="">Elegir…</option>{cat.capacitaciones.map((c) => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}</select></div>
          <div className="field"><label>Fecha</label><input className="input" type="date" value={fc.fecha || ''} onChange={(e) => setFc({ ...fc, fecha: e.target.value })} /></div>
          <div className="field"><label>Dictada por</label><input className="input" value={fc.dictadaPor || ''} onChange={(e) => setFc({ ...fc, dictadaPor: e.target.value })} /></div>
          <button className="btn ghost">+ Agregar</button>
        </form>
        <div style={{ marginTop: 8 }}>
          {caps.map((c) => { const v = vence(c.fecha, c.vigencia_meses); const venc = v && v < new Date(); return (
            <div key={c.id} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{c.nombre} <span className="muted">· {fmt(c.fecha)}{v ? ` · vence ${fmt(v.toISOString())}` : ''}</span>{venc && <span className="badge" style={{ marginLeft: 6, color: 'var(--red)' }}>vencida</span>}</span>
              <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => delCap(c.id)}>✕</button>
            </div>
          ); })}
          {!caps.length && <div className="muted" style={{ fontSize: 13 }}>Sin capacitaciones registradas.</div>}
        </div>

        <div className="sb-group-label" style={{ marginTop: 16 }}>Entrega de EPP</div>
        <form onSubmit={addEpp} className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Elemento</label><select className="input" value={fe.codigo || ''} onChange={(e) => setFe({ ...fe, codigo: e.target.value })}><option value="">Elegir…</option>{cat.epp.map((c) => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}</select></div>
          <div className="field" style={{ width: 80 }}><label>Cant.</label><input className="input" type="number" value={fe.cantidad || '1'} onChange={(e) => setFe({ ...fe, cantidad: e.target.value })} /></div>
          <div className="field" style={{ width: 90 }}><label>Talle</label><input className="input" value={fe.talle || ''} onChange={(e) => setFe({ ...fe, talle: e.target.value })} /></div>
          <div className="field"><label>Fecha</label><input className="input" type="date" value={fe.fecha || ''} onChange={(e) => setFe({ ...fe, fecha: e.target.value })} /></div>
          <button className="btn ghost">+ Entregar</button>
        </form>
        <div style={{ marginTop: 8 }}>
          {epps.map((x) => (
            <div key={x.id} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{x.nombre} <span className="muted">· {x.cantidad} u{x.talle ? ` · talle ${x.talle}` : ''} · {fmt(x.fecha)}</span></span>
              <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => delEpp(x.id)}>✕</button>
            </div>
          ))}
          {!epps.length && <div className="muted" style={{ fontSize: 13 }}>Sin entregas registradas.</div>}
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="btn" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}
