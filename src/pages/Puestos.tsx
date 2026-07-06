import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

interface Puesto {
  id: number; codigo: string; nombre: string; area?: string;
  reporta_a?: number | null; reporta_nombre?: string; go_to_hr: boolean; ocupantes: number;
}
type Form = { codigo: string; nombre: string; area: string; reportaA: string; goToHr: boolean };
const vacio: Form = { codigo: '', nombre: '', area: '', reportaA: '', goToHr: false };

export default function Puestos() {
  const [items, setItems] = useState<Puesto[]>([]);
  const [q, setQ] = useState('');
  const [f, setF] = useState<Form>(vacio);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  async function load() {
    try { setItems(await api.get<Puesto[]>('/puestos')); } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  useEffect(() => { load(); }, []);

  const set = (k: keyof Form) => (e: any) => setF({ ...f, [k]: k === 'goToHr' ? e.target.checked : e.target.value });
  function cancelar() { setEditId(null); setF(vacio); }
  function editar(p: Puesto) {
    setEditId(p.id);
    setF({ codigo: p.codigo || '', nombre: p.nombre, area: p.area || '', reportaA: p.reporta_a ? String(p.reporta_a) : '', goToHr: !!p.go_to_hr });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre.trim()) { setMsg({ t: 'El nombre del puesto es obligatorio', ok: false }); return; }
    const body = { codigo: f.codigo.trim() || undefined, nombre: f.nombre.trim(), area: f.area.trim() || null, reportaA: f.reportaA ? Number(f.reportaA) : null, goToHr: f.goToHr };
    try {
      if (editId) { await api.put(`/puestos/${editId}`, body); setMsg({ t: 'Puesto actualizado', ok: true }); }
      else { await api.post('/puestos', body); setMsg({ t: 'Puesto creado', ok: true }); }
      cancelar(); load();
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(p: Puesto) {
    if (!confirm(`¿Eliminar el puesto "${p.nombre}"?\n\nLos puestos que le reportan y los empleados asignados quedarán sin dependencia hasta que los reasignes.`)) return;
    try { await api.del(`/puestos/${p.id}`); setMsg({ t: 'Puesto eliminado', ok: true }); if (editId === p.id) cancelar(); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  const opcionesReporta = useMemo(() => items.filter((p) => p.id !== editId), [items, editId]);
  const nombrePorId = useMemo(() => Object.fromEntries(items.map((p) => [p.id, p.nombre])), [items]);
  const visibles = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return !ql ? items : items.filter((p) => [p.nombre, p.area, p.codigo, p.reporta_nombre].some((x) => String(x || '').toLowerCase().includes(ql)));
  }, [items, q]);

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 14 }}>
        La estructura del organigrama se define por <b>puesto</b>: cada puesto reporta a otro puesto, y los empleados se asignan a un puesto desde su legajo (ABM Empleados). Un mismo puesto puede tener varios ocupantes. Cuando cambia la persona a cargo, solo reasignás el puesto y toda la cadena de dependencia se mantiene. Para crear un mando medio, agregá el puesto intermedio y hacé que los subordinados reporten a él.
      </p>

      <form className="card" style={{ marginBottom: 18 }} onSubmit={guardar}>
        <h3 style={{ marginTop: 0 }}>{editId ? 'Editar puesto' : 'Nuevo puesto'}</h3>
        <div className="grid2" style={{ marginBottom: 10 }}>
          <div className="field"><label>Nombre del puesto *</label><input className="input" value={f.nombre} onChange={set('nombre')} placeholder="Ej: Jefe Comercial LEITEN" /></div>
          <div className="field"><label>Área / Gerencia</label><input className="input" value={f.area} onChange={set('area')} placeholder="Ej: Comercial LEITEN" /></div>
          <div className="field"><label>Reporta a (puesto superior)</label>
            <select className="input" value={f.reportaA} onChange={set('reportaA')}>
              <option value="">— Sin superior (raíz del organigrama) —</option>
              {opcionesReporta.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.area ? ` · ${p.area}` : ''}</option>)}
            </select>
          </div>
          <div className="field"><label>Código</label><input className="input" value={f.codigo} onChange={set('codigo')} placeholder="Automático si se deja vacío" /></div>
        </div>
        <label className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.goToHr} onChange={set('goToHr')} />
          <span>Las aprobaciones de este puesto pasan también por RR.HH.</span>
        </label>
        {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 8 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn">{editId ? 'Guardar cambios' : 'Crear puesto'}</button>
          {editId && <button type="button" className="btn ghost" onClick={cancelar}>Cancelar</button>}
        </div>
      </form>

      <div className="row" style={{ marginBottom: 14 }}>
        <input className="input" style={{ maxWidth: 300 }} placeholder="Buscar puesto, área o código…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>{items.length} puestos</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Código</th><th>Puesto</th><th>Área</th><th>Reporta a</th><th style={{ textAlign: 'center' }}>Ocupantes</th><th style={{ textAlign: 'center' }}>RR.HH.</th><th></th></tr></thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.id}>
                <td style={{ fontFamily: 'monospace' }}>{p.codigo}</td>
                <td><b>{p.nombre}</b></td>
                <td className="muted">{p.area || '—'}</td>
                <td className="muted">{p.reporta_a ? (p.reporta_nombre || nombrePorId[p.reporta_a] || '—') : <span style={{ color: 'var(--accent2)' }}>Raíz</span>}</td>
                <td style={{ textAlign: 'center' }}><span className="badge">{p.ocupantes}</span></td>
                <td style={{ textAlign: 'center' }}>{p.go_to_hr ? '✓' : '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => editar(p)}>Editar</button>
                  <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => borrar(p)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {!visibles.length && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin puestos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
