import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';

interface Pol { id: number; version?: string; vigencia?: string; comentario?: string; vigente?: boolean; archivoNombre?: string; tieneArchivo?: boolean }
interface Dif { id: number; fecha?: string; alcance?: string; observacion?: string; archivoNombre?: string; tieneArchivo?: boolean }
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };

function fileToB64(file: File): Promise<{ nombre: string; mime: string; data: string }> {
  return new Promise((resolve) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); resolve({ nombre: file.name, mime: file.type || 'application/octet-stream', data: s.slice(s.indexOf(',') + 1) }); }; r.readAsDataURL(file); });
}
async function descargar(url: string, nombre?: string) {
  const blob = await fetchBlob(url); const u = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = u; a.download = nombre || 'archivo'; a.click(); URL.revokeObjectURL(u);
}

export default function ChsPolitica() {
  const [pols, setPols] = useState<Pol[]>([]);
  const [difs, setDifs] = useState<Dif[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [showPol, setShowPol] = useState(false);
  const [showDif, setShowDif] = useState(false);

  async function load() {
    try { setPols(await api.get<Pol[]>('/chs/politica')); } catch (e: any) { setMsg({ t: e.message, ok: false }); }
    try { setDifs(await api.get<Dif[]>('/chs/difusion')); } catch { /* opcional */ }
  }
  useEffect(() => { load(); }, []);

  const vigente = pols.find((p) => p.vigente);
  async function marcarVigente(p: Pol) { try { await api.post(`/chs/politica/${p.id}/vigente`, {}); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  async function borrarPol(p: Pol) { if (!confirm('¿Eliminar esta versión de la política?')) return; try { await api.del(`/chs/politica/${p.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  async function borrarDif(d: Dif) { if (!confirm('¿Eliminar este registro de difusión?')) return; try { await api.del(`/chs/difusion/${d.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}

      <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--green)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Política vigente</h3>
          <button className="btn" onClick={() => setShowPol(true)}>+ Nueva versión</button>
        </div>
        {vigente ? (
          <div style={{ marginTop: 10 }}>
            <div><strong>{vigente.version || 'Política de HyS'}</strong> <span className="muted">· vigente desde {fmt(vigente.vigencia)}</span></div>
            {vigente.comentario && <div className="muted" style={{ marginTop: 4 }}>{vigente.comentario}</div>}
            {vigente.tieneArchivo && <button className="btn ghost" style={{ marginTop: 8, padding: '4px 10px', fontSize: 12 }} onClick={() => descargar(`/chs/politica/${vigente.id}/archivo`, vigente.archivoNombre)}>📎 Descargar política firmada</button>}
          </div>
        ) : <div className="muted" style={{ marginTop: 10 }}>No hay una política marcada como vigente. Cargá una versión y marcala como vigente.</div>}
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Versión</th><th>Vigencia</th><th>Comentario</th><th>Archivo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {pols.map((p) => (
              <tr key={p.id}>
                <td>{p.version || '—'}</td><td>{fmt(p.vigencia)}</td>
                <td className="muted">{p.comentario || '—'}</td>
                <td>{p.tieneArchivo ? <a style={{ cursor: 'pointer', color: 'var(--accent2)' }} onClick={() => descargar(`/chs/politica/${p.id}/archivo`, p.archivoNombre)}>📎 {p.archivoNombre}</a> : '—'}</td>
                <td>{p.vigente ? <span className="badge" style={{ color: 'var(--green)' }}>Vigente</span> : <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => marcarVigente(p)}>Marcar vigente</button>}</td>
                <td style={{ textAlign: 'right' }}><button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => borrarPol(p)}>Eliminar</button></td>
              </tr>
            ))}
            {!pols.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin versiones cargadas.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Registro de difusión al personal</h3>
          <button className="btn ghost" onClick={() => setShowDif(true)}>+ Registrar difusión</button>
        </div>
        <div style={{ marginTop: 10 }}>
          {difs.map((d) => (
            <div key={d.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div><strong>{fmt(d.fecha)}</strong> · {d.alcance || '—'} {d.observacion && <span className="muted">— {d.observacion}</span>}</div>
              <div className="row" style={{ gap: 6 }}>
                {d.tieneArchivo && <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => descargar(`/chs/difusion/${d.id}/archivo`, d.archivoNombre)}>📎</button>}
                <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => borrarDif(d)}>✕</button>
              </div>
            </div>
          ))}
          {!difs.length && <div className="muted" style={{ fontSize: 13 }}>Sin registros de difusión.</div>}
        </div>
      </div>

      {showPol && <PolModal onClose={() => setShowPol(false)} onSaved={() => { setShowPol(false); setMsg({ t: 'Versión cargada', ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
      {showDif && <DifModal onClose={() => setShowDif(false)} onSaved={() => { setShowDif(false); setMsg({ t: 'Difusión registrada', ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

function PolModal({ onClose, onSaved, onError }: { onClose: () => void; onSaved: () => void; onError: (t: string) => void }) {
  const [f, setF] = useState<any>({ version: '', vigencia: new Date().toISOString().slice(0, 10), comentario: '', vigente: true });
  const [archivo, setArchivo] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; if (file.size > 4.5 * 1024 * 1024) return onError('Máximo 4,5 MB'); setArchivo(await fileToB64(file)); }
  async function save() { setBusy(true); try { await api.post('/chs/politica', { ...f, archivo }); onSaved(); } catch (e: any) { onError(e.message); } finally { setBusy(false); } }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Nueva versión de la política</h3>
        <div className="grid2">
          <div className="field"><label>Versión / Rev.</label><input className="input" value={f.version} onChange={set('version')} placeholder="Ej.: Rev. 004" /></div>
          <div className="field"><label>Vigencia desde</label><input className="input" type="date" value={f.vigencia} onChange={set('vigencia')} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Comentario</label><textarea className="input" rows={2} value={f.comentario} onChange={set('comentario')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Política firmada (PDF/imagen/Office)</label><input type="file" accept=".pdf,image/*,.doc,.docx" onChange={onFile} />{archivo && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{archivo.nombre}</div>}</div>
        <label className="row" style={{ gap: 6, marginTop: 10, cursor: 'pointer' }}><input type="checkbox" checked={!!f.vigente} onChange={(e) => setF({ ...f, vigente: e.target.checked })} /> Marcar como política vigente</label>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function DifModal({ onClose, onSaved, onError }: { onClose: () => void; onSaved: () => void; onError: (t: string) => void }) {
  const [f, setF] = useState<any>({ fecha: new Date().toISOString().slice(0, 10), alcance: '', observacion: '' });
  const [archivo, setArchivo] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; if (file.size > 4.5 * 1024 * 1024) return onError('Máximo 4,5 MB'); setArchivo(await fileToB64(file)); }
  async function save() { setBusy(true); try { await api.post('/chs/difusion', { ...f, archivo }); onSaved(); } catch (e: any) { onError(e.message); } finally { setBusy(false); } }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Registrar difusión</h3>
        <div className="grid2">
          <div className="field"><label>Fecha</label><input className="input" type="date" value={f.fecha} onChange={set('fecha')} /></div>
          <div className="field"><label>Alcance / Sector</label><input className="input" value={f.alcance} onChange={set('alcance')} placeholder="Ej.: Todo el personal / Planta" /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Observación</label><textarea className="input" rows={2} value={f.observacion} onChange={set('observacion')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Constancia de difusión (opcional)</label><input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={onFile} />{archivo && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{archivo.nombre}</div>}</div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
