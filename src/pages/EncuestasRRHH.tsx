import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Encuestas de clima — gestión RR.HH.: crear, preguntas, abrir/cerrar y resultados.
interface Enc { id: number; titulo: string; descripcion?: string; anonima: boolean; estado: string; respondieron: number; preguntas: number; }
const ESTADOS: Record<string, string> = { borrador: 'Borrador', abierta: 'Abierta', cerrada: 'Cerrada' };

export default function EncuestasRRHH() {
  const [items, setItems] = useState<Enc[]>([]);
  const [sel, setSel] = useState<Enc | null>(null);
  const [preg, setPreg] = useState<any[]>([]);
  const [res, setRes] = useState<any>(null);
  const [nueva, setNueva] = useState<any>(null);
  const [np, setNp] = useState<any>({ texto: '', tipo: 'escala' });
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');

  async function load() { try { setItems(await api.get<Enc[]>('/encuestas')); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { load(); }, []);
  async function abrir(e: Enc) { setSel(e); setRes(null); setMsg(''); setErr(''); try { setPreg(await api.get<any[]>(`/encuestas/${e.id}/preguntas`)); } catch (er: any) { setErr(er.message); } }

  async function crear() { setErr(''); if (!nueva.titulo?.trim()) { setErr('El título es obligatorio'); return; } try { await api.post('/encuestas', nueva); setNueva(null); load(); } catch (e: any) { setErr(e.message); } }
  async function cambiarEstado(e: Enc, estado: string) { try { await api.put(`/encuestas/${e.id}`, { estado }); load(); if (sel?.id === e.id) setSel({ ...e, estado }); } catch (er: any) { setErr(er.message); } }
  async function borrar(e: Enc) { if (!window.confirm(`¿Eliminar la encuesta "${e.titulo}"?`)) return; try { await api.del(`/encuestas/${e.id}`); if (sel?.id === e.id) setSel(null); load(); } catch (er: any) { setErr(er.message); } }
  async function addPreg() { if (!sel || !np.texto.trim()) return; try { await api.post(`/encuestas/${sel.id}/preguntas`, { ...np, orden: preg.length }); setNp({ texto: '', tipo: 'escala' }); abrir(sel); load(); } catch (e: any) { setErr(e.message); } }
  async function delPreg(id: number) { try { await api.del(`/encuestas/preguntas/${id}`); if (sel) abrir(sel); load(); } catch (e: any) { setErr(e.message); } }
  async function verResultados() { if (!sel) return; try { setRes(await api.get<any>(`/encuestas/${sel.id}/resultados`)); } catch (e: any) { setErr(e.message); } }

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}
      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '0 0 320px', maxWidth: 360 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Encuestas</h3>
            <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setNueva({ titulo: '', descripcion: '', anonima: true })}>+ Nueva</button>
          </div>
          {nueva && (
            <div style={{ marginBottom: 10 }}>
              <input className="input" placeholder="Título *" value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} style={{ marginBottom: 6 }} />
              <textarea className="input" rows={2} placeholder="Descripción" value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })} style={{ marginBottom: 6 }} />
              <label className="row" style={{ gap: 6, cursor: 'pointer', marginBottom: 6 }}><input type="checkbox" checked={nueva.anonima} onChange={(e) => setNueva({ ...nueva, anonima: e.target.checked })} /> Anónima</label>
              <button className="btn primary" onClick={crear}>Crear</button> <button className="btn ghost" onClick={() => setNueva(null)}>Cancelar</button>
            </div>
          )}
          <div style={{ maxHeight: 460, overflow: 'auto' }}>
            {items.map((e) => (
              <div key={e.id} onClick={() => abrir(e)} style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 8, background: sel?.id === e.id ? 'rgba(61,127,255,.12)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13 }}>{e.titulo} <span className="badge">{ESTADOS[e.estado]}</span></div>
                <div className="muted" style={{ fontSize: 11 }}>{e.preguntas} pregunta(s) · {e.respondieron} respondieron{e.anonima ? ' · anónima' : ''}</div>
              </div>
            ))}
            {!items.length && <div className="muted" style={{ padding: 10 }}>Sin encuestas.</div>}
          </div>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          {!sel ? <div className="muted">Elegí una encuesta.</div> : (<>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0 }}>{sel.titulo}</h3>
              <div>
                {sel.estado === 'borrador' && <button className="btn" style={{ padding: '3px 10px', fontSize: 12, marginRight: 6 }} onClick={() => cambiarEstado(sel, 'abierta')}>Abrir</button>}
                {sel.estado === 'abierta' && <button className="btn" style={{ padding: '3px 10px', fontSize: 12, marginRight: 6 }} onClick={() => cambiarEstado(sel, 'cerrada')}>Cerrar</button>}
                <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12, marginRight: 6 }} onClick={verResultados}>Resultados</button>
                <button className="btn danger" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => borrar(sel)}>Eliminar</button>
              </div>
            </div>

            {!res ? (<>
              <h4 style={{ margin: '10px 0 6px' }}>Preguntas</h4>
              {preg.map((p) => (
                <div key={p.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
                  <span style={{ fontSize: 13 }}>{p.texto} <span className="muted">· {p.tipo === 'escala' ? 'escala 1-5' : 'texto'}</span></span>
                  <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => delPreg(p.id)}>✕</button>
                </div>
              ))}
              {sel.estado === 'borrador' ? (
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  <input className="input" style={{ flex: 1 }} placeholder="Nueva pregunta" value={np.texto} onChange={(e) => setNp({ ...np, texto: e.target.value })} />
                  <select className="input" style={{ width: 120 }} value={np.tipo} onChange={(e) => setNp({ ...np, tipo: e.target.value })}><option value="escala">Escala 1-5</option><option value="texto">Texto</option></select>
                  <button className="btn" onClick={addPreg}>+</button>
                </div>
              ) : <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Para editar preguntas, la encuesta debe estar en borrador.</p>}
            </>) : (<>
              <h4 style={{ margin: '10px 0 6px' }}>Resultados <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {res.respondieron} respondieron</span></h4>
              {res.preguntas.map((p: any) => (
                <div key={p.id} style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.texto}</div>
                  {p.tipo === 'escala' ? (
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      <div className="muted">Promedio: <strong style={{ color: 'var(--green)' }}>{p.promedio ?? '—'}</strong> / 5 ({p.respuestas} resp.)</div>
                      <div className="row" style={{ gap: 8, marginTop: 4, flexWrap: 'wrap' }}>{[1, 2, 3, 4, 5].map((n) => <span key={n} className="badge">{n}★: {p.distribucion[n] || 0}</span>)}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, marginTop: 4 }}>{(p.textos || []).length ? p.textos.map((t: string, i: number) => <div key={i} className="muted" style={{ borderLeft: '2px solid var(--border)', paddingLeft: 8, marginBottom: 3 }}>{t}</div>) : <span className="muted">Sin respuestas.</span>}</div>
                  )}
                </div>
              ))}
              <button className="btn ghost" onClick={() => setRes(null)}>Volver a preguntas</button>
            </>)}
          </>)}
        </div>
      </div>
    </>
  );
}
