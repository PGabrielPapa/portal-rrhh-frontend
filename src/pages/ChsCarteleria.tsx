import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';

interface Car {
  id: number; tipo?: string; ubicacion?: string; fechaInstalacion?: string; estadoConservacion?: string; fechaRevision?: string;
  archivoNombre?: string; tieneArchivo?: boolean;
}
const TIPOS = ['Salida de emergencia', 'Matafuego / Extintor', 'Riesgo eléctrico', 'Uso obligatorio de EPP', 'Prohibido fumar', 'Punto de encuentro', 'Primeros auxilios', 'Riesgo de caída', 'Señalización de piso'];
const ESTADOS = ['Bueno', 'Regular', 'Malo', 'A reponer'];
const estColor = (e?: string) => e === 'Bueno' ? 'var(--green)' : e === 'Regular' ? 'var(--yellow)' : 'var(--red)';
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
function fileToB64(file: File): Promise<{ nombre: string; mime: string; data: string }> { return new Promise((res) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res({ nombre: file.name, mime: file.type || 'application/octet-stream', data: s.slice(s.indexOf(',') + 1) }); }; r.readAsDataURL(file); }); }
async function verFoto(url: string) { const b = await fetchBlob(url); const u = URL.createObjectURL(b); window.open(u, '_blank'); }

export default function ChsCarteleria() {
  const [items, setItems] = useState<Car[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [edit, setEdit] = useState<Car | null>(null);
  const [show, setShow] = useState(false);
  async function load() { try { setItems(await api.get<Car[]>('/chs/carteleria')); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); }, []);
  async function eliminar(c: Car) { if (!confirm('¿Eliminar este cartel?')) return; try { await api.del(`/chs/carteleria/${c.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}><div style={{ flex: 1 }} /><button className="btn" onClick={() => { setEdit(null); setShow(true); }}>+ Nuevo cartel</button></div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Tipo</th><th>Ubicación</th><th>Instalación</th><th>Revisión</th><th>Conservación</th><th>Foto</th><th></th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.tipo || '—'}</td><td>{c.ubicacion || '—'}</td>
                <td>{fmt(c.fechaInstalacion)}</td><td>{fmt(c.fechaRevision)}</td>
                <td><span className="badge" style={{ color: estColor(c.estadoConservacion) }}>{c.estadoConservacion || '—'}</span></td>
                <td>{c.tieneArchivo ? <a style={{ cursor: 'pointer', color: 'var(--accent2)' }} onClick={() => verFoto(`/chs/carteleria/${c.id}/archivo`)}>📷 Ver</a> : '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => { setEdit(c); setShow(true); }}>Editar</button>
                  <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(c)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin carteles cargados.</td></tr>}
          </tbody>
        </table>
      </div>
      {show && <CarModal car={edit} onClose={() => setShow(false)} onSaved={(t) => { setShow(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

function CarModal({ car, onClose, onSaved, onError }: { car: Car | null; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const c = car || ({} as Car);
  const [f, setF] = useState<any>({ tipo: c.tipo || '', ubicacion: c.ubicacion || '', fechaInstalacion: (c.fechaInstalacion || '').slice(0, 10), estadoConservacion: c.estadoConservacion || 'Bueno', fechaRevision: (c.fechaRevision || '').slice(0, 10) });
  const [archivo, setArchivo] = useState<any>(null);
  const [quitar, setQuitar] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; if (file.size > 4.5 * 1024 * 1024) return onError('Máximo 4,5 MB'); setArchivo(await fileToB64(file)); setQuitar(false); }
  async function save() { setBusy(true); try { const body: any = { ...f }; if (archivo) body.archivo = archivo; else if (quitar) body.quitarArchivo = true; if (car) await api.put(`/chs/carteleria/${car.id}`, body); else await api.post('/chs/carteleria', body); onSaved(car ? 'Cartel actualizado' : 'Cartel registrado'); } catch (e: any) { onError(e.message); } finally { setBusy(false); } }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{car ? 'Editar cartel' : 'Nuevo cartel'}</h3>
        <div className="grid2">
          <div className="field"><label>Tipo de cartel</label><input className="input" list="car-tipos" value={f.tipo} onChange={set('tipo')} /><datalist id="car-tipos">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist></div>
          <div className="field"><label>Ubicación</label><input className="input" value={f.ubicacion} onChange={set('ubicacion')} /></div>
          <div className="field"><label>Fecha de instalación</label><input className="input" type="date" value={f.fechaInstalacion} onChange={set('fechaInstalacion')} /></div>
          <div className="field"><label>Fecha de revisión</label><input className="input" type="date" value={f.fechaRevision} onChange={set('fechaRevision')} /></div>
          <div className="field"><label>Estado de conservación</label><select className="input" value={f.estadoConservacion} onChange={set('estadoConservacion')}>{ESTADOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Evidencia fotográfica</label>
          <input type="file" accept="image/*,.pdf" onChange={onFile} />
          {archivo && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nuevo: {archivo.nombre}</div>}
          {!archivo && car?.tieneArchivo && !quitar && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Actual: {car.archivoNombre} · <a style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => setQuitar(true)}>quitar</a></div>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
