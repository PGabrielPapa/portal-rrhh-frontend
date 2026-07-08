import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// ABM de campos adicionales del legajo (Tango: "campos adicionales").
interface Campo { id: number; entidad: string; clave: string; etiqueta: string; tipo: string; opciones: string[]; orden: number; activo: boolean; }
const TIPOS: [string, string][] = [['texto', 'Texto'], ['numero', 'Número'], ['fecha', 'Fecha'], ['lista', 'Lista de opciones']];
const vacio = { etiqueta: '', tipo: 'texto', opciones: '', orden: 0, activo: true };

export default function CamposAdicionales() {
  const [items, setItems] = useState<Campo[]>([]);
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState<any>(null); // {id?, etiqueta, tipo, opciones(str), orden, activo}

  async function load() { try { setItems(await api.get<Campo[]>('/campos?entidad=empleado')); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { load(); }, []);

  function nuevo() { setEdit({ ...vacio }); setMsg(''); setErr(''); }
  function editar(c: Campo) { setEdit({ id: c.id, etiqueta: c.etiqueta, tipo: c.tipo, opciones: (c.opciones || []).join(', '), orden: c.orden, activo: c.activo }); setMsg(''); setErr(''); }
  async function guardar() {
    setErr('');
    const body = { etiqueta: edit.etiqueta, tipo: edit.tipo, orden: Number(edit.orden) || 0, activo: edit.activo,
      opciones: edit.tipo === 'lista' ? String(edit.opciones || '').split(',').map((x: string) => x.trim()).filter(Boolean) : [] };
    if (!body.etiqueta.trim()) { setErr('La etiqueta es obligatoria'); return; }
    try {
      if (edit.id) await api.put(`/campos/${edit.id}`, body); else await api.post('/campos', body);
      setEdit(null); setMsg('Campo guardado.'); load();
    } catch (e: any) { setErr(e.message); }
  }
  async function borrar(c: Campo) { if (!window.confirm(`¿Eliminar el campo "${c.etiqueta}"? Los valores ya cargados quedan guardados pero dejan de mostrarse.`)) return; try { await api.del(`/campos/${c.id}`); load(); } catch (e: any) { setErr(e.message); } }

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}
      <p className="muted" style={{ marginTop: 0 }}>Definí campos propios para el legajo (talles, número de matrícula, etc.). Aparecen en el ABM de Empleados y se guardan en cada legajo.</p>

      <div style={{ marginBottom: 12 }}><button className="btn primary" onClick={nuevo}>+ Nuevo campo</button></div>

      {edit && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>{edit.id ? 'Editar campo' : 'Nuevo campo'}</h3>
          <div className="row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <div className="field"><label>Etiqueta *</label><input className="input" value={edit.etiqueta} onChange={(e) => setEdit({ ...edit, etiqueta: e.target.value })} placeholder="Ej: Talle de calzado" /></div>
            <div className="field"><label>Tipo</label><select className="input" value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}>{TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="field" style={{ width: 90 }}><label>Orden</label><input className="input" type="number" value={edit.orden} onChange={(e) => setEdit({ ...edit, orden: e.target.value })} /></div>
            <div className="field"><label className="row" style={{ gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={edit.activo} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} /> Activo</label></div>
          </div>
          {edit.tipo === 'lista' && <div className="field" style={{ marginTop: 10 }}><label>Opciones (separadas por coma)</label><input className="input" value={edit.opciones} onChange={(e) => setEdit({ ...edit, opciones: e.target.value })} placeholder="Ej: S, M, L, XL" /></div>}
          <div style={{ marginTop: 12 }}><button className="btn primary" onClick={guardar}>Guardar</button> <button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Etiqueta</th><th>Tipo</th><th>Opciones</th><th>Orden</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.etiqueta} <span className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{c.clave}</span></td>
                <td>{TIPOS.find(([v]) => v === c.tipo)?.[1] || c.tipo}</td>
                <td className="muted">{(c.opciones || []).join(', ') || '—'}</td>
                <td>{c.orden}</td>
                <td><span className="badge" style={{ color: c.activo ? 'var(--green)' : 'var(--muted)' }}>{c.activo ? 'activo' : 'inactivo'}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => editar(c)}>Editar</button>
                  <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => borrar(c)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>Todavía no definiste campos adicionales.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
