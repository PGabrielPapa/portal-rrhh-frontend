import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';

interface Rie {
  id: number; proceso?: string; sector?: string; descripcion?: string; riesgos?: string; medidas?: string;
  eppObligatorio?: string; responsableRevision?: string; fechaRevision?: string; archivoNombre?: string; tieneArchivo?: boolean;
}
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
function fileToB64(file: File): Promise<{ nombre: string; mime: string; data: string }> { return new Promise((res) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res({ nombre: file.name, mime: file.type || 'application/octet-stream', data: s.slice(s.indexOf(',') + 1) }); }; r.readAsDataURL(file); }); }
async function descargar(url: string, nombre?: string) { const b = await fetchBlob(url); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = nombre || 'matriz'; a.click(); URL.revokeObjectURL(u); }

export default function ChsRiesgos() {
  const [items, setItems] = useState<Rie[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [edit, setEdit] = useState<Rie | null>(null);
  const [show, setShow] = useState(false);
  async function load() { try { setItems(await api.get<Rie[]>('/chs/riesgos')); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); }, []);
  async function eliminar(r: Rie) { if (!confirm('¿Eliminar este proceso de la matriz?')) return; try { await api.del(`/chs/riesgos/${r.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}><div style={{ flex: 1 }} /><button className="btn" onClick={() => { setEdit(null); setShow(true); }}>+ Nuevo proceso / tarea</button></div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {!items.length && <div className="muted">Sin procesos cargados en la matriz.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((r) => (
          <div key={r.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <strong>{r.proceso || '(sin proceso)'}</strong> {r.sector && <span className="muted">· {r.sector}</span>}
                {r.descripcion && <div style={{ fontSize: 13, marginTop: 4 }}>{r.descripcion}</div>}
                <div className="grid2" style={{ marginTop: 8, fontSize: 13 }}>
                  <div><span className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Riesgos asociados</span><div>{r.riesgos || '—'}</div></div>
                  <div><span className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Medidas preventivas</span><div>{r.medidas || '—'}</div></div>
                  <div><span className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>EPP obligatorio</span><div>{r.eppObligatorio || '—'}</div></div>
                  <div><span className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Revisión</span><div>{r.responsableRevision || '—'}{r.fechaRevision ? ` · ${fmt(r.fechaRevision)}` : ''}</div></div>
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                {r.tieneArchivo && <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => descargar(`/chs/riesgos/${r.id}/archivo`, r.archivoNombre)}>📎</button>}
                <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setEdit(r); setShow(true); }}>Editar</button>
                <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(r)}>Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {show && <RieModal rie={edit} onClose={() => setShow(false)} onSaved={(t) => { setShow(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

function RieModal({ rie, onClose, onSaved, onError }: { rie: Rie | null; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const r = rie || ({} as Rie);
  const [f, setF] = useState<any>({ proceso: r.proceso || '', sector: r.sector || '', descripcion: r.descripcion || '', riesgos: r.riesgos || '', medidas: r.medidas || '', eppObligatorio: r.eppObligatorio || '', responsableRevision: r.responsableRevision || '', fechaRevision: (r.fechaRevision || '').slice(0, 10) });
  const [archivo, setArchivo] = useState<any>(null);
  const [quitar, setQuitar] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; if (file.size > 4.5 * 1024 * 1024) return onError('Máximo 4,5 MB'); setArchivo(await fileToB64(file)); setQuitar(false); }
  async function save() { setBusy(true); try { const body: any = { ...f }; if (archivo) body.archivo = archivo; else if (quitar) body.quitarArchivo = true; if (rie) await api.put(`/chs/riesgos/${rie.id}`, body); else await api.post('/chs/riesgos', body); onSaved(rie ? 'Proceso actualizado' : 'Proceso registrado'); } catch (e: any) { onError(e.message); } finally { setBusy(false); } }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{rie ? 'Editar proceso / tarea' : 'Nuevo proceso / tarea'}</h3>
        <div className="grid2">
          <div className="field"><label>Proceso / Tarea</label><input className="input" value={f.proceso} onChange={set('proceso')} /></div>
          <div className="field"><label>Sector</label><input className="input" value={f.sector} onChange={set('sector')} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Descripción de la actividad</label><textarea className="input" rows={2} value={f.descripcion} onChange={set('descripcion')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Riesgos asociados</label><textarea className="input" rows={2} value={f.riesgos} onChange={set('riesgos')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Medidas preventivas</label><textarea className="input" rows={2} value={f.medidas} onChange={set('medidas')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>EPP obligatorio</label><input className="input" value={f.eppObligatorio} onChange={set('eppObligatorio')} placeholder="Ej.: casco, guantes, calzado de seguridad…" /></div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div className="field"><label>Responsable de revisión</label><input className="input" value={f.responsableRevision} onChange={set('responsableRevision')} /></div>
          <div className="field"><label>Fecha de revisión</label><input className="input" type="date" value={f.fechaRevision} onChange={set('fechaRevision')} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Matriz de riesgos asociada (adjunto)</label>
          <input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={onFile} />
          {archivo && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nuevo: {archivo.nombre}</div>}
          {!archivo && rie?.tieneArchivo && !quitar && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Actual: {rie.archivoNombre} · <a style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => setQuitar(true)}>quitar</a></div>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
