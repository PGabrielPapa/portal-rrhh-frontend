import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';
import EmpleadoPicker from '../components/EmpleadoPicker';

interface Mat { id: number; puesto?: string; elementos?: string; observaciones?: string }
interface Ent { id: number; empleadoId?: number; empleadoNom?: string; empleadoLeg?: string; puesto?: string; elementos?: string; fechaEntrega?: string; fechaReposicion?: string; observaciones?: string; archivoNombre?: string; tieneArchivo?: boolean }
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
function fileToB64(file: File): Promise<{ nombre: string; mime: string; data: string }> { return new Promise((res) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res({ nombre: file.name, mime: file.type || 'application/octet-stream', data: s.slice(s.indexOf(',') + 1) }); }; r.readAsDataURL(file); }); }
async function descargar(url: string, nombre?: string) { const b = await fetchBlob(url); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = nombre || 'constancia'; a.click(); URL.revokeObjectURL(u); }

export default function ChsEpp() {
  const [tab, setTab] = useState<'entregas' | 'matriz'>('entregas');
  const [mats, setMats] = useState<Mat[]>([]);
  const [ents, setEnts] = useState<Ent[]>([]);
  const [eppCat, setEppCat] = useState<{ nombre: string }[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [editM, setEditM] = useState<Mat | null>(null); const [showM, setShowM] = useState(false);
  const [editE, setEditE] = useState<Ent | null>(null); const [showE, setShowE] = useState(false);

  async function load() {
    try { setMats(await api.get<Mat[]>('/chs/epp-matriz')); } catch (e: any) { setMsg({ t: e.message, ok: false }); }
    try { setEnts(await api.get<Ent[]>('/chs/epp-entregas')); } catch { /* */ }
  }
  useEffect(() => { load(); api.get<any>('/hys/catalogos').then((c) => setEppCat(c?.epp || [])).catch(() => {}); }, []);
  async function delM(m: Mat) { if (!confirm('¿Eliminar este puesto de la matriz?')) return; try { await api.del(`/chs/epp-matriz/${m.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  async function delE(e: Ent) { if (!confirm('¿Eliminar esta entrega?')) return; try { await api.del(`/chs/epp-entregas/${e.id}`); load(); } catch (er: any) { setMsg({ t: er.message, ok: false }); } }

  return (
    <>
      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        <button className={`btn ${tab === 'entregas' ? '' : 'ghost'}`} onClick={() => setTab('entregas')}>Registro de entregas</button>
        <button className={`btn ${tab === 'matriz' ? '' : 'ghost'}`} onClick={() => setTab('matriz')}>Matriz por puesto</button>
        <div style={{ flex: 1 }} />
        {tab === 'entregas' ? <button className="btn" onClick={() => { setEditE(null); setShowE(true); }}>+ Entrega</button> : <button className="btn" onClick={() => { setEditM(null); setShowM(true); }}>+ Puesto</button>}
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}

      {tab === 'matriz' ? (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table>
            <thead><tr><th>Puesto</th><th>EPP requerido</th><th>Observaciones</th><th></th></tr></thead>
            <tbody>
              {mats.map((m) => (
                <tr key={m.id}>
                  <td>{m.puesto || '—'}</td><td>{m.elementos || '—'}</td><td className="muted">{m.observaciones || '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => { setEditM(m); setShowM(true); }}>Editar</button>
                    <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => delM(m)}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {!mats.length && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin puestos en la matriz.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table>
            <thead><tr><th>Empleado</th><th>Puesto</th><th>Elementos</th><th>Entrega</th><th>Reposición</th><th>Constancia</th><th></th></tr></thead>
            <tbody>
              {ents.map((e) => (
                <tr key={e.id}>
                  <td>{e.empleadoNom || '—'}{e.empleadoLeg && <span className="muted"> · {e.empleadoLeg}</span>}</td>
                  <td>{e.puesto || '—'}</td><td>{e.elementos || '—'}{e.observaciones && <div className="muted" style={{ fontSize: 11 }}>{e.observaciones}</div>}</td>
                  <td>{fmt(e.fechaEntrega)}</td><td>{fmt(e.fechaReposicion)}</td>
                  <td>{e.tieneArchivo ? <a style={{ cursor: 'pointer', color: 'var(--accent2)' }} onClick={() => descargar(`/chs/epp-entregas/${e.id}/archivo`, e.archivoNombre)}>📎</a> : '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => { setEditE(e); setShowE(true); }}>Editar</button>
                    <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => delE(e)}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {!ents.length && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin entregas registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showM && <MatModal mat={editM} eppCat={eppCat} onClose={() => setShowM(false)} onSaved={(t) => { setShowM(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
      {showE && <EntModal ent={editE} eppCat={eppCat} onClose={() => setShowE(false)} onSaved={(t) => { setShowE(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

function EppPicker({ eppCat, value, onChange }: { eppCat: { nombre: string }[]; value: string; onChange: (v: string) => void }) {
  const sel = new Set((value || '').split(',').map((x) => x.trim()).filter(Boolean));
  function toggle(n: string) { sel.has(n) ? sel.delete(n) : sel.add(n); onChange([...sel].join(', ')); }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 130, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
        {eppCat.map((x, i) => (
          <label key={i} className="row" style={{ gap: 4, fontSize: 12, cursor: 'pointer', background: sel.has(x.nombre) ? 'var(--accent-glow)' : 'transparent', padding: '2px 6px', borderRadius: 6 }}>
            <input type="checkbox" checked={sel.has(x.nombre)} onChange={() => toggle(x.nombre)} /> {x.nombre}
          </label>
        ))}
        {!eppCat.length && <span className="muted" style={{ fontSize: 12 }}>Sin catálogo de EPP cargado (cargalo en el módulo HyS).</span>}
      </div>
      <input className="input" style={{ marginTop: 6 }} placeholder="Elementos (editable)" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function MatModal({ mat, eppCat, onClose, onSaved, onError }: { mat: Mat | null; eppCat: { nombre: string }[]; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const m = mat || ({} as Mat);
  const [f, setF] = useState<any>({ puesto: m.puesto || '', elementos: m.elementos || '', observaciones: m.observaciones || '' });
  const [busy, setBusy] = useState(false);
  async function save() { setBusy(true); try { if (mat) await api.put(`/chs/epp-matriz/${mat.id}`, f); else await api.post('/chs/epp-matriz', f); onSaved(mat ? 'Puesto actualizado' : 'Puesto agregado'); } catch (e: any) { onError(e.message); } finally { setBusy(false); } }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{mat ? 'Editar puesto' : 'Nuevo puesto'}</h3>
        <div className="field"><label>Puesto</label><input className="input" value={f.puesto} onChange={(e) => setF({ ...f, puesto: e.target.value })} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>EPP requerido</label><EppPicker eppCat={eppCat} value={f.elementos} onChange={(v) => setF({ ...f, elementos: v })} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Observaciones</label><textarea className="input" rows={2} value={f.observaciones} onChange={(e) => setF({ ...f, observaciones: e.target.value })} /></div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function EntModal({ ent, eppCat, onClose, onSaved, onError }: { ent: Ent | null; eppCat: { nombre: string }[]; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const e = ent || ({} as Ent);
  const [f, setF] = useState<any>({ empleadoId: e.empleadoId || null, empleadoNom: e.empleadoNom || '', puesto: e.puesto || '', elementos: e.elementos || '', fechaEntrega: (e.fechaEntrega || new Date().toISOString().slice(0, 10)).slice(0, 10), fechaReposicion: (e.fechaReposicion || '').slice(0, 10), observaciones: e.observaciones || '' });
  const [archivo, setArchivo] = useState<any>(null);
  const [quitar, setQuitar] = useState(false);
  const [busy, setBusy] = useState(false);
  async function onFile(ev: React.ChangeEvent<HTMLInputElement>) { const file = ev.target.files?.[0]; if (!file) return; if (file.size > 4.5 * 1024 * 1024) return onError('Máximo 4,5 MB'); setArchivo(await fileToB64(file)); setQuitar(false); }
  async function save() { setBusy(true); try { const body: any = { ...f }; if (archivo) body.archivo = archivo; else if (quitar) body.quitarArchivo = true; if (ent) await api.put(`/chs/epp-entregas/${ent.id}`, body); else await api.post('/chs/epp-entregas', body); onSaved(ent ? 'Entrega actualizada' : 'Entrega registrada'); } catch (er: any) { onError(er.message); } finally { setBusy(false); } }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{ent ? 'Editar entrega' : 'Nueva entrega de EPP'}</h3>
        <div className="field"><label>Empleado</label>
          {f.empleadoId ? <div className="row" style={{ gap: 8, alignItems: 'center' }}><span className="input" style={{ flex: 1 }}>{f.empleadoNom}</span><button type="button" className="btn ghost" onClick={() => setF({ ...f, empleadoId: null, empleadoNom: '' })}>Cambiar</button></div>
            : <EmpleadoPicker onSelect={(x) => x && setF({ ...f, empleadoId: x.id, empleadoNom: `${x.nom} (${x.legNum})`, puesto: f.puesto || (x as any).tarea || '' })} />}
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Puesto</label><input className="input" value={f.puesto} onChange={(ev) => setF({ ...f, puesto: ev.target.value })} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Elementos entregados</label><EppPicker eppCat={eppCat} value={f.elementos} onChange={(v) => setF({ ...f, elementos: v })} /></div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div className="field"><label>Fecha de entrega</label><input className="input" type="date" value={f.fechaEntrega} onChange={(ev) => setF({ ...f, fechaEntrega: ev.target.value })} /></div>
          <div className="field"><label>Fecha de reposición</label><input className="input" type="date" value={f.fechaReposicion} onChange={(ev) => setF({ ...f, fechaReposicion: ev.target.value })} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Observaciones</label><textarea className="input" rows={2} value={f.observaciones} onChange={(ev) => setF({ ...f, observaciones: ev.target.value })} /></div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Constancia firmada (adjunto)</label>
          <input type="file" accept=".pdf,image/*,.doc,.docx" onChange={onFile} />
          {archivo && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nuevo: {archivo.nombre}</div>}
          {!archivo && ent?.tieneArchivo && !quitar && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Actual: {ent.archivoNombre} · <a style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => setQuitar(true)}>quitar</a></div>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
