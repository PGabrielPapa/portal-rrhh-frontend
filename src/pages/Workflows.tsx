import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Paso { orden: number; rol: string; puesto?: number | null; etiqueta: string; obligatorio: boolean; }
interface Wf { id?: number; proceso: string; nombre: string; pasos: Paso[]; activo: boolean; }
const PROCESOS = ['licencias', 'adelantos', 'vacaciones', 'sanciones', 'gastos', 'altas', 'bajas', 'otro'];
const ROLES = ['manager', 'rrhh', 'admin'];
const vacio: Wf = { proceso: 'licencias', nombre: '', pasos: [{ orden: 1, rol: 'manager', etiqueta: 'Aprobación del responsable', obligatorio: true }], activo: true };

export default function Workflows() {
  const [items, setItems] = useState<Wf[]>([]);
  const [puestos, setPuestos] = useState<{ id: number; nombre: string }[]>([]);
  const [edit, setEdit] = useState<Wf | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() { api.get<Wf[]>('/workflows').then(setItems).catch(() => {}); }
  useEffect(() => { cargar(); api.get<{ id: number; nombre: string }[]>('/puestos').then(setPuestos).catch(() => {}); }, []);

  async function guardar() {
    if (!edit || !edit.nombre.trim()) return;
    try { if (edit.id) await api.put(`/workflows/${edit.id}`, edit); else await api.post('/workflows', edit); setEdit(null); setMsg({ t: 'Flujo guardado', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(w: Wf) { if (!confirm(`¿Borrar "${w.nombre}"?`)) return; try { await api.del(`/workflows/${w.id}`); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>Definí flujos de aprobación por proceso (niveles y roles). La definición queda documentada y disponible para aplicar en cada circuito.</p>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {!edit && <button className="btn" style={{ marginBottom: 12 }} onClick={() => setEdit(JSON.parse(JSON.stringify(vacio)))}>+ Nuevo flujo</button>}

      {edit && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>{edit.id ? 'Editar' : 'Nuevo'} flujo</h4>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field"><label>Proceso</label><select className="input" value={edit.proceso} onChange={(e) => setEdit({ ...edit, proceso: e.target.value })}>{PROCESOS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="field" style={{ flex: '2 1 220px' }}><label>Nombre</label><input className="input" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="muted" style={{ fontSize: 12 }}>Pasos de aprobación (en orden)</label>
            {edit.pasos.map((p, i) => (
              <div key={i} className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}>
                <span className="muted" style={{ width: 20 }}>{i + 1}.</span>
                <select className="input" style={{ width: 110 }} value={p.rol} disabled={!!p.puesto} title={p.puesto ? 'Definido por puesto' : 'Rol que aprueba'} onChange={(e) => setEdit({ ...edit, pasos: edit.pasos.map((x, j) => j === i ? { ...x, rol: e.target.value } : x) })}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                <select className="input" style={{ width: 150 }} value={p.puesto || ''} title="Opcional: un puesto específico resuelve este paso (tiene prioridad sobre el rol)" onChange={(e) => setEdit({ ...edit, pasos: edit.pasos.map((x, j) => j === i ? { ...x, puesto: e.target.value ? Number(e.target.value) : null } : x) })}><option value="">— por rol —</option>{puestos.map((pu) => <option key={pu.id} value={pu.id}>{pu.nombre}</option>)}</select>
                <input className="input" style={{ flex: 1 }} placeholder="Etiqueta" value={p.etiqueta} onChange={(e) => setEdit({ ...edit, pasos: edit.pasos.map((x, j) => j === i ? { ...x, etiqueta: e.target.value } : x) })} />
                <label className="row" style={{ gap: 4, fontSize: 12 }}><input type="checkbox" checked={p.obligatorio} onChange={(e) => setEdit({ ...edit, pasos: edit.pasos.map((x, j) => j === i ? { ...x, obligatorio: e.target.checked } : x) })} /> obligatorio</label>
                <button className="btn ghost" style={{ padding: '4px 8px' }} onClick={() => setEdit({ ...edit, pasos: edit.pasos.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="btn ghost" style={{ marginTop: 8, fontSize: 12 }} onClick={() => setEdit({ ...edit, pasos: [...edit.pasos, { orden: edit.pasos.length + 1, rol: 'rrhh', etiqueta: '', obligatorio: true }] })}>+ Paso</button>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 12 }}><button className="btn" onClick={guardar} disabled={!edit.nombre.trim()}>Guardar</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Proceso</th><th>Nombre</th><th>Pasos</th><th></th></tr></thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id}>
                <td><span className="badge">{w.proceso}</span></td><td>{w.nombre}</td>
                <td className="muted" style={{ fontSize: 12 }}>{(w.pasos || []).map((p, i) => `${i + 1}. ${p.puesto ? ('puesto:' + (puestos.find((x) => x.id === p.puesto)?.nombre || p.puesto)) : p.rol}${p.obligatorio ? '' : ' (opc.)'}`).join(' → ')}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12, marginRight: 6 }} onClick={() => setEdit({ ...w, pasos: w.pasos || [] })}>Editar</button>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => borrar(w)}>Borrar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>No hay flujos definidos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
