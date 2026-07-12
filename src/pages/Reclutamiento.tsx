import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Reclutamiento / Selección (ATS estilo Meta4 PeopleNet).
interface Busqueda { id: number; titulo: string; empresa?: string; puesto_id?: number; puesto_nombre?: string; descripcion?: string; estado: string; candidatos: number; }
interface Cand { id: number; nombre: string; email?: string; telefono?: string; etapa: string; nota?: string; }
const ETAPAS: [string, string][] = [['postulado', 'Postulado'], ['entrevista', 'Entrevista'], ['oferta', 'Oferta'], ['contratado', 'Contratado'], ['descartado', 'Descartado']];
const etLbl = (e: string) => ETAPAS.find(([v]) => v === e)?.[1] || e;
const etColor = (e: string) => e === 'contratado' ? 'var(--green)' : e === 'descartado' ? 'var(--red)' : e === 'oferta' ? 'var(--accent2, #3d7fff)' : 'var(--yellow)';

export default function Reclutamiento() {
  const [bus, setBus] = useState<Busqueda[]>([]);
  const [sel, setSel] = useState<Busqueda | null>(null);
  const [cands, setCands] = useState<Cand[]>([]);
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const [nuevaBus, setNuevaBus] = useState(false);
  const [fb, setFb] = useState<any>({ titulo: '', empresa: '', descripcion: '' });
  const [fc, setFc] = useState<any>({ nombre: '', email: '', telefono: '', nota: '' });

  async function load() { try { setBus(await api.get<Busqueda[]>('/reclutamiento/busquedas')); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { load(); }, []);
  async function abrir(b: Busqueda) { setSel(b); setMsg(''); setErr(''); try { setCands(await api.get<Cand[]>(`/reclutamiento/busquedas/${b.id}/candidatos`)); } catch (e: any) { setErr(e.message); } }

  async function crearBus() {
    setErr('');
    if (!fb.titulo.trim()) { setErr('El título es obligatorio'); return; }
    try { await api.post('/reclutamiento/busquedas', fb); setNuevaBus(false); setFb({ titulo: '', empresa: '', descripcion: '' }); load(); }
    catch (e: any) { setErr(e.message); }
  }
  async function cerrarAbrir(b: Busqueda) { try { await api.put(`/reclutamiento/busquedas/${b.id}`, { ...b, puestoId: b.puesto_id, estado: b.estado === 'abierta' ? 'cerrada' : 'abierta' }); load(); if (sel?.id === b.id) setSel({ ...b, estado: b.estado === 'abierta' ? 'cerrada' : 'abierta' }); } catch (e: any) { setErr(e.message); } }
  async function borrarBus(b: Busqueda) { if (!window.confirm(`¿Eliminar la búsqueda "${b.titulo}" y sus candidatos?`)) return; try { await api.del(`/reclutamiento/busquedas/${b.id}`); if (sel?.id === b.id) { setSel(null); setCands([]); } load(); } catch (e: any) { setErr(e.message); } }

  async function agregarCand() {
    if (!sel) return; setErr('');
    if (!fc.nombre.trim()) { setErr('El nombre del candidato es obligatorio'); return; }
    try { await api.post('/reclutamiento/candidatos', { ...fc, busquedaId: sel.id }); setFc({ nombre: '', email: '', telefono: '', nota: '' }); abrir(sel); load(); }
    catch (e: any) { setErr(e.message); }
  }
  async function moverCand(c: Cand, etapa: string) { try { await api.patch(`/reclutamiento/candidatos/${c.id}`, { etapa }); if (sel) { abrir(sel); load(); } } catch (e: any) { setErr(e.message); } }
  async function borrarCand(c: Cand) { if (!window.confirm(`¿Eliminar a ${c.nombre}?`)) return; try { await api.del(`/reclutamiento/candidatos/${c.id}`); if (sel) { abrir(sel); load(); } } catch (e: any) { setErr(e.message); } }

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}

      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '0 0 320px', maxWidth: 360 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Búsquedas</h3>
            <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setNuevaBus((v) => !v)}>+ Nueva</button>
          </div>
          {nuevaBus && (
            <div style={{ marginBottom: 10 }}>
              <input className="input" placeholder="Título del puesto a cubrir *" value={fb.titulo} onChange={(e) => setFb({ ...fb, titulo: e.target.value })} style={{ marginBottom: 6 }} />
              <input className="input" placeholder="Empresa" value={fb.empresa} onChange={(e) => setFb({ ...fb, empresa: e.target.value })} style={{ marginBottom: 6 }} />
              <textarea className="input" rows={2} placeholder="Descripción" value={fb.descripcion} onChange={(e) => setFb({ ...fb, descripcion: e.target.value })} style={{ marginBottom: 6 }} />
              <button className="btn primary" onClick={crearBus}>Crear</button>
            </div>
          )}
          <div style={{ maxHeight: 460, overflow: 'auto' }}>
            {bus.map((b) => (
              <div key={b.id} onClick={() => abrir(b)} style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 8, background: sel?.id === b.id ? 'rgba(61,127,255,.12)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13 }}>{b.titulo} {b.estado === 'cerrada' && <span className="badge muted">cerrada</span>}</div>
                <div className="muted" style={{ fontSize: 11 }}>{b.empresa || '—'} · {b.candidatos} candidato(s)</div>
              </div>
            ))}
            {!bus.length && <div className="muted" style={{ padding: 10 }}>Sin búsquedas.</div>}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 320 }}>
          {!sel ? <div className="card muted">Elegí una búsqueda para ver los candidatos.</div> : (<>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div><strong>{sel.titulo}</strong> <span className="muted">{sel.empresa ? '· ' + sel.empresa : ''} · {sel.estado}</span></div>
                <div>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12, marginRight: 6 }} onClick={() => cerrarAbrir(sel)}>{sel.estado === 'abierta' ? 'Cerrar búsqueda' : 'Reabrir'}</button>
                  <button className="btn danger" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => borrarBus(sel)}>Eliminar</button>
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'flex-end' }}>
                <input className="input" style={{ maxWidth: 200 }} placeholder="Nombre candidato *" value={fc.nombre} onChange={(e) => setFc({ ...fc, nombre: e.target.value })} />
                <input className="input" style={{ maxWidth: 180 }} placeholder="Email" value={fc.email} onChange={(e) => setFc({ ...fc, email: e.target.value })} />
                <input className="input" style={{ maxWidth: 140 }} placeholder="Teléfono" value={fc.telefono} onChange={(e) => setFc({ ...fc, telefono: e.target.value })} />
                <button className="btn" onClick={agregarCand}>+ Agregar candidato</button>
              </div>
            </div>

            <div className="row" style={{ gap: 10, alignItems: 'flex-start', overflowX: 'auto' }}>
              {ETAPAS.map(([et, lbl]) => {
                const col = cands.filter((c) => c.etapa === et);
                return (
                  <div key={et} style={{ flex: '1 0 180px', minWidth: 180 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: etColor(et) }}>{lbl} <span className="muted" style={{ fontWeight: 400 }}>({col.length})</span></div>
                    {col.map((c) => (
                      <div key={c.id} className="card" style={{ padding: '8px 10px', marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.nombre}</div>
                        {(c.email || c.telefono) && <div className="muted" style={{ fontSize: 11 }}>{[c.email, c.telefono].filter(Boolean).join(' · ')}</div>}
                        <div className="row" style={{ gap: 4, marginTop: 6, alignItems: 'center' }}>
                          <select className="input" style={{ padding: '2px 6px', fontSize: 12 }} value={c.etapa} onChange={(e) => moverCand(c, e.target.value)}>
                            {ETAPAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => borrarCand(c)}>✕</button>
                        </div>
                      </div>
                    ))}
                    {!col.length && <div className="muted" style={{ fontSize: 11, padding: 6 }}>—</div>}
                  </div>
                );
              })}
            </div>
          </>)}
        </div>
      </div>
    </>
  );
}
