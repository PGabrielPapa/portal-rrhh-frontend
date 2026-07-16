import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Pos { id: number; nombre: string; puestoId?: number | null; puesto?: string; unidadId?: number | null; unidad?: string; empresa?: string; dotacion: number; estado: string; ocupadas: number; vacantes: number; }
const ESTADOS = ['abierta', 'congelada', 'cerrada'];

export default function Posiciones() {
  const [items, setItems] = useState<Pos[]>([]);
  const [puestos, setPuestos] = useState<{ id: number; nombre: string }[]>([]);
  const [unidades, setUnidades] = useState<{ id: number; nombre: string }[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() { api.get<Pos[]>('/posiciones').then(setItems).catch(() => {}); }
  useEffect(() => { cargar(); api.get<any[]>('/puestos').then(setPuestos).catch(() => {}); api.get<any[]>('/unidades').then(setUnidades).catch(() => {}); }, []);

  async function guardar() {
    if (!edit || !edit.nombre?.trim()) return;
    try { if (edit.id) await api.put(`/posiciones/${edit.id}`, edit); else await api.post('/posiciones', edit); setEdit(null); setMsg({ t: 'Posición guardada', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(p: Pos) { if (!confirm(`¿Borrar "${p.nombre}"?`)) return; try { await api.del(`/posiciones/${p.id}`); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  const totVac = items.reduce((a, p) => a + p.vacantes, 0);
  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>Posiciones con dotación planificada vs. ocupada. Las vacantes (dotación − ocupadas) marcan las búsquedas a abrir.</p>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      <div className="row" style={{ gap: 10, marginBottom: 12, alignItems: 'center' }}>
        {!edit && <button className="btn" onClick={() => setEdit({ nombre: '', puestoId: null, unidadId: null, dotacion: 1, estado: 'abierta' })}>+ Nueva posición</button>}
        <span className="badge" style={{ color: totVac > 0 ? 'var(--yellow)' : 'var(--green)' }}>{totVac} vacante(s) en total</span>
      </div>

      {edit && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>{edit.id ? 'Editar' : 'Nueva'} posición</h4>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '2 1 220px' }}><label>Nombre</label><input className="input" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></div>
            <div className="field"><label>Puesto</label><select className="input" value={edit.puestoId || ''} onChange={(e) => setEdit({ ...edit, puestoId: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{puestos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
            <div className="field"><label>Unidad</label><select className="input" value={edit.unidadId || ''} onChange={(e) => setEdit({ ...edit, unidadId: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
            <div className="field"><label>Dotación</label><input className="input" style={{ width: 90 }} type="number" value={edit.dotacion} onChange={(e) => setEdit({ ...edit, dotacion: Number(e.target.value) })} /></div>
            <div className="field"><label>Estado</label><select className="input" value={edit.estado} onChange={(e) => setEdit({ ...edit, estado: e.target.value })}>{ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 12 }}><button className="btn" onClick={guardar} disabled={!edit.nombre?.trim()}>Guardar</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Posición</th><th>Puesto</th><th>Unidad</th><th style={{ textAlign: 'right' }}>Dotación</th><th style={{ textAlign: 'right' }}>Ocupadas</th><th style={{ textAlign: 'right' }}>Vacantes</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td><td>{p.puesto || '—'}</td><td>{p.unidad || '—'}</td>
                <td style={{ textAlign: 'right' }}>{p.dotacion}</td><td style={{ textAlign: 'right' }}>{p.ocupadas}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: p.vacantes > 0 ? 'var(--yellow)' : 'var(--green)' }}>{p.vacantes}</td>
                <td><span className="badge">{p.estado}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12, marginRight: 6 }} onClick={() => setEdit({ ...p })}>Editar</button>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => borrar(p)}>Borrar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 20 }}>No hay posiciones.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
