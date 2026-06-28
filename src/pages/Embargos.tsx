import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import EmpleadoPicker from '../components/EmpleadoPicker';
import type { Empleado } from '../lib/types';

interface Embargo {
  id: number; empleadoId: number; empleadoNom?: string; legNum?: string; tipo: string; modo: string;
  monto: number; porcentaje: number; caratula?: string; juzgado?: string; expediente?: string; oficio?: string;
  total: number; retenido: number; desde?: string; hasta?: string; activo: boolean; obs?: string;
}
const $ = (n: number) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const vacio = (): Embargo => ({ id: 0, empleadoId: 0, tipo: 'judicial', modo: 'monto', monto: 0, porcentaje: 0, total: 0, retenido: 0, activo: true });

export default function Embargos() {
  const [items, setItems] = useState<Embargo[]>([]);
  const [edit, setEdit] = useState<Embargo | null>(null);
  const [emp, setEmp] = useState<Empleado | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  async function load() { try { setItems(await api.get<Embargo[]>('/embargos')); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); }, []);

  async function guardar() {
    if (!edit) return;
    const empleadoId = emp?.id || edit.empleadoId;
    if (!empleadoId) { setMsg({ t: 'Elegí un empleado', ok: false }); return; }
    try {
      const body = { ...edit, empleadoId };
      if (edit.id) await api.put(`/embargos/${edit.id}`, body); else await api.post('/embargos', body);
      setEdit(null); setEmp(null); setMsg({ t: 'Embargo guardado', ok: true }); load();
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(e: Embargo) { if (!confirm(`¿Eliminar el embargo de ${e.empleadoNom}?`)) return; try { await api.del(`/embargos/${e.id}`); load(); } catch (er: any) { setMsg({ t: er.message, ok: false }); } }
  const set = (k: keyof Embargo, v: any) => setEdit((e) => e ? { ...e, [k]: v } : e);

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}><button className="btn" onClick={() => { setEdit(vacio()); setEmp(null); }}>+ Nuevo embargo</button></div>
      {msg && <p className={msg.ok ? 'ok' : 'err'}>{msg.t}</p>}
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Los embargos activos se aplican automáticamente en la liquidación, respetando el tope legal de embargabilidad (20% sobre el excedente del SMVM) y, en cuota alimentaria, el % del neto fijado.</p>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--bg2)' }}>
            {['Empleado', 'Tipo', 'Monto / %', 'Carátula', 'Total', 'Retenido', 'Activo', ''].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <td style={{ padding: '4px 8px' }}>{e.empleadoNom} <span className="muted">· {e.legNum}</span></td>
                <td style={{ padding: '4px 8px' }}>{e.tipo === 'alimentos' ? 'Cuota alimentaria' : 'Judicial'}</td>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{e.modo === 'porcentaje' ? `${e.porcentaje}%` : `$ ${$(e.monto)}`}</td>
                <td style={{ padding: '4px 8px' }} className="muted">{e.caratula || '—'}</td>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{e.total ? `$ ${$(e.total)}` : '—'}</td>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>$ {$(e.retenido)}</td>
                <td style={{ padding: '4px 8px' }}>{e.activo ? 'Sí' : 'No'}</td>
                <td style={{ padding: '4px 8px' }}><button className="btn ghost" onClick={() => { setEdit(e); setEmp({ id: e.empleadoId, nom: e.empleadoNom || '', legNum: e.legNum || '' } as Empleado); }}>Editar</button> <button className="btn danger" onClick={() => borrar(e)}>Eliminar</button></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={8} className="muted" style={{ padding: 10 }}>No hay embargos cargados.</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="modal-bg" onClick={() => setEdit(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={(ev) => ev.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{edit.id ? 'Editar' : 'Nuevo'} embargo</h3>
            <div className="grid2">
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Empleado</label><EmpleadoPicker onSelect={setEmp} value={edit.empleadoId && emp ? `${emp.nom} (${emp.legNum})` : ''} /></div>
              <div className="field"><label>Tipo</label><select className="input" value={edit.tipo} onChange={(e) => set('tipo', e.target.value)}><option value="judicial">Embargo judicial</option><option value="alimentos">Cuota alimentaria</option></select></div>
              {edit.tipo === 'alimentos' && <div className="field"><label>Modo</label><select className="input" value={edit.modo} onChange={(e) => set('modo', e.target.value)}><option value="monto">Monto fijo</option><option value="porcentaje">% del neto</option></select></div>}
              {edit.modo === 'porcentaje' && edit.tipo === 'alimentos'
                ? <div className="field"><label>Porcentaje del neto</label><input className="input" type="number" value={edit.porcentaje} onChange={(e) => set('porcentaje', Number(e.target.value))} /></div>
                : <div className="field"><label>Monto mensual</label><input className="input" type="number" value={edit.monto} onChange={(e) => set('monto', Number(e.target.value))} /></div>}
              <div className="field"><label>Total a embargar (0 = sin límite)</label><input className="input" type="number" value={edit.total} onChange={(e) => set('total', Number(e.target.value))} /></div>
              <div className="field"><label>Retenido acumulado</label><input className="input" type="number" value={edit.retenido} onChange={(e) => set('retenido', Number(e.target.value))} /></div>
              <div className="field"><label>Carátula</label><input className="input" value={edit.caratula || ''} onChange={(e) => set('caratula', e.target.value)} /></div>
              <div className="field"><label>Juzgado</label><input className="input" value={edit.juzgado || ''} onChange={(e) => set('juzgado', e.target.value)} /></div>
              <div className="field"><label>Expediente</label><input className="input" value={edit.expediente || ''} onChange={(e) => set('expediente', e.target.value)} /></div>
              <div className="field"><label>Oficio</label><input className="input" value={edit.oficio || ''} onChange={(e) => set('oficio', e.target.value)} /></div>
              <div className="field"><label>Desde</label><input className="input" type="date" value={edit.desde || ''} onChange={(e) => set('desde', e.target.value)} /></div>
              <div className="field"><label>Hasta</label><input className="input" type="date" value={edit.hasta || ''} onChange={(e) => set('hasta', e.target.value)} /></div>
              <label className="row muted" style={{ gap: 6 }}><input type="checkbox" checked={edit.activo} onChange={(e) => set('activo', e.target.checked)} /> Activo</label>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Observaciones</label><input className="input" value={edit.obs || ''} onChange={(e) => set('obs', e.target.value)} /></div>
            </div>
            <div className="row" style={{ marginTop: 12 }}><button className="btn" onClick={guardar}>Guardar</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
          </div>
        </div>
      )}
    </>
  );
}
