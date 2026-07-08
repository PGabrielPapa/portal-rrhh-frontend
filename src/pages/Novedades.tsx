import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';

interface Tipo { tipo: string; label: string; unidad: string }
interface Nov { id: number; nom: string; legNum: string; empresa: string; tipo: string; tipoLabel: string; unidad: string; cantidad: number; monto: number; detalle?: string }
interface Tope { tipo: string; label: string; unidad: string; periodo: string; topeCantidad: number; topeMonto: number; bloquear: boolean }
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const $ = (n: number) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });

export default function Novedades() {
  const d = new Date();
  const [anio, setAnio] = useState(d.getFullYear());
  const [mes, setMes] = useState(d.getMonth() + 1);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [items, setItems] = useState<Nov[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showTopes, setShowTopes] = useState(false);
  const [topes, setTopes] = useState<Tope[]>([]);

  useEffect(() => { api.get<Tipo[]>('/novedades/_tipos').then(setTipos).catch(() => {}); }, []);
  useEffect(() => { api.get<Tope[]>('/novedades/topes').then(setTopes).catch(() => {}); }, []);
  function setTope(tipo: string, patch: Partial<Tope>) { setTopes((ts) => ts.map((t) => t.tipo === tipo ? { ...t, ...patch } : t)); }
  async function saveTopes() { try { await api.put('/novedades/topes', { topes }); setMsg({ t: 'Topes guardados.', ok: true }); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  async function load() { try { setItems(await api.get<Nov[]>(`/novedades?anio=${anio}&mes=${mes}`)); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [anio, mes]);

  function plantilla() {
    const ws = XLSX.utils.aoa_to_sheet([['Legajo', 'CUIL', 'Tipo', 'Cantidad', 'Monto', 'Detalle'],
      ['', '', 'he50', '10', '', 'Horas extra al 50%'], ['', '', 'otrosRemun', '', '50000', 'Premio asistencia']]);
    const wsT = XLSX.utils.aoa_to_sheet([['Tipo', 'Descripción', 'Unidad'], ...tipos.map((t) => [t.tipo, t.label, t.unidad])]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Novedades'); XLSX.utils.book_append_sheet(wb, wsT, 'Tipos válidos');
    XLSX.writeFile(wb, 'plantilla_novedades.xlsx');
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false, blankrows: false });
      if (!aoa.length) return setMsg({ t: 'El archivo no tiene datos', ok: false });
      const hdr = (aoa[0] || []).map((h) => String(h).trim());
      const rows = aoa.slice(1).filter((r) => r.some((c) => String(c).trim())).map((r) => Object.fromEntries(hdr.map((h, j) => [h, String(r[j] ?? '').trim()])));
      const reemplazar = confirm('¿Reemplazar las novedades importadas por Excel de este período? (Aceptar = reemplaza · Cancelar = agrega)');
      const res = await api.post<{ importadas: number; errores: string[]; avisos?: string[] }>('/novedades/import', { anio, mes, reemplazar, rows });
      const av = res.avisos && res.avisos.length ? ' Avisos: ' + res.avisos.slice(0, 3).join(' · ') + (res.avisos.length > 3 ? '…' : '') : '';
      setMsg({ t: `Importadas ${res.importadas}.${res.errores.length ? ' Errores: ' + res.errores.slice(0, 4).join(' · ') + (res.errores.length > 4 ? '…' : '') : ''}${av}`, ok: res.importadas > 0 });
      load();
    } catch (err: any) { setMsg({ t: 'No se pudo procesar: ' + err.message, ok: false }); }
  }
  async function desdeFichadas() {
    if (!confirm(`Generar novedades de horas extra desde las fichadas AUTORIZADAS de ${MESES[mes]} ${anio}? (reemplaza las generadas antes desde fichadas)`)) return;
    setMsg(null);
    try { const r = await api.post<{ fichadasAutorizadas: number; conExtra: number; creadas: number }>('/novedades/desde-fichadas', { anio, mes, reemplazar: true }); setMsg({ t: `Fichadas autorizadas: ${r.fichadasAutorizadas}. Novedades de horas extra generadas: ${r.creadas}.`, ok: true }); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(n: Nov) { if (!confirm('¿Eliminar esta novedad?')) return; try { await api.del(`/novedades/${n.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ marginTop: 0 }}>Cargá las novedades variables del período (horas extra, ausencias, premios, otros conceptos). Se aplican automáticamente en la liquidación de ese mes.</p>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
          <div className="field"><label>Año</label><input className="input" style={{ width: 100 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={onFile} />
          <button className="btn" onClick={() => fileRef.current?.click()}>⬆ Importar Excel</button>
          <button className="btn ghost" onClick={plantilla}>⬇ Plantilla</button>
          <button className="btn ghost" onClick={desdeFichadas}>↳ Generar desde fichadas (autorizadas)</button>
          <button className="btn ghost" onClick={() => setShowTopes((v) => !v)}>⚙ Topes de novedades</button>
        </div>
        {msg && <p className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 0 }}>{msg.t}</p>}
      </div>

      {showTopes && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>Topes por novedad</h3>
          <p className="muted" style={{ marginTop: 0 }}>Controlan el acumulado por legajo en el período elegido. Tope 0 = sin control. "Bloquear" rechaza la carga; si está destildado, solo avisa.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--bg2)' }}>{['Concepto', 'Período', 'Tope', 'Bloquear'].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {topes.map((t) => (
                  <tr key={t.tipo}>
                    <td style={{ padding: '4px 8px' }}>{t.label} <span className="muted">({t.unidad === 'cantidad' ? 'cantidad' : 'monto'})</span></td>
                    <td style={{ padding: '4px 8px' }}>
                      <select className="input" value={t.periodo} onChange={(e) => setTope(t.tipo, { periodo: e.target.value })}>
                        <option value="anual">Anual</option><option value="semestral">Semestral</option><option value="mensual">Mensual</option>
                      </select>
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      {t.unidad === 'cantidad'
                        ? <input className="input" type="number" style={{ width: 120 }} value={t.topeCantidad} onChange={(e) => setTope(t.tipo, { topeCantidad: Number(e.target.value) })} />
                        : <input className="input" type="number" style={{ width: 140 }} value={t.topeMonto} onChange={(e) => setTope(t.tipo, { topeMonto: Number(e.target.value) })} />}
                    </td>
                    <td style={{ padding: '4px 8px' }}><input type="checkbox" checked={t.bloquear} onChange={(e) => setTope(t.tipo, { bloquear: e.target.checked })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10 }}><button className="btn primary" onClick={saveTopes}>Guardar topes</button></div>
        </div>
      )}
      <h3 style={{ margin: '0 0 8px' }}>Novedades {MESES[mes]} {anio} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({items.length})</span></h3>
      {!items.length && <p className="muted">No hay novedades cargadas para el período.</p>}
      {items.length > 0 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg2)' }}>{['Empleado', 'Concepto', 'Cantidad', 'Monto', 'Detalle', ''].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: i === 2 || i === 3 ? 'right' : 'left', borderBottom: '2px solid var(--border)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id}>
                  <td style={{ padding: '4px 8px' }}>{n.nom} <span className="muted">· {n.legNum}</span></td>
                  <td style={{ padding: '4px 8px' }}>{n.tipoLabel}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{n.unidad === 'cantidad' ? n.cantidad : '—'}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{n.unidad === 'monto' ? '$ ' + $(n.monto) : '—'}</td>
                  <td style={{ padding: '4px 8px' }} className="muted">{n.detalle || '—'}</td>
                  <td style={{ padding: '4px 8px' }}><button className="btn danger" onClick={() => borrar(n)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
