import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';

interface Accion { accion: string; responsable: string; vence: string; estado: string }
interface Aud {
  id: number; fecha?: string; tipo?: string; responsable?: string; sector?: string; observaciones?: string;
  noConformidades?: string; acciones: Accion[]; estado?: string; archivoNombre?: string; tieneArchivo?: boolean;
  plazoEjecucion?: string; fechaEjecucion?: string; resolucion?: string; fechaResolucion?: string;
}
const TIPOS = ['Auditoría interna', 'Auditoría externa', 'Inspección', 'Otra'];
const RES_INSPECCION = ['Aprobada', 'Entregada', 'Multa', 'Clausura'];
const RES_AUDITORIA = ['Cerrada', 'Con observaciones'];
const esInspeccion = (t?: string) => /inspec/i.test(t || '');
const resOpts = (t?: string) => (esInspeccion(t) ? RES_INSPECCION : RES_AUDITORIA);
function diasPlazo(plazo?: string, ejec?: string): { d: number; ok: boolean } | null {
  if (!plazo) return null;
  const ref = ejec ? new Date(ejec + 'T00:00:00') : new Date();
  const p = new Date(plazo + 'T00:00:00');
  return { d: Math.round((ref.getTime() - p.getTime()) / 86400000), ok: (ref.getTime() - p.getTime()) <= 0 };
}
const ESTADOS = ['Abierta', 'En proceso', 'Cerrada'];
const EST_ACC = ['Pendiente', 'En curso', 'Cumplida'];
const estColor = (e?: string) => e === 'Cerrada' || e === 'Cumplida' ? 'var(--green)' : e === 'En proceso' || e === 'En curso' ? 'var(--yellow)' : 'var(--red)';
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
function fileToB64(file: File): Promise<{ nombre: string; mime: string; data: string }> { return new Promise((res) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res({ nombre: file.name, mime: file.type || 'application/octet-stream', data: s.slice(s.indexOf(',') + 1) }); }; r.readAsDataURL(file); }); }
async function descargar(url: string, nombre?: string) { const b = await fetchBlob(url); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = nombre || 'archivo'; a.click(); URL.revokeObjectURL(u); }

export default function ChsAuditorias() {
  const [items, setItems] = useState<Aud[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [edit, setEdit] = useState<Aud | null>(null);
  const [show, setShow] = useState(false);
  async function load() { try { setItems(await api.get<Aud[]>('/chs/auditorias')); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); }, []);
  async function eliminar(a: Aud) { if (!confirm('¿Eliminar esta auditoría/inspección?')) return; try { await api.del(`/chs/auditorias/${a.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}><div style={{ flex: 1 }} /><button className="btn" onClick={() => { setEdit(null); setShow(true); }}>+ Nueva auditoría / inspección</button></div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {!items.length && <div className="muted">Sin registros.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((a) => {
          const pend = (a.acciones || []).filter((x) => x.estado !== 'Cumplida').length;
          return (
            <div key={a.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <strong>{fmt(a.fecha)}</strong> · {a.tipo || '—'} <span className="badge" style={{ color: estColor(a.estado), marginLeft: 6 }}>{a.estado || 'Abierta'}</span>
                  {a.resolucion && <span className="badge" style={{ marginLeft: 6, color: 'var(--accent2)' }}>{a.resolucion}</span>}
                  {(() => { const dp = diasPlazo(a.plazoEjecucion, a.fechaEjecucion); return dp ? <span className="badge" style={{ marginLeft: 6, color: dp.ok ? 'var(--green)' : 'var(--red)' }}>{dp.ok ? `Dentro de plazo (${Math.abs(dp.d)} d)` : `Excedido (${dp.d} d)`}</span> : null; })()}
                  {(a.plazoEjecucion || a.fechaEjecucion) && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Plazo ejec.: {fmt(a.plazoEjecucion)} · Ejecutada: {fmt(a.fechaEjecucion)}{a.fechaResolucion ? ` · Resol.: ${fmt(a.fechaResolucion)}` : ''}</div>}
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Responsable: {a.responsable || '—'}{a.sector ? ` · Sector: ${a.sector}` : ''}</div>
                  {a.observaciones && <div style={{ fontSize: 13, marginTop: 6 }}>{a.observaciones}</div>}
                  {a.noConformidades && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>No conformidades: {a.noConformidades}</div>}
                </div>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  {a.tieneArchivo && <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => descargar(`/chs/auditorias/${a.id}/archivo`, a.archivoNombre)}>📎</button>}
                  <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setEdit(a); setShow(true); }}>Editar</button>
                  <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(a)}>Eliminar</button>
                </div>
              </div>
              {!!(a.acciones || []).length && (
                <table style={{ width: '100%', fontSize: 13, marginTop: 10 }}>
                  <thead><tr><th style={{ textAlign: 'left' }}>Acción correctiva</th><th style={{ textAlign: 'left' }}>Responsable</th><th style={{ textAlign: 'left' }}>Compromiso</th><th style={{ textAlign: 'left' }}>Estado</th></tr></thead>
                  <tbody>{a.acciones.map((x, i) => <tr key={i}><td>{x.accion}</td><td>{x.responsable || '—'}</td><td>{fmt(x.vence)}</td><td><span className="badge" style={{ color: estColor(x.estado) }}>{x.estado || 'Pendiente'}</span></td></tr>)}</tbody>
                </table>
              )}
              <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{pend} acción(es) pendiente(s)</div>
            </div>
          );
        })}
      </div>
      {show && <AudModal aud={edit} onClose={() => setShow(false)} onSaved={(t) => { setShow(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

function AudModal({ aud, onClose, onSaved, onError }: { aud: Aud | null; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const a = aud || ({} as Aud);
  const [f, setF] = useState<any>({ fecha: (a.fecha || '').slice(0, 10), tipo: a.tipo || TIPOS[0], responsable: a.responsable || '', sector: a.sector || '', observaciones: a.observaciones || '', noConformidades: a.noConformidades || '', estado: a.estado || 'Abierta', plazoEjecucion: (a.plazoEjecucion || '').slice(0, 10), fechaEjecucion: (a.fechaEjecucion || '').slice(0, 10), resolucion: a.resolucion || '', fechaResolucion: (a.fechaResolucion || '').slice(0, 10) });
  const [acciones, setAcciones] = useState<Accion[]>(a.acciones || []);
  const [archivo, setArchivo] = useState<any>(null);
  const [quitar, setQuitar] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  function addA() { setAcciones([...acciones, { accion: '', responsable: '', vence: '', estado: 'Pendiente' }]); }
  function setA(i: number, k: string, v: string) { const c = [...acciones]; c[i] = { ...c[i], [k]: v }; setAcciones(c); }
  function delA(i: number) { setAcciones(acciones.filter((_, j) => j !== i)); }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; if (file.size > 4.5 * 1024 * 1024) return onError('Máximo 4,5 MB'); setArchivo(await fileToB64(file)); setQuitar(false); }
  async function save() { setBusy(true); try { const body: any = { ...f, acciones: acciones.filter((x) => x.accion.trim()) }; if (archivo) body.archivo = archivo; else if (quitar) body.quitarArchivo = true; if (aud) await api.put(`/chs/auditorias/${aud.id}`, body); else await api.post('/chs/auditorias', body); onSaved(aud ? 'Auditoría actualizada' : 'Auditoría registrada'); } catch (e: any) { onError(e.message); } finally { setBusy(false); } }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{aud ? 'Editar auditoría / inspección' : 'Nueva auditoría / inspección'}</h3>
        <div className="grid2">
          <div className="field"><label>Fecha</label><input className="input" type="date" value={f.fecha} onChange={set('fecha')} /></div>
          <div className="field"><label>Tipo</label><input className="input" list="aud-tipos" value={f.tipo} onChange={set('tipo')} /><datalist id="aud-tipos">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist></div>
          <div className="field"><label>Responsable</label><input className="input" value={f.responsable} onChange={set('responsable')} /></div>
          <div className="field"><label>Sector inspeccionado</label><input className="input" value={f.sector} onChange={set('sector')} /></div>
          <div className="field"><label>Estado de cierre</label><select className="input" value={f.estado} onChange={set('estado')}>{ESTADOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="field"><label>Plazo de ejecución</label><input className="input" type="date" value={f.plazoEjecucion} onChange={set('plazoEjecucion')} /></div>
          <div className="field"><label>Fecha de ejecución</label><input className="input" type="date" value={f.fechaEjecucion} onChange={set('fechaEjecucion')} /></div>
          <div className="field"><label>Resolución final{esInspeccion(f.tipo) ? ' (inspección)' : ''}</label>
            <select className="input" value={f.resolucion} onChange={set('resolucion')}>
              <option value="">—</option>
              {resOpts(f.tipo).map((r) => <option key={r} value={r}>{r}</option>)}
              {f.resolucion && !resOpts(f.tipo).includes(f.resolucion) && <option value={f.resolucion}>{f.resolucion}</option>}
            </select>
          </div>
          <div className="field"><label>Fecha de resolución final</label><input className="input" type="date" value={f.fechaResolucion} onChange={set('fechaResolucion')} /></div>
        </div>
        {(() => { const dp = diasPlazo(f.plazoEjecucion, f.fechaEjecucion); return dp ? <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: dp.ok ? 'var(--green)' : 'var(--red)' }}>{dp.ok ? `Dentro de plazo: ${Math.abs(dp.d)} día(s) de margen` : `Plazo excedido por ${dp.d} día(s)`}</div> : null; })()}
        <div className="field" style={{ marginTop: 10 }}><label>Observaciones</label><textarea className="input" rows={2} value={f.observaciones} onChange={set('observaciones')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>No conformidades detectadas</label><textarea className="input" rows={2} value={f.noConformidades} onChange={set('noConformidades')} /></div>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 6px' }}>
          <div className="sb-group-label" style={{ margin: 0 }}>Acciones correctivas</div>
          <button type="button" className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={addA}>+ Acción</button>
        </div>
        {acciones.map((x, i) => (
          <div key={i} className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: 2, minWidth: 160 }} placeholder="Acción" value={x.accion} onChange={(e) => setA(i, 'accion', e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 110 }} placeholder="Responsable" value={x.responsable} onChange={(e) => setA(i, 'responsable', e.target.value)} />
            <input className="input" type="date" style={{ width: 150 }} value={x.vence} onChange={(e) => setA(i, 'vence', e.target.value)} />
            <select className="input" style={{ width: 120 }} value={x.estado} onChange={(e) => setA(i, 'estado', e.target.value)}>{EST_ACC.map((y) => <option key={y} value={y}>{y}</option>)}</select>
            <button type="button" className="btn ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => delA(i)}>✕</button>
          </div>
        ))}
        <div className="field" style={{ marginTop: 12 }}>
          <label>Informe adjunto</label>
          <input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={onFile} />
          {archivo && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nuevo: {archivo.nombre}</div>}
          {!archivo && aud?.tieneArchivo && !quitar && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Actual: {aud.archivoNombre} · <a style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => setQuitar(true)}>quitar</a></div>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
