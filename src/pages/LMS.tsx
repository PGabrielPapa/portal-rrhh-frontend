import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Curso { id: number; nombre: string; horas: number; }
interface Modulo { id: number; orden: number; titulo: string; tipo: string; url?: string; contenido?: string; activo: boolean; }
interface Itin { id: number; nombre: string; descripcion?: string; activo: boolean; cursos: { cursoId: number; nombre: string; horas: number; orden: number }[]; }

const TIPOS = ['lectura', 'video', 'quiz', 'tarea'];

export default function LMS() {
  const [tab, setTab] = useState<'contenidos' | 'itinerarios'>('contenidos');
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cursoSel, setCursoSel] = useState<number | null>(null);
  const [mods, setMods] = useState<Modulo[]>([]);
  const [nuevo, setNuevo] = useState({ titulo: '', tipo: 'lectura', url: '' });
  const [itins, setItins] = useState<Itin[]>([]);
  const [itNombre, setItNombre] = useState('');
  const [itCursos, setItCursos] = useState<number[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  useEffect(() => { api.get<Curso[]>('/formacion/cursos').then((c) => { setCursos(c); if (c[0]) setCursoSel(c[0].id); }).catch(() => {}); }, []);
  useEffect(() => { if (cursoSel != null) api.get<Modulo[]>(`/lms/cursos/${cursoSel}/modulos`).then(setMods).catch(() => setMods([])); }, [cursoSel]);
  useEffect(() => { if (tab === 'itinerarios') cargarItin(); /* eslint-disable-next-line */ }, [tab]);
  function cargarItin() { api.get<Itin[]>('/lms/itinerarios').then(setItins).catch(() => {}); }

  async function addModulo() {
    if (!cursoSel || !nuevo.titulo.trim()) return;
    try { await api.post(`/lms/cursos/${cursoSel}/modulos`, { ...nuevo, orden: mods.length }); setNuevo({ titulo: '', tipo: 'lectura', url: '' }); const m = await api.get<Modulo[]>(`/lms/cursos/${cursoSel}/modulos`); setMods(m); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function delModulo(id: number) {
    if (!confirm('¿Borrar el módulo?')) return;
    try { await api.del(`/lms/modulos/${id}`); setMods(mods.filter((m) => m.id !== id)); } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function crearItin() {
    if (!itNombre.trim()) return;
    try { await api.post('/lms/itinerarios', { nombre: itNombre.trim(), cursos: itCursos }); setItNombre(''); setItCursos([]); setMsg({ t: 'Itinerario creado', ok: true }); cargarItin(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function delItin(id: number) {
    if (!confirm('¿Borrar el itinerario?')) return;
    try { await api.del(`/lms/itinerarios/${id}`); cargarItin(); } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button className={`btn ${tab === 'contenidos' ? '' : 'ghost'}`} onClick={() => setTab('contenidos')}>Contenidos de cursos</button>
        <button className={`btn ${tab === 'itinerarios' ? '' : 'ghost'}`} onClick={() => setTab('itinerarios')}>Itinerarios (rutas de aprendizaje)</button>
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}

      {tab === 'contenidos' && (
        <>
          <div className="row" style={{ marginBottom: 12, gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field"><label>Curso</label>
              <select className="input" style={{ minWidth: 260 }} value={cursoSel ?? ''} onChange={(e) => setCursoSel(Number(e.target.value))}>
                {cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          {cursos.length === 0 && <div className="muted">No hay cursos. Cargalos en «Formación / Capacitación».</div>}
          {cursoSel != null && <>
            <div className="card" style={{ marginBottom: 12 }}>
              <h4 style={{ marginTop: 0 }}>Agregar módulo / lección</h4>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: '2 1 220px' }}><label>Título</label><input className="input" value={nuevo.titulo} onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })} /></div>
                <div className="field"><label>Tipo</label><select className="input" value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                <div className="field" style={{ flex: '2 1 220px' }}><label>URL (opcional)</label><input className="input" value={nuevo.url} onChange={(e) => setNuevo({ ...nuevo, url: e.target.value })} placeholder="https://…" /></div>
                <button className="btn" onClick={addModulo}>Agregar</button>
              </div>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              <table>
                <thead><tr><th style={{ width: 40 }}>#</th><th>Título</th><th>Tipo</th><th>Recurso</th><th></th></tr></thead>
                <tbody>
                  {mods.map((m, i) => (
                    <tr key={m.id}>
                      <td className="muted">{i + 1}</td>
                      <td>{m.titulo}</td>
                      <td><span className="badge">{m.tipo}</span></td>
                      <td>{m.url ? <a href={m.url} target="_blank" rel="noreferrer">abrir</a> : <span className="muted">—</span>}</td>
                      <td style={{ textAlign: 'right' }}><button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => delModulo(m.id)}>Borrar</button></td>
                    </tr>
                  ))}
                  {!mods.length && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 16 }}>Este curso no tiene módulos todavía.</td></tr>}
                </tbody>
              </table>
            </div>
          </>}
        </>
      )}

      {tab === 'itinerarios' && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ marginTop: 0 }}>Nuevo itinerario</h4>
            <div className="field" style={{ marginBottom: 8 }}><label>Nombre</label><input className="input" value={itNombre} onChange={(e) => setItNombre(e.target.value)} placeholder="Ej.: Inducción a líderes" /></div>
            <label className="muted" style={{ fontSize: 12 }}>Cursos incluidos (en orden de selección)</label>
            <div className="grid2" style={{ marginTop: 4 }}>
              {cursos.map((c) => {
                const idx = itCursos.indexOf(c.id);
                return (
                  <label key={c.id} className="row" style={{ gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={idx >= 0} onChange={(e) => setItCursos((prev) => e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id))} />
                    {idx >= 0 && <b>{idx + 1}.</b>} {c.nombre} <span className="muted">({c.horas} h)</span>
                  </label>
                );
              })}
            </div>
            <button className="btn" style={{ marginTop: 10 }} onClick={crearItin} disabled={!itNombre.trim() || !itCursos.length}>Crear itinerario</button>
          </div>
          {itins.map((it) => (
            <div key={it.id} className="card" style={{ marginBottom: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{it.nombre}</b>
                <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => delItin(it.id)}>Borrar</button>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                {it.cursos.length === 0 ? 'Sin cursos.' : it.cursos.map((c, i) => `${i + 1}. ${c.nombre}`).join('  →  ')}
                {it.cursos.length > 0 && <span> · {it.cursos.reduce((a, c) => a + c.horas, 0)} h totales</span>}
              </div>
            </div>
          ))}
          {!itins.length && <div className="muted">No hay itinerarios creados.</div>}
        </>
      )}
    </>
  );
}
