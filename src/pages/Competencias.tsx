import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Comp { id?: number; nombre: string; categoria?: string; descripcion?: string; niveles: { nivel: string; descripcion: string }[]; activo: boolean; }
const vacia: Comp = { nombre: '', categoria: '', descripcion: '', niveles: [], activo: true };

export default function Competencias() {
  const [items, setItems] = useState<Comp[]>([]);
  const [edit, setEdit] = useState<Comp | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() { api.get<Comp[]>('/competencias?todas=1').then(setItems).catch(() => {}); }
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    if (!edit || !edit.nombre.trim()) return;
    try { if (edit.id) await api.put(`/competencias/${edit.id}`, edit); else await api.post('/competencias', edit); setEdit(null); setMsg({ t: 'Competencia guardada', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(c: Comp) { if (!confirm(`¿Borrar "${c.nombre}"?`)) return; try { await api.del(`/competencias/${c.id}`); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>Catálogo central de competencias, reutilizable en Desempeño/9-box y Feedback 360°.</p>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {!edit && <button className="btn" style={{ marginBottom: 12 }} onClick={() => setEdit({ ...vacia, niveles: [] })}>+ Nueva competencia</button>}

      {edit && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>{edit.id ? 'Editar' : 'Nueva'} competencia</h4>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '2 1 220px' }}><label>Nombre</label><input className="input" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></div>
            <div className="field"><label>Categoría</label><input className="input" value={edit.categoria || ''} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })} placeholder="Liderazgo, Técnica…" /></div>
          </div>
          <div className="field" style={{ marginTop: 8 }}><label>Descripción</label><input className="input" value={edit.descripcion || ''} onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })} /></div>
          <div style={{ marginTop: 10 }}>
            <label className="muted" style={{ fontSize: 12 }}>Niveles (opcional)</label>
            {edit.niveles.map((n, i) => (
              <div key={i} className="row" style={{ gap: 6, marginTop: 6 }}>
                <input className="input" style={{ width: 120 }} placeholder="Nivel" value={n.nivel} onChange={(e) => setEdit({ ...edit, niveles: edit.niveles.map((x, j) => j === i ? { ...x, nivel: e.target.value } : x) })} />
                <input className="input" style={{ flex: 1 }} placeholder="Descripción del nivel" value={n.descripcion} onChange={(e) => setEdit({ ...edit, niveles: edit.niveles.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x) })} />
                <button className="btn ghost" style={{ padding: '4px 8px' }} onClick={() => setEdit({ ...edit, niveles: edit.niveles.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="btn ghost" style={{ marginTop: 8, fontSize: 12 }} onClick={() => setEdit({ ...edit, niveles: [...edit.niveles, { nivel: '', descripcion: '' }] })}>+ Nivel</button>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 12 }}><button className="btn" onClick={guardar} disabled={!edit.nombre.trim()}>Guardar</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Competencia</th><th>Categoría</th><th>Niveles</th><th></th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} style={{ opacity: c.activo ? 1 : 0.5 }}>
                <td>{c.nombre}</td><td>{c.categoria || '—'}</td><td className="muted">{(c.niveles || []).length || '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12, marginRight: 6 }} onClick={() => setEdit({ ...c, niveles: c.niveles || [] })}>Editar</button>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => borrar(c)}>Borrar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>No hay competencias.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
