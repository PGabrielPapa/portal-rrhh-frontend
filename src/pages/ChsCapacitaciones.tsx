import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';

interface Cap {
  id: number; capacitacion?: string; empresa?: string; sector?: string; fecha?: string; temario?: string;
  asistentes?: string; evaluacion?: string; estado?: string; archivoNombre?: string; tieneArchivo?: boolean;
}
const ESTADOS = ['Pendiente', 'Programada', 'Realizada'];
const estColor = (e?: string) => e === 'Realizada' ? 'var(--green)' : e === 'Programada' ? 'var(--yellow)' : 'var(--t3)';
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
function fileToB64(file: File): Promise<{ nombre: string; mime: string; data: string }> { return new Promise((res) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res({ nombre: file.name, mime: file.type || 'application/octet-stream', data: s.slice(s.indexOf(',') + 1) }); }; r.readAsDataURL(file); }); }
async function descargar(url: string, nombre?: string) { const b = await fetchBlob(url); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = nombre || 'registro'; a.click(); URL.revokeObjectURL(u); }

export default function ChsCapacitaciones() {
  const [items, setItems] = useState<Cap[]>([]);
  const [cat, setCat] = useState<{ nombre: string }[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [edit, setEdit] = useState<Cap | null>(null);
  const [show, setShow] = useState(false);
  async function load() { try { setItems(await api.get<Cap[]>('/chs/capacitaciones')); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); api.get<any>('/hys/catalogos').then((c) => setCat(c?.capacitaciones || [])).catch(() => {}); }, []);
  async function eliminar(c: Cap) { if (!confirm('¿Eliminar esta capacitación del plan?')) return; try { await api.del(`/chs/capacitaciones/${c.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  const total = items.length; const realizadas = items.filter((c) => c.estado === 'Realizada').length;
  const cumpl = total ? Math.round((realizadas / total) * 100) : 0;

  return (
    <>
      <div className="row" style={{ marginBottom: 14, alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 13 }}>Cumplimiento del PAC: <strong style={{ color: cumpl >= 80 ? 'var(--green)' : cumpl >= 50 ? 'var(--yellow)' : 'var(--red)' }}>{cumpl}%</strong> ({realizadas}/{total})</span>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => { setEdit(null); setShow(true); }}>+ Capacitación</button>
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Capacitación</th><th>Empresa / Sector</th><th>Fecha</th><th>Estado</th><th>Registro</th><th></th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.capacitacion || '—'}{c.temario && <div className="muted" style={{ fontSize: 11 }}>{c.temario}</div>}</td>
                <td className="muted">{[c.empresa, c.sector].filter(Boolean).join(' · ') || '—'}</td>
                <td>{fmt(c.fecha)}</td>
                <td><span className="badge" style={{ color: estColor(c.estado) }}>{c.estado || 'Pendiente'}</span></td>
                <td>{c.tieneArchivo ? <a style={{ cursor: 'pointer', color: 'var(--accent2)' }} onClick={() => descargar(`/chs/capacitaciones/${c.id}/archivo`, c.archivoNombre)}>📎</a> : '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => { setEdit(c); setShow(true); }}>Editar</button>
                  <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(c)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin capacitaciones en el plan.</td></tr>}
          </tbody>
        </table>
      </div>
      {show && <CapModal cap={edit} catalogo={cat} onClose={() => setShow(false)} onSaved={(t) => { setShow(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

function CapModal({ cap, catalogo, onClose, onSaved, onError }: { cap: Cap | null; catalogo: { nombre: string }[]; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const c = cap || ({} as Cap);
  const [f, setF] = useState<any>({ capacitacion: c.capacitacion || '', empresa: c.empresa || '', sector: c.sector || '', fecha: (c.fecha || '').slice(0, 10), temario: c.temario || '', asistentes: c.asistentes || '', evaluacion: c.evaluacion || '', estado: c.estado || 'Pendiente' });
  const [archivo, setArchivo] = useState<any>(null);
  const [quitar, setQuitar] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; if (file.size > 4.5 * 1024 * 1024) return onError('Máximo 4,5 MB'); setArchivo(await fileToB64(file)); setQuitar(false); }
  async function save() { setBusy(true); try { const body: any = { ...f }; if (archivo) body.archivo = archivo; else if (quitar) body.quitarArchivo = true; if (cap) await api.put(`/chs/capacitaciones/${cap.id}`, body); else await api.post('/chs/capacitaciones', body); onSaved(cap ? 'Capacitación actualizada' : 'Capacitación agregada'); } catch (e: any) { onError(e.message); } finally { setBusy(false); } }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{cap ? 'Editar capacitación' : 'Nueva capacitación del PAC'}</h3>
        <div className="field"><label>Capacitación</label><input className="input" list="cap-list" value={f.capacitacion} onChange={set('capacitacion')} /><datalist id="cap-list">{catalogo.map((x, i) => <option key={i} value={x.nombre} />)}</datalist></div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div className="field"><label>Empresa</label><input className="input" value={f.empresa} onChange={set('empresa')} /></div>
          <div className="field"><label>Sector / personal convocado</label><input className="input" value={f.sector} onChange={set('sector')} /></div>
          <div className="field"><label>Fecha de realización</label><input className="input" type="date" value={f.fecha} onChange={set('fecha')} /></div>
          <div className="field"><label>Estado</label><select className="input" value={f.estado} onChange={set('estado')}>{ESTADOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Temario</label><textarea className="input" rows={2} value={f.temario} onChange={set('temario')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Asistencia (asistentes / observaciones)</label><textarea className="input" rows={2} value={f.asistentes} onChange={set('asistentes')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Evaluación final</label><textarea className="input" rows={2} value={f.evaluacion} onChange={set('evaluacion')} /></div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Registro de asistencia / evaluación (adjunto)</label>
          <input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={onFile} />
          {archivo && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nuevo: {archivo.nombre}</div>}
          {!archivo && cap?.tieneArchivo && !quitar && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Actual: {cap.archivoNombre} · <a style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => setQuitar(true)}>quitar</a></div>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
