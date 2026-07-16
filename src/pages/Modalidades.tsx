import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Mod { id?: number; nombre: string; cod_afip?: string; periodo_prueba: boolean; indemnizacion: boolean; sac: boolean; nota?: string; activo: boolean; }
const vacia: Mod = { nombre: '', cod_afip: '', periodo_prueba: true, indemnizacion: true, sac: true, activo: true };

export default function Modalidades() {
  const [items, setItems] = useState<Mod[]>([]);
  const [edit, setEdit] = useState<Mod | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() { api.get<Mod[]>('/modalidades').then(setItems).catch(() => {}); }
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    if (!edit || !edit.nombre.trim()) return;
    const body = { ...edit, codAfip: edit.cod_afip };
    try { if (edit.id) await api.put(`/modalidades/${edit.id}`, body); else await api.post('/modalidades', body); setEdit(null); setMsg({ t: 'Modalidad guardada', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(m: Mod) { if (!confirm(`¿Borrar "${m.nombre}"?`)) return; try { await api.del(`/modalidades/${m.id}`); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  const chk = (v: boolean) => v ? <span style={{ color: 'var(--green)' }}>Sí</span> : <span className="muted">No</span>;
  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>
        Modalidades de contratación (indeterminado, plazo fijo, eventual, pasantía, práctica profesionalizante…). Definen si aplican período de prueba, indemnización por antigüedad y SAC, y el código de modalidad para AFIP. Se asignan al legajo en el ABM de Empleados.
      </p>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {!edit && <button className="btn" style={{ marginBottom: 12 }} onClick={() => setEdit({ ...vacia })}>+ Nueva modalidad</button>}

      {edit && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>{edit.id ? 'Editar' : 'Nueva'} modalidad</h4>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '2 1 240px' }}><label>Nombre</label><input className="input" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></div>
            <div className="field"><label>Cód. AFIP (modalidad)</label><input className="input" style={{ width: 120 }} value={edit.cod_afip || ''} onChange={(e) => setEdit({ ...edit, cod_afip: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={edit.periodo_prueba} onChange={(e) => setEdit({ ...edit, periodo_prueba: e.target.checked })} /> Período de prueba</label>
            <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={edit.indemnizacion} onChange={(e) => setEdit({ ...edit, indemnizacion: e.target.checked })} /> Indemnización por antigüedad</label>
            <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={edit.sac} onChange={(e) => setEdit({ ...edit, sac: e.target.checked })} /> Genera SAC</label>
          </div>
          <div className="field" style={{ marginTop: 10 }}><label>Nota</label><input className="input" value={edit.nota || ''} onChange={(e) => setEdit({ ...edit, nota: e.target.value })} /></div>
          <div className="row" style={{ gap: 6, marginTop: 12 }}><button className="btn" onClick={guardar} disabled={!edit.nombre.trim()}>Guardar</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Modalidad</th><th>Cód. AFIP</th><th>Prueba</th><th>Indemniza</th><th>SAC</th><th></th></tr></thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <td>{m.nombre}</td><td>{m.cod_afip || '—'}</td>
                <td>{chk(m.periodo_prueba)}</td><td>{chk(m.indemnizacion)}</td><td>{chk(m.sac)}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12, marginRight: 6 }} onClick={() => setEdit({ ...m })}>Editar</button>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => borrar(m)}>Borrar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>No hay modalidades.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
