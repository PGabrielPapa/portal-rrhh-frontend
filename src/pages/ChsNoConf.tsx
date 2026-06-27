import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';

interface Nc {
  id: number; fecha?: string; sector?: string; descripcion?: string; clasificacion?: string; prioridad?: string;
  accion?: string; responsable?: string; fechaCierre?: string; estado?: string; archivoNombre?: string; tieneArchivo?: boolean;
}
const CLASES = ['No conformidad', 'Oportunidad de mejora'];
const PRIORIDADES = ['Alta', 'Media', 'Baja'];
const ESTADOS = ['Abierta', 'En proceso', 'Cerrada'];
const estColor = (e?: string) => e === 'Cerrada' ? 'var(--green)' : e === 'En proceso' ? 'var(--yellow)' : 'var(--red)';
const priColor = (p?: string) => p === 'Alta' ? 'var(--red)' : p === 'Media' ? 'var(--yellow)' : 'var(--t3)';
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
function fileToB64(file: File): Promise<{ nombre: string; mime: string; data: string }> { return new Promise((res) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res({ nombre: file.name, mime: file.type || 'application/octet-stream', data: s.slice(s.indexOf(',') + 1) }); }; r.readAsDataURL(file); }); }
async function descargar(url: string, nombre?: string) { const b = await fetchBlob(url); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = nombre || 'archivo'; a.click(); URL.revokeObjectURL(u); }

export default function ChsNoConf() {
  const [items, setItems] = useState<Nc[]>([]);
  const [fEstado, setFEstado] = useState('');
  const [fClase, setFClase] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [edit, setEdit] = useState<Nc | null>(null);
  const [show, setShow] = useState(false);
  async function load() { try { const p = new URLSearchParams(); if (fEstado) p.set('estado', fEstado); if (fClase) p.set('clasificacion', fClase); setItems(await api.get<Nc[]>(`/chs/noconf?${p}`)); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fEstado, fClase]);
  async function eliminar(n: Nc) { if (!confirm('¿Eliminar este registro?')) return; try { await api.del(`/chs/noconf/${n.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 200 }} value={fClase} onChange={(e) => setFClase(e.target.value)}><option value="">Todas las clases</option>{CLASES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select className="input" style={{ maxWidth: 170 }} value={fEstado} onChange={(e) => setFEstado(e.target.value)}><option value="">Todos los estados</option>{ESTADOS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => { setEdit(null); setShow(true); }}>+ Nuevo registro</button>
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Fecha</th><th>Sector</th><th>Descripción</th><th>Clase</th><th>Prioridad</th><th>Estado</th><th>Cierre</th><th></th></tr></thead>
          <tbody>
            {items.map((n) => (
              <tr key={n.id}>
                <td>{fmt(n.fecha)}</td><td>{n.sector || '—'}</td>
                <td>{n.descripcion || '—'}{n.accion && <div className="muted" style={{ fontSize: 11 }}>Acción: {n.accion}{n.responsable ? ` (${n.responsable})` : ''}</div>}</td>
                <td><span className="badge">{n.clasificacion || '—'}</span></td>
                <td><span className="badge" style={{ color: priColor(n.prioridad) }}>{n.prioridad || '—'}</span></td>
                <td><span className="badge" style={{ color: estColor(n.estado) }}>{n.estado || 'Abierta'}</span></td>
                <td>{fmt(n.fechaCierre)}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {n.tieneArchivo && <button className="btn ghost" style={{ padding: '4px 8px', fontSize: 12, marginRight: 6 }} onClick={() => descargar(`/chs/noconf/${n.id}/archivo`, n.archivoNombre)}>📎</button>}
                  <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => { setEdit(n); setShow(true); }}>Editar</button>
                  <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(n)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin registros.</td></tr>}
          </tbody>
        </table>
      </div>
      {show && <NcModal nc={edit} onClose={() => setShow(false)} onSaved={(t) => { setShow(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

function NcModal({ nc, onClose, onSaved, onError }: { nc: Nc | null; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const n = nc || ({} as Nc);
  const [f, setF] = useState<any>({ fecha: (n.fecha || new Date().toISOString().slice(0, 10)).slice(0, 10), sector: n.sector || '', descripcion: n.descripcion || '', clasificacion: n.clasificacion || CLASES[0], prioridad: n.prioridad || 'Media', accion: n.accion || '', responsable: n.responsable || '', fechaCierre: (n.fechaCierre || '').slice(0, 10), estado: n.estado || 'Abierta' });
  const [archivo, setArchivo] = useState<any>(null);
  const [quitar, setQuitar] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; if (file.size > 4.5 * 1024 * 1024) return onError('Máximo 4,5 MB'); setArchivo(await fileToB64(file)); setQuitar(false); }
  async function save() { setBusy(true); try { const body: any = { ...f }; if (archivo) body.archivo = archivo; else if (quitar) body.quitarArchivo = true; if (nc) await api.put(`/chs/noconf/${nc.id}`, body); else await api.post('/chs/noconf', body); onSaved(nc ? 'Registro actualizado' : 'Registro creado'); } catch (e: any) { onError(e.message); } finally { setBusy(false); } }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{nc ? 'Editar registro' : 'Nueva no conformidad / mejora'}</h3>
        <div className="grid2">
          <div className="field"><label>Fecha</label><input className="input" type="date" value={f.fecha} onChange={set('fecha')} /></div>
          <div className="field"><label>Sector</label><input className="input" value={f.sector} onChange={set('sector')} /></div>
          <div className="field"><label>Clasificación</label><select className="input" value={f.clasificacion} onChange={set('clasificacion')}>{CLASES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="field"><label>Prioridad</label><select className="input" value={f.prioridad} onChange={set('prioridad')}>{PRIORIDADES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Descripción</label><textarea className="input" rows={2} value={f.descripcion} onChange={set('descripcion')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Acción correctiva / preventiva</label><textarea className="input" rows={2} value={f.accion} onChange={set('accion')} /></div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div className="field"><label>Responsable</label><input className="input" value={f.responsable} onChange={set('responsable')} /></div>
          <div className="field"><label>Estado</label><select className="input" value={f.estado} onChange={set('estado')}>{ESTADOS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="field"><label>Fecha de cierre</label><input className="input" type="date" value={f.fechaCierre} onChange={set('fechaCierre')} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Evidencia de implementación (adjunto)</label>
          <input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={onFile} />
          {archivo && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nuevo: {archivo.nombre}</div>}
          {!archivo && nc?.tieneArchivo && !quitar && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Actual: {nc.archivoNombre} · <a style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => setQuitar(true)}>quitar</a></div>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
