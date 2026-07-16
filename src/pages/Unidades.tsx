import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import EmpleadoPicker from '../components/EmpleadoPicker';

interface Unidad { id: number; nombre: string; tipo: string; padreId?: number | null; responsableId?: number | null; responsableNom?: string; empresa?: string; activo: boolean; ocupantes: number; }
const TIPOS = ['direccion', 'gerencia', 'area', 'sector', 'otro'];

export default function Unidades() {
  const [items, setItems] = useState<Unidad[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() { api.get<Unidad[]>('/unidades').then(setItems).catch(() => {}); }
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    if (!edit || !edit.nombre?.trim()) return;
    try { if (edit.id) await api.put(`/unidades/${edit.id}`, edit); else await api.post('/unidades', edit); setEdit(null); setMsg({ t: 'Unidad guardada', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(u: Unidad) { if (!confirm(`¿Borrar "${u.nombre}"?`)) return; try { await api.del(`/unidades/${u.id}`); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  // Árbol simple por padreId.
  const hijos = (pid: number | null) => items.filter((u) => (u.padreId || null) === pid);
  const nombreUnidad = (id?: number | null) => items.find((u) => u.id === id)?.nombre || '—';
  function Nodo({ u, nivel }: { u: Unidad; nivel: number }) {
    return (
      <>
        <div className="row" style={{ justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid var(--border)' }}>
          <span style={{ paddingLeft: nivel * 18, fontSize: 14 }}>
            {nivel > 0 && <span className="muted">└ </span>}<b>{u.nombre}</b> <span className="badge" style={{ marginLeft: 4 }}>{u.tipo}</span>
            <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>{u.ocupantes} pers.{u.responsableNom ? ` · resp: ${u.responsableNom}` : ''}</span>
          </span>
          <span style={{ whiteSpace: 'nowrap' }}>
            <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12, marginRight: 4 }} onClick={() => setEdit({ ...u })}>Editar</button>
            <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => borrar(u)}>Borrar</button>
          </span>
        </div>
        {hijos(u.id).map((h) => <Nodo key={h.id} u={h} nivel={nivel + 1} />)}
      </>
    );
  }

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>Árbol de unidades organizativas (dirección → gerencia → área → sector). El legajo se asigna a una unidad desde el ABM de Empleados.</p>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {!edit && <button className="btn" style={{ marginBottom: 12 }} onClick={() => setEdit({ nombre: '', tipo: 'area', padreId: '', responsableId: null, activo: true })}>+ Nueva unidad</button>}

      {edit && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>{edit.id ? 'Editar' : 'Nueva'} unidad</h4>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '2 1 220px' }}><label>Nombre</label><input className="input" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></div>
            <div className="field"><label>Tipo</label><select className="input" value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="field"><label>Depende de</label><select className="input" value={edit.padreId || ''} onChange={(e) => setEdit({ ...edit, padreId: e.target.value ? Number(e.target.value) : null })}><option value="">— Raíz —</option>{items.filter((u) => u.id !== edit.id).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
          </div>
          <div className="field" style={{ marginTop: 8, maxWidth: 340 }}><label>Responsable (opcional)</label><EmpleadoPicker value={edit.responsableNom} onSelect={(e) => setEdit({ ...edit, responsableId: e ? e.id : null })} /></div>
          <div className="row" style={{ gap: 6, marginTop: 12 }}><button className="btn" onClick={guardar} disabled={!edit.nombre?.trim()}>Guardar</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Organigrama por unidad</h4>
        {hijos(null).map((u) => <Nodo key={u.id} u={u} nivel={0} />)}
        {!items.length && <div className="muted">No hay unidades cargadas.</div>}
      </div>
    </>
  );
}
