import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';
import EmpleadoPicker from '../components/EmpleadoPicker';

// Onboarding: plantilla de tareas de alta + checklist por empleado.
export default function Onboarding() {
  const [plant, setPlant] = useState<any[]>([]);
  const [np, setNp] = useState<any>({ tarea: '', responsable: '' });
  const [sel, setSel] = useState<Empleado | null>(null);
  const [tareas, setTareas] = useState<any[]>([]);
  const [nt, setNt] = useState<any>({ tarea: '', responsable: '' });
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');

  async function loadPlant() { try { setPlant(await api.get<any[]>('/talento/onboarding/plantilla')); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { loadPlant(); }, []);
  async function abrir(e: Empleado | null) { setSel(e); setMsg(''); setErr(''); if (!e) { setTareas([]); return; } try { setTareas(await api.get<any[]>(`/talento/onboarding/${e.id}`)); } catch (er: any) { setErr(er.message); } }

  async function addPlant() { if (!np.tarea.trim()) return; try { await api.post('/talento/onboarding/plantilla', { ...np, orden: plant.length }); setNp({ tarea: '', responsable: '' }); loadPlant(); } catch (e: any) { setErr(e.message); } }
  async function delPlant(id: number) { try { await api.del(`/talento/onboarding/plantilla/${id}`); loadPlant(); } catch (e: any) { setErr(e.message); } }

  async function iniciar() { if (!sel) return; try { await api.post(`/talento/onboarding/${sel.id}/iniciar`, {}); abrir(sel); } catch (e: any) { setErr(e.message); } }
  async function addTarea() { if (!sel || !nt.tarea.trim()) return; try { await api.post(`/talento/onboarding/${sel.id}/tarea`, { ...nt, orden: tareas.length }); setNt({ tarea: '', responsable: '' }); abrir(sel); } catch (e: any) { setErr(e.message); } }
  async function toggle(t: any) { try { await api.patch(`/talento/onboarding/tarea/${t.id}`, { hecho: !t.hecho }); abrir(sel); } catch (e: any) { setErr(e.message); } }
  async function delTarea(t: any) { try { await api.del(`/talento/onboarding/tarea/${t.id}`); abrir(sel); } catch (e: any) { setErr(e.message); } }

  const hechas = tareas.filter((t) => t.hecho).length;

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}
      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '0 0 320px', maxWidth: 360 }}>
          <h3 style={{ marginTop: 0 }}>Plantilla de tareas</h3>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Se copian al iniciar el onboarding de un empleado.</p>
          {plant.map((p) => (
            <div key={p.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
              <span style={{ fontSize: 13 }}>{p.tarea} {p.responsable && <span className="muted">· {p.responsable}</span>}</span>
              <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => delPlant(p.id)}>✕</button>
            </div>
          ))}
          <div className="row" style={{ gap: 6, marginTop: 8 }}>
            <input className="input" style={{ flex: 1 }} placeholder="Tarea" value={np.tarea} onChange={(e) => setNp({ ...np, tarea: e.target.value })} />
            <input className="input" style={{ width: 110 }} placeholder="Responsable" value={np.responsable} onChange={(e) => setNp({ ...np, responsable: e.target.value })} />
            <button className="btn" onClick={addPlant}>+</button>
          </div>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <h3 style={{ marginTop: 0 }}>Onboarding por empleado</h3>
          <div style={{ maxWidth: 320, marginBottom: 10 }}><EmpleadoPicker onSelect={abrir} /></div>
          {sel && (<>
            {!tareas.length ? <button className="btn primary" onClick={iniciar}>Iniciar onboarding (copiar plantilla)</button> : (<>
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Progreso: {hechas}/{tareas.length}</div>
              {tareas.map((t) => (
                <div key={t.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '5px 0' }}>
                  <label className="row" style={{ gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={t.hecho} onChange={() => toggle(t)} /> <span style={{ textDecoration: t.hecho ? 'line-through' : 'none' }}>{t.tarea}</span>{t.responsable && <span className="muted" style={{ fontSize: 12 }}>· {t.responsable}</span>}</label>
                  <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => delTarea(t)}>✕</button>
                </div>
              ))}
              <div className="row" style={{ gap: 6, marginTop: 8 }}>
                <input className="input" style={{ flex: 1 }} placeholder="Nueva tarea" value={nt.tarea} onChange={(e) => setNt({ ...nt, tarea: e.target.value })} />
                <input className="input" style={{ width: 110 }} placeholder="Responsable" value={nt.responsable} onChange={(e) => setNt({ ...nt, responsable: e.target.value })} />
                <button className="btn" onClick={addTarea}>+</button>
              </div>
            </>)}
          </>)}
        </div>
      </div>
    </>
  );
}
