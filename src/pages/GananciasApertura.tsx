import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import EmpleadoPicker from '../components/EmpleadoPicker';
import type { Empleado } from '../lib/types';

interface Apertura {
  id?: number; empleadoId: number; empleadoNom?: string; legNum?: string; anio: number; hastaMes: number;
  gravado: number; aportes: number; retenido: number; sacGravado: number; sacAportes: number; origen: string; obs?: string;
}
const MESES = ['—', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const $ = (n: number) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const vacio = (anio: number): Apertura => ({ empleadoId: 0, anio, hastaMes: 0, gravado: 0, aportes: 0, retenido: 0, sacGravado: 0, sacAportes: 0, origen: 'CARGA_INICIAL', obs: '' });

export default function GananciasApertura() {
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [items, setItems] = useState<Apertura[]>([]);
  const [emp, setEmp] = useState<Empleado | null>(null);
  const [form, setForm] = useState<Apertura>(vacio(ahora.getFullYear()));
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  async function load() {
    try { setItems(await api.get<Apertura[]>(`/ganancias/apertura?anio=${anio}`)); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  useEffect(() => { load(); setForm((f) => ({ ...f, anio })); /* eslint-disable-next-line */ }, [anio]);

  const set = (k: keyof Apertura) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: (k === 'origen' || k === 'obs') ? e.target.value : Number(e.target.value) }));

  async function guardar() {
    const empId = emp?.id || form.empleadoId;
    if (!empId) { setMsg({ t: 'Elegí un empleado.', ok: false }); return; }
    try {
      await api.put(`/ganancias/apertura/${empId}`, { ...form, anio });
      setMsg({ t: 'Carga inicial guardada.', ok: true });
      setForm(vacio(anio)); setEmp(null); load();
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  function editar(a: Apertura) {
    setForm({ ...a }); setEmp({ id: a.empleadoId, nom: a.empleadoNom || '', legNum: a.legNum || '' } as Empleado);
    setMsg(null); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function borrar(a: Apertura) {
    if (!confirm(`¿Eliminar la carga inicial de ${a.empleadoNom}?`)) return;
    try { await api.del(`/ganancias/apertura/${a.empleadoId}?anio=${anio}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          Si empezás a usar el sistema a mitad de año (o el empleado viene de otro empleador), cargá acá los <b>acumulados del período fiscal</b> previos.
          El cálculo de Ganancias (F.1357) los suma al acumulado del año. Cargá los importes <b>desde enero hasta el mes anterior</b> a la primera liquidación hecha en el sistema.
        </p>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 240 }}><label>Empleado</label><EmpleadoPicker onSelect={setEmp} value={form.empleadoId && emp ? `${emp.nom} (${emp.legNum})` : ''} /></div>
          <div className="field"><label>Año fiscal</label><input className="input" style={{ width: 100 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
          <div className="field"><label>Acumulado hasta mes</label>
            <select className="input" value={form.hastaMes} onChange={set('hastaMes')}>{MESES.map((m, i) => <option key={i} value={i}>{i === 0 ? '—' : m}</option>)}</select>
          </div>
          <div className="field"><label>Origen</label>
            <select className="input" value={form.origen} onChange={set('origen')}>
              <option value="CARGA_INICIAL">Carga inicial (sistema previo)</option>
              <option value="OTRO_EMPLEADOR">Otro empleador</option>
            </select>
          </div>
        </div>
        <div className="grid2" style={{ marginTop: 6 }}>
          <div className="field"><label>Remuneración gravada acumulada</label><input className="input" type="number" value={form.gravado} onChange={set('gravado')} /></div>
          <div className="field"><label>Aportes acumulados (jub. + OS + sindical)</label><input className="input" type="number" value={form.aportes} onChange={set('aportes')} /></div>
          <div className="field"><label>Retención de Ganancias acumulada</label><input className="input" type="number" value={form.retenido} onChange={set('retenido')} /></div>
          <div className="field"><label>SAC gravado percibido (opcional)</label><input className="input" type="number" value={form.sacGravado} onChange={set('sacGravado')} /></div>
          <div className="field"><label>Aportes sobre SAC (opcional)</label><input className="input" type="number" value={form.sacAportes} onChange={set('sacAportes')} /></div>
          <div className="field"><label>Observaciones</label><input className="input" value={form.obs || ''} onChange={set('obs')} /></div>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={guardar}>Guardar carga inicial</button>
          {(emp || form.empleadoId) && <button className="btn ghost" onClick={() => { setForm(vacio(anio)); setEmp(null); }}>Cancelar</button>}
        </div>
        {msg && <p className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 0 }}>{msg.t}</p>}
      </div>

      <h3 style={{ margin: '0 0 8px' }}>Cargas iniciales {anio} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({items.length})</span></h3>
      {!items.length && <p className="muted">No hay cargas iniciales para {anio}.</p>}
      {items.length > 0 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
            <thead><tr style={{ background: 'var(--bg2)' }}>
              {['Empleado', 'Hasta', 'Gravado', 'Aportes', 'Retenido', 'SAC grav.', 'Origen', ''].map((h, i) => (
                <th key={i} style={{ padding: '6px 8px', textAlign: i === 0 ? 'left' : (i > 1 && i < 6 ? 'right' : 'left'), borderBottom: '2px solid var(--border)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.empleadoId}>
                  <td style={{ padding: '4px 8px' }}>{a.empleadoNom} <span className="muted">· {a.legNum}</span></td>
                  <td style={{ padding: '4px 8px' }}>{MESES[a.hastaMes] || '—'}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(a.gravado)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(a.aportes)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(a.retenido)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(a.sacGravado)}</td>
                  <td style={{ padding: '4px 8px' }}>{a.origen === 'OTRO_EMPLEADOR' ? 'Otro empleador' : 'Carga inicial'}</td>
                  <td style={{ padding: '4px 8px' }}>
                    <button className="btn ghost" onClick={() => editar(a)}>Editar</button>{' '}
                    <button className="btn danger" onClick={() => borrar(a)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
