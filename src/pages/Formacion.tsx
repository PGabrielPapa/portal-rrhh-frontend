import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';
import EmpleadoPicker from '../components/EmpleadoPicker';

// Formación / Capacitación (LMS estilo Meta4 PeopleNet).
interface Curso { id: number; nombre: string; descripcion?: string; proveedor?: string; modalidad?: string; horas: number; activo: boolean; inscriptos: number; }
interface Insc { id: number; empleado_id: number; nom: string; leg_num: string; empresa: string; fecha?: string; estado: string; calificacion?: number; costo?: number; }
const ESTADOS: [string, string][] = [['inscripto', 'Inscripto'], ['en_curso', 'En curso'], ['aprobado', 'Aprobado'], ['desaprobado', 'Desaprobado'], ['ausente', 'Ausente']];
const fmtF = (s?: string) => s ? new Date(s).toLocaleDateString('es-AR') : '—';

export default function Formacion() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [sel, setSel] = useState<Curso | null>(null);
  const [insc, setInsc] = useState<Insc[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [nuevo, setNuevo] = useState<Empleado | null>(null);
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');

  async function load() { try { setCursos(await api.get<Curso[]>('/formacion/cursos')); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { load(); }, []);
  async function abrir(c: Curso) { setSel(c); setMsg(''); setErr(''); try { setInsc(await api.get<Insc[]>(`/formacion/cursos/${c.id}/inscripciones`)); } catch (e: any) { setErr(e.message); } }

  async function guardarCurso() {
    setErr('');
    if (!edit.nombre?.trim()) { setErr('El nombre del curso es obligatorio'); return; }
    try { if (edit.id) await api.put(`/formacion/cursos/${edit.id}`, edit); else await api.post('/formacion/cursos', edit); setEdit(null); load(); }
    catch (e: any) { setErr(e.message); }
  }
  async function borrarCurso(c: Curso) { if (!window.confirm(`¿Eliminar el curso "${c.nombre}" y sus inscripciones?`)) return; try { await api.del(`/formacion/cursos/${c.id}`); if (sel?.id === c.id) { setSel(null); setInsc([]); } load(); } catch (e: any) { setErr(e.message); } }
  async function inscribir() { if (!sel || !nuevo) return; try { await api.post('/formacion/inscripciones', { cursoId: sel.id, empleadoId: nuevo.id, fecha: new Date().toISOString().slice(0, 10) }); setNuevo(null); abrir(sel); load(); } catch (e: any) { setErr(e.message); } }
  async function setEstado(i: Insc, estado: string) { try { await api.patch(`/formacion/inscripciones/${i.id}`, { estado }); if (sel) abrir(sel); } catch (e: any) { setErr(e.message); } }
  async function setCalif(i: Insc, calificacion: string) { try { await api.patch(`/formacion/inscripciones/${i.id}`, { calificacion }); if (sel) abrir(sel); } catch (e: any) { setErr(e.message); } }
  async function borrarInsc(i: Insc) { try { await api.del(`/formacion/inscripciones/${i.id}`); if (sel) abrir(sel); load(); } catch (e: any) { setErr(e.message); } }

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}
      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '0 0 340px', maxWidth: 380 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Cursos</h3>
            <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setEdit({ nombre: '', modalidad: 'presencial', horas: 0 })}>+ Nuevo</button>
          </div>
          {edit && (
            <div style={{ marginBottom: 10 }}>
              <input className="input" placeholder="Nombre del curso *" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} style={{ marginBottom: 6 }} />
              <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                <input className="input" style={{ flex: 1 }} placeholder="Proveedor" value={edit.proveedor || ''} onChange={(e) => setEdit({ ...edit, proveedor: e.target.value })} />
                <input className="input" style={{ width: 80 }} type="number" placeholder="Horas" value={edit.horas || ''} onChange={(e) => setEdit({ ...edit, horas: e.target.value })} />
              </div>
              <select className="input" value={edit.modalidad || 'presencial'} onChange={(e) => setEdit({ ...edit, modalidad: e.target.value })} style={{ marginBottom: 6 }}><option value="presencial">Presencial</option><option value="virtual">Virtual</option><option value="e-learning">E-learning</option></select>
              <textarea className="input" rows={2} placeholder="Descripción" value={edit.descripcion || ''} onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })} style={{ marginBottom: 6 }} />
              <button className="btn primary" onClick={guardarCurso}>Guardar</button> <button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button>
            </div>
          )}
          <div style={{ maxHeight: 460, overflow: 'auto' }}>
            {cursos.map((c) => (
              <div key={c.id} style={{ padding: '8px 10px', borderRadius: 8, background: sel?.id === c.id ? 'rgba(61,127,255,.12)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div onClick={() => abrir(c)} style={{ cursor: 'pointer', flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{c.nombre} {!c.activo && <span className="badge muted">inactivo</span>}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{c.modalidad || '—'} · {c.horas} hs · {c.inscriptos} inscripto(s)</div>
                  </div>
                  <div style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => setEdit({ ...c })}>✎</button>
                    <button className="btn ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => borrarCurso(c)}>✕</button>
                  </div>
                </div>
              </div>
            ))}
            {!cursos.length && <div className="muted" style={{ padding: 10 }}>Sin cursos.</div>}
          </div>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          {!sel ? <div className="muted">Elegí un curso para ver los inscriptos.</div> : (<>
            <h3 style={{ marginTop: 0 }}>{sel.nombre} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· {sel.horas} hs</span></h3>
            <div className="row" style={{ gap: 8, marginBottom: 10, alignItems: 'flex-end' }}>
              <div style={{ minWidth: 240 }}><label className="muted" style={{ fontSize: 12 }}>Inscribir empleado</label><EmpleadoPicker onSelect={setNuevo} /></div>
              <button className="btn" onClick={inscribir} disabled={!nuevo}>+ Inscribir</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--bg2)' }}>{['Empleado', 'Fecha', 'Estado', 'Calificación', ''].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {insc.map((i) => (
                  <tr key={i.id}>
                    <td style={{ padding: '4px 8px' }}>{i.nom} <span className="muted">({i.leg_num})</span></td>
                    <td style={{ padding: '4px 8px' }} className="muted">{fmtF(i.fecha)}</td>
                    <td style={{ padding: '4px 8px' }}><select className="input" style={{ padding: '2px 6px', fontSize: 12 }} value={i.estado} onChange={(e) => setEstado(i, e.target.value)}>{ESTADOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                    <td style={{ padding: '4px 8px' }}><input className="input" style={{ width: 70, padding: '2px 6px', fontSize: 12 }} type="number" defaultValue={i.calificacion ?? ''} onBlur={(e) => setCalif(i, e.target.value)} /></td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}><button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => borrarInsc(i)}>✕</button></td>
                  </tr>
                ))}
                {!insc.length && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 12 }}>Sin inscriptos.</td></tr>}
              </tbody>
            </table>
          </>)}
        </div>
      </div>
    </>
  );
}
