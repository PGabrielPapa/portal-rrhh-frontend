import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';

interface Evi {
  id: number; descripcion?: string; motivo?: string; fecha?: string; responsable?: string; estado?: string; resultado?: string;
  archivoNombre?: string; tieneArchivo?: boolean;
}
const ESTADOS = ['Planificada', 'En curso', 'Implementada'];
const estColor = (e?: string) => e === 'Implementada' ? 'var(--green)' : e === 'En curso' ? 'var(--yellow)' : 'var(--t3)';
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
function fileToB64(file: File): Promise<{ nombre: string; mime: string; data: string }> { return new Promise((res) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res({ nombre: file.name, mime: file.type || 'application/octet-stream', data: s.slice(s.indexOf(',') + 1) }); }; r.readAsDataURL(file); }); }
async function verFoto(url: string) { const b = await fetchBlob(url); const u = URL.createObjectURL(b); window.open(u, '_blank'); }

export default function ChsEvidencias() {
  const [items, setItems] = useState<Evi[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [edit, setEdit] = useState<Evi | null>(null);
  const [show, setShow] = useState(false);
  async function load() { try { setItems(await api.get<Evi[]>('/chs/evidencias')); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); }, []);
  async function eliminar(v: Evi) { if (!confirm('¿Eliminar esta evidencia?')) return; try { await api.del(`/chs/evidencias/${v.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}><div style={{ flex: 1 }} /><button className="btn" onClick={() => { setEdit(null); setShow(true); }}>+ Nueva evidencia</button></div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {!items.length && <div className="muted">Sin evidencias cargadas.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((v) => (
          <div key={v.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <strong>{v.descripcion || '(sin descripción)'}</strong> <span className="badge" style={{ color: estColor(v.estado), marginLeft: 6 }}>{v.estado || 'Implementada'}</span>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{fmt(v.fecha)}{v.responsable ? ` · ${v.responsable}` : ''}</div>
                {v.motivo && <div style={{ fontSize: 13, marginTop: 6 }}>Motivo: {v.motivo}</div>}
                {v.resultado && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Resultado: {v.resultado}</div>}
              </div>
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                {v.tieneArchivo && <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => verFoto(`/chs/evidencias/${v.id}/archivo`)}>📷 Ver</button>}
                <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setEdit(v); setShow(true); }}>Editar</button>
                <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(v)}>Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {show && <EviModal evi={edit} onClose={() => setShow(false)} onSaved={(t) => { setShow(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

function EviModal({ evi, onClose, onSaved, onError }: { evi: Evi | null; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const v = evi || ({} as Evi);
  const [f, setF] = useState<any>({ descripcion: v.descripcion || '', motivo: v.motivo || '', fecha: (v.fecha || new Date().toISOString().slice(0, 10)).slice(0, 10), responsable: v.responsable || '', estado: v.estado || 'Implementada', resultado: v.resultado || '' });
  const [archivo, setArchivo] = useState<any>(null);
  const [quitar, setQuitar] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; if (file.size > 4.5 * 1024 * 1024) return onError('Máximo 4,5 MB'); setArchivo(await fileToB64(file)); setQuitar(false); }
  async function save() { setBusy(true); try { const body: any = { ...f }; if (archivo) body.archivo = archivo; else if (quitar) body.quitarArchivo = true; if (evi) await api.put(`/chs/evidencias/${evi.id}`, body); else await api.post('/chs/evidencias', body); onSaved(evi ? 'Evidencia actualizada' : 'Evidencia registrada'); } catch (e: any) { onError(e.message); } finally { setBusy(false); } }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{evi ? 'Editar evidencia' : 'Nueva evidencia de mejora'}</h3>
        <div className="field"><label>Descripción de la mejora</label><textarea className="input" rows={2} value={f.descripcion} onChange={set('descripcion')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Motivo de implementación</label><textarea className="input" rows={2} value={f.motivo} onChange={set('motivo')} /></div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div className="field"><label>Fecha</label><input className="input" type="date" value={f.fecha} onChange={set('fecha')} /></div>
          <div className="field"><label>Responsable</label><input className="input" value={f.responsable} onChange={set('responsable')} /></div>
          <div className="field"><label>Estado</label><select className="input" value={f.estado} onChange={set('estado')}>{ESTADOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Resultado obtenido</label><textarea className="input" rows={2} value={f.resultado} onChange={set('resultado')} /></div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Evidencia fotográfica o documental</label>
          <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={onFile} />
          {archivo && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nuevo: {archivo.nombre}</div>}
          {!archivo && evi?.tieneArchivo && !quitar && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Actual: {evi.archivoNombre} · <a style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => setQuitar(true)}>quitar</a></div>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
