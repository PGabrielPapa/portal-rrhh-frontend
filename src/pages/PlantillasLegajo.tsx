import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Plantillas de legajo (Tango: valores por defecto para dar de alta empleados).
interface Plantilla { id: number; nombre: string; data: any; activo: boolean; }
const CAMPOS: [string, string][] = [
  ['cat', 'Categoría escala'], ['tramo', 'Tramo escala'],
  ['cod_convenio', 'CCT / Convenio'], ['categoria_convenio', 'Categoría de convenio'], ['cod_sindicato', 'Afiliación sindical'],
  ['condicion', 'Condición'], ['nivelTitulo', 'Nivel de título'], ['lugar', 'Lugar de trabajo'], ['tarea', 'Función / tarea'],
];

export default function PlantillasLegajo() {
  const [items, setItems] = useState<Plantilla[]>([]);
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState<any>(null); // { id?, nombre, data:{}, parcial?:'si'|'' }

  async function load() { try { setItems(await api.get<Plantilla[]>('/plantillas-legajo')); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { load(); }, []);

  function nuevo() { setErr(''); setMsg(''); setEdit({ nombre: '', data: {}, parcial: '' }); }
  function editar(p: Plantilla) { setErr(''); setMsg(''); setEdit({ id: p.id, nombre: p.nombre, data: { ...p.data }, parcial: p.data?.jornadaParcial === 'si' ? 'si' : '' }); }
  const setD = (k: string, v: string) => setEdit((e: any) => ({ ...e, data: { ...e.data, [k]: v } }));

  async function guardar() {
    setErr('');
    if (!edit.nombre.trim()) { setErr('El nombre es obligatorio'); return; }
    const data = { ...edit.data }; if (edit.parcial === 'si') data.jornadaParcial = 'si'; else delete data.jornadaParcial;
    try {
      if (edit.id) await api.put(`/plantillas-legajo/${edit.id}`, { nombre: edit.nombre, data, activo: true });
      else await api.post('/plantillas-legajo', { nombre: edit.nombre, data, activo: true });
      setEdit(null); setMsg('Plantilla guardada.'); load();
    } catch (e: any) { setErr(e.message); }
  }
  async function borrar(p: Plantilla) { if (!window.confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) return; try { await api.del(`/plantillas-legajo/${p.id}`); load(); } catch (e: any) { setErr(e.message); } }

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}
      <p className="muted" style={{ marginTop: 0 }}>Definí moldes (ej. "Administrativo mensualizado") con los datos comunes. Al dar de alta un empleado, elegís la plantilla y esos campos vienen precargados.</p>
      <div style={{ marginBottom: 12 }}><button className="btn primary" onClick={nuevo}>+ Nueva plantilla</button></div>

      {edit && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>{edit.id ? 'Editar' : 'Nueva'} plantilla</h3>
          <div className="field" style={{ marginBottom: 10 }}><label>Nombre *</label><input className="input" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} placeholder="Ej: Administrativo mensualizado" /></div>
          <div className="grid2">
            {CAMPOS.map(([k, l]) => <div className="field" key={k}><label>{l}</label><input className="input" value={edit.data[k] || ''} onChange={(e) => setD(k, e.target.value)} /></div>)}
            <div className="field"><label>Jornada</label><select className="input" value={edit.parcial} onChange={(e) => setEdit({ ...edit, parcial: e.target.value })}><option value="">Completa</option><option value="si">Tiempo parcial</option></select></div>
          </div>
          <div style={{ marginTop: 12 }}><button className="btn primary" onClick={guardar}>Guardar</button> <button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Nombre</th><th>Campos precargados</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => {
              const keys = Object.keys(p.data || {}).filter((k) => p.data[k] !== '' && p.data[k] != null);
              return (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{keys.map((k) => (CAMPOS.find(([c]) => c === k)?.[1] || k)).join(', ') || '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => editar(p)}>Editar</button>
                    <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => borrar(p)}>Eliminar</button>
                  </td>
                </tr>
              );
            })}
            {!items.length && <tr><td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 20 }}>Todavía no definiste plantillas.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
