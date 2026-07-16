import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Tramo { hastaAnios: number; basico: number; }
interface Matriz { id?: number; nombre: string; convenio?: string; categoria?: string; tramos: Tramo[]; activo: boolean; }
const vacia: Matriz = { nombre: '', convenio: '', categoria: '', tramos: [{ hastaAnios: 5, basico: 0 }], activo: true };
const $ = (n: number) => (n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

export default function MatrizAntiguedad() {
  const [items, setItems] = useState<Matriz[]>([]);
  const [edit, setEdit] = useState<Matriz | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() { api.get<Matriz[]>('/matriz-antiguedad').then(setItems).catch(() => {}); }
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    if (!edit || !edit.nombre.trim()) return;
    try {
      const body = { ...edit, tramos: edit.tramos.filter((t) => t.basico > 0) };
      if (edit.id) await api.put(`/matriz-antiguedad/${edit.id}`, body); else await api.post('/matriz-antiguedad', body);
      setEdit(null); setMsg({ t: 'Matriz guardada', ok: true }); cargar();
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(m: Matriz) { if (!confirm(`¿Borrar "${m.nombre}"?`)) return; try { await api.del(`/matriz-antiguedad/${m.id}`); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>
        Fija el sueldo básico según la antigüedad, por tramos de años. Si aplica a un empleado (por convenio/categoría), tiene prioridad sobre el básico del convenio y del legajo.
      </p>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {!edit && <button className="btn" style={{ marginBottom: 12 }} onClick={() => setEdit({ ...vacia, tramos: [{ hastaAnios: 5, basico: 0 }] })}>+ Nueva matriz</button>}

      {edit && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>{edit.id ? 'Editar' : 'Nueva'} matriz</h4>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '2 1 220px' }}><label>Nombre</label><input className="input" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></div>
            <div className="field"><label>Convenio (código, vacío = todos)</label><input className="input" value={edit.convenio || ''} onChange={(e) => setEdit({ ...edit, convenio: e.target.value })} /></div>
            <div className="field"><label>Categoría (vacío = todas)</label><input className="input" value={edit.categoria || ''} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="muted" style={{ fontSize: 12 }}>Tramos (hasta N años → básico). El último tramo es el tope.</label>
            {edit.tramos.map((t, i) => (
              <div key={i} className="row" style={{ gap: 8, marginTop: 6, alignItems: 'flex-end' }}>
                <div className="field"><label style={{ fontSize: 10 }}>Hasta (años)</label><input className="input" style={{ width: 100 }} type="number" value={t.hastaAnios} onChange={(e) => setEdit({ ...edit, tramos: edit.tramos.map((x, j) => j === i ? { ...x, hastaAnios: Number(e.target.value) } : x) })} /></div>
                <div className="field"><label style={{ fontSize: 10 }}>Básico $</label><input className="input" style={{ width: 140 }} type="number" value={t.basico} onChange={(e) => setEdit({ ...edit, tramos: edit.tramos.map((x, j) => j === i ? { ...x, basico: Number(e.target.value) } : x) })} /></div>
                {edit.tramos.length > 1 && <button className="btn ghost" style={{ padding: '4px 8px' }} onClick={() => setEdit({ ...edit, tramos: edit.tramos.filter((_, j) => j !== i) })}>✕</button>}
              </div>
            ))}
            <button className="btn ghost" style={{ marginTop: 8, fontSize: 12 }} onClick={() => setEdit({ ...edit, tramos: [...edit.tramos, { hastaAnios: 99, basico: 0 }] })}>+ Tramo</button>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 12 }}><button className="btn" onClick={guardar} disabled={!edit.nombre.trim()}>Guardar</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Nombre</th><th>Convenio</th><th>Categoría</th><th>Tramos</th><th></th></tr></thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <td>{m.nombre}</td><td>{m.convenio || '—'}</td><td>{m.categoria || '—'}</td>
                <td className="muted" style={{ fontSize: 12 }}>{(m.tramos || []).map((t) => `≤${t.hastaAnios}a: $${$(t.basico)}`).join(' · ')}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12, marginRight: 6 }} onClick={() => setEdit({ ...m, tramos: m.tramos || [] })}>Editar</button>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => borrar(m)}>Borrar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>No hay matrices de antigüedad.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
