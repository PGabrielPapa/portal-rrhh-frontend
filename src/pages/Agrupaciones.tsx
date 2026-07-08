import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';
import EmpleadoPicker from '../components/EmpleadoPicker';

// Agrupaciones auxiliares (Tango): grupos libres de legajos para filtrar reportes.
interface Agr { id: number; nombre: string; descripcion?: string; activo: boolean; miembros: number; }
interface Miembro { id: number; nom: string; legNum: string; empresa: string; }

export default function Agrupaciones() {
  const [items, setItems] = useState<Agr[]>([]);
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [sel, setSel] = useState<Agr | null>(null);
  const [miembros, setMiembros] = useState<Miembro[]>([]);

  async function load() { try { setItems(await api.get<Agr[]>('/agrupaciones')); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { load(); }, []);
  async function abrir(a: Agr) { setSel(a); setMsg(''); setErr(''); try { setMiembros(await api.get<Miembro[]>(`/agrupaciones/${a.id}/miembros`)); } catch (e: any) { setErr(e.message); } }

  async function guardar() {
    setErr('');
    if (!edit.nombre?.trim()) { setErr('El nombre es obligatorio'); return; }
    try {
      if (edit.id) await api.put(`/agrupaciones/${edit.id}`, { nombre: edit.nombre, descripcion: edit.descripcion, activo: true });
      else await api.post('/agrupaciones', { nombre: edit.nombre, descripcion: edit.descripcion });
      setEdit(null); load();
    } catch (e: any) { setErr(e.message); }
  }
  async function borrar(a: Agr) { if (!window.confirm(`¿Eliminar la agrupación "${a.nombre}"?`)) return; try { await api.del(`/agrupaciones/${a.id}`); if (sel?.id === a.id) setSel(null); load(); } catch (e: any) { setErr(e.message); } }
  async function agregar(e: Empleado | null) { if (!e || !sel) return; try { await api.post(`/agrupaciones/${sel.id}/miembros`, { empleadoId: e.id }); await abrir(sel); load(); } catch (er: any) { setErr(er.message); } }
  async function quitar(m: Miembro) { if (!sel) return; try { await api.del(`/agrupaciones/${sel.id}/miembros/${m.id}`); await abrir(sel); load(); } catch (e: any) { setErr(e.message); } }

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}
      <p className="muted" style={{ marginTop: 0 }}>Grupos libres de legajos (proyecto, sector, turno…) para filtrar el listado de empleados.</p>
      <div style={{ marginBottom: 12 }}><button className="btn primary" onClick={() => { setEdit({ nombre: '', descripcion: '' }); setErr(''); }}>+ Nueva agrupación</button></div>

      {edit && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>{edit.id ? 'Editar' : 'Nueva'} agrupación</h3>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field"><label>Nombre *</label><input className="input" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} placeholder="Ej: Proyecto Rosario" /></div>
            <div className="field" style={{ flex: 1, minWidth: 220 }}><label>Descripción</label><input className="input" value={edit.descripcion || ''} onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 12 }}><button className="btn primary" onClick={guardar}>Guardar</button> <button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 16 }}>
        <table>
          <thead><tr><th>Agrupación</th><th>Descripción</th><th>Miembros</th><th></th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} style={sel?.id === a.id ? { background: 'rgba(61,127,255,.08)' } : undefined}>
                <td><button className="btn ghost" style={{ padding: '2px 8px' }} onClick={() => abrir(a)}>{a.nombre}</button></td>
                <td className="muted">{a.descripcion || '—'}</td>
                <td>{a.miembros}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => { setEdit({ id: a.id, nombre: a.nombre, descripcion: a.descripcion }); }}>Editar</button>
                  <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => borrar(a)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>Todavía no definiste agrupaciones.</td></tr>}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Miembros de "{sel.nombre}" <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({miembros.length})</span></h3>
          <div style={{ maxWidth: 360, marginBottom: 10 }}><EmpleadoPicker onSelect={agregar} /></div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {miembros.map((m) => <span key={m.id} className="badge" style={{ cursor: 'pointer' }} onClick={() => quitar(m)} title="Quitar">{m.nom} ({m.legNum}) ✕</span>)}
            {!miembros.length && <span className="muted">Sin miembros. Agregá empleados con el buscador.</span>}
          </div>
        </div>
      )}
    </>
  );
}
