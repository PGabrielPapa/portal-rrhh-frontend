import { useEffect, useState } from 'react';
import HistorialConfig from '../components/HistorialConfig';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Sind { id?: number; codigo: string; nombre: string; pctEmpleado: number; pctSolidario: number; pctPatronal: number; pctAntigPorAnio: number; montoAntigPorAnio: number; complementoSinNoRem: boolean; pctArt37_1: number; pctArt37_2: number; pctPremio: number; nota?: string; tituloSecundario: number; tituloUniversitario: number; presBase: string; pctPresentismo: number; }
const PRES = [['basico', 'Solo básico'], ['basico+antig', 'Básico + antigüedad'], ['basico+antig+titulo', 'Básico + antig. + título'], ['basico+antig+titulo+acuenta', 'Básico + antig. + título + a cuenta fut. aumentos']];
const vacio = (): Sind => ({ codigo: '', nombre: '', pctEmpleado: 0, pctSolidario: 0, pctPatronal: 0, pctAntigPorAnio: 1, montoAntigPorAnio: 0, complementoSinNoRem: false, pctArt37_1: 0, pctArt37_2: 0, pctPremio: 0, nota: '', tituloSecundario: 0, tituloUniversitario: 0, presBase: 'basico', pctPresentismo: 0 });

export default function Sindicatos() {
  const { user } = useAuth();
  const puede = user?.role === 'rrhh' || user?.role === 'admin';
  const [items, setItems] = useState<Sind[]>([]);
  const [edit, setEdit] = useState<Sind | null>(null);
  const [err, setErr] = useState('');
  const [porEmp, setPorEmp] = useState<any[]>([]);
  const [verEmp, setVerEmp] = useState(false);

  async function load() { try { setItems(await api.get<Sind[]>('/sindicatos')); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (puede) api.get<any[]>('/sindicatos/por-empresa').then(setPorEmp).catch(() => {}); }, [puede]);

  async function guardar() {
    if (!edit) return; setErr('');
    if (!edit.codigo || !edit.nombre) { setErr('Código y nombre son obligatorios.'); return; }
    try { if (edit.id) await api.put(`/sindicatos/${edit.id}`, edit); else await api.post('/sindicatos', edit); setEdit(null); load(); }
    catch (e: any) { setErr(e.message); }
  }
  async function borrar(s: Sind) { if (!window.confirm('¿Eliminar este sindicato?')) return; try { await api.del(`/sindicatos/${s.id}`); load(); } catch (e: any) { setErr(e.message); } }
  const setF = (k: keyof Sind, v: any) => setEdit({ ...(edit as Sind), [k]: v });
  const presLbl = (p: string) => PRES.find((x) => x[0] === p)?.[1] || p;

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 14 }}>Catálogo de sindicatos y sus parámetros de aportes (cuota del empleado, contribución patronal, antigüedad, base de presentismo y adicional por título). Cada empleado usa el sindicato de su convenio; una empresa puede tener varios.</p>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}

      {porEmp.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Sindicatos por empresa <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>(según los empleados activos)</span></h3>
            <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setVerEmp((v) => !v)}>{verEmp ? 'Ocultar' : 'Ver'}</button>
          </div>
          {verEmp && porEmp.map((em) => (
            <div key={em.empresa} style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{em.empresa} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {em.total} empleado(s)</span></div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: 'var(--bg2)' }}>{['Código', 'Sindicato', 'Empleados', '% aporte', '% patronal'].map((h, i) => <th key={i} style={{ textAlign: i >= 2 ? 'right' : 'left', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {em.sindicatos.map((x: any) => (
                      <tr key={x.codigo}>
                        <td style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{x.codigo}</td>
                        <td style={{ padding: '3px 8px' }}>{x.nombre} {!x.definido && <span className="badge" style={{ color: 'var(--yellow)' }}>⚠ definir en el catálogo</span>}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right' }}>{x.empleados}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{x.pctEmpleado != null ? x.pctEmpleado + '%' : '—'}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{x.pctPatronal != null ? x.pctPatronal + '%' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{edit.id ? `Editar ${edit.codigo}` : 'Nuevo sindicato'}</h3>
          <div className="grid2" style={{ marginBottom: 10 }}>
            <div className="field"><label>Código *</label><input className="input" value={edit.codigo} disabled={!!edit.id} onChange={(e) => setF('codigo', e.target.value.toUpperCase())} /></div>
            <div className="field"><label>Nombre *</label><input className="input" value={edit.nombre} onChange={(e) => setF('nombre', e.target.value)} /></div>
            <div className="field"><label>% aporte empleado (cuota sindical afiliado)</label><input className="input" type="number" step="0.01" value={edit.pctEmpleado} onChange={(e) => setF('pctEmpleado', Number(e.target.value))} /></div>
            <div className="field"><label>% aporte solidario (no afiliado)</label><input className="input" type="number" step="0.01" value={edit.pctSolidario || 0} onChange={(e) => setF('pctSolidario', Number(e.target.value))} placeholder="0 = no aplica (cobra cuota sindical)" /></div>
            <div className="field"><label>% contribución patronal</label><input className="input" type="number" step="0.01" value={edit.pctPatronal} onChange={(e) => setF('pctPatronal', Number(e.target.value))} /></div>
            <div className="field"><label>% antigüedad por año</label><input className="input" type="number" step="0.01" value={edit.pctAntigPorAnio} onChange={(e) => setF('pctAntigPorAnio', Number(e.target.value))} /></div>
            <div className="field"><label>Antigüedad monto fijo por año ($)</label><input className="input" type="number" step="0.01" value={edit.montoAntigPorAnio || 0} onChange={(e) => setF('montoAntigPorAnio', Number(e.target.value))} placeholder="0 = usa el % (UECARA: 13332)" /></div>
            <div className="field"><label>% Aporte especial Art.37 I</label><input className="input" type="number" step="0.01" value={edit.pctArt37_1 || 0} onChange={(e) => setF('pctArt37_1', Number(e.target.value))} placeholder="UECARA: 1.5" /></div>
            <div className="field"><label>% Aporte solidario Art.37 II</label><input className="input" type="number" step="0.01" value={edit.pctArt37_2 || 0} onChange={(e) => setF('pctArt37_2', Number(e.target.value))} placeholder="UECARA: 1" /></div>
            <div className="field"><label>% Premio asistencia (jornal UOCRA)</label><input className="input" type="number" step="0.01" value={edit.pctPremio || 0} onChange={(e) => setF('pctPremio', Number(e.target.value))} placeholder="UOCRA: 20" /></div>
            <div className="field"><label>Complemento sin No Rem</label><select className="input" value={edit.complementoSinNoRem ? 'si' : 'no'} onChange={(e) => setF('complementoSinNoRem', e.target.value === 'si')}><option value="no">No (resta el No Rem)</option><option value="si">Sí (UECARA)</option></select></div>
            <div className="field"><label>% presentismo (CCT)</label><input className="input" type="number" step="0.01" value={edit.pctPresentismo} onChange={(e) => setF('pctPresentismo', Number(e.target.value))} placeholder="Ej: 8.33" /></div>
            <div className="field"><label>Base de presentismo</label><select className="input" value={edit.presBase} onChange={(e) => setF('presBase', e.target.value)}>{PRES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="field"><label>Nota</label><input className="input" value={edit.nota || ''} onChange={(e) => setF('nota', e.target.value)} /></div>
            <div className="field"><label>Adicional título secundario ($)</label><input className="input" type="number" value={edit.tituloSecundario || 0} onChange={(e) => setF('tituloSecundario', Number(e.target.value))} placeholder="0 = no aplica" /></div>
            <div className="field"><label>Adicional título universitario ($)</label><input className="input" type="number" value={edit.tituloUniversitario || 0} onChange={(e) => setF('tituloUniversitario', Number(e.target.value))} placeholder="0 = no aplica" /></div>
          </div>
          <button className="btn" onClick={guardar}>Guardar</button>
          <button className="btn ghost" style={{ marginLeft: 8 }} onClick={() => { setEdit(null); setErr(''); }}>Cancelar</button>
        </div>
      ) : puede && <button className="btn" style={{ marginBottom: 12 }} onClick={() => setEdit(vacio())}>+ Nuevo sindicato</button>}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Código</th><th>Nombre</th><th style={{ textAlign: 'right' }}>% empl.</th><th style={{ textAlign: 'right' }}>% patr.</th><th style={{ textAlign: 'right' }}>% antig.</th><th>Presentismo</th><th>Título</th>{puede && <th></th>}</tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.codigo}</strong></td><td>{s.nombre}{s.nota ? <div className="muted" style={{ fontSize: 11 }}>{s.nota}</div> : ''}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{s.pctEmpleado}%</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{s.pctPatronal}%</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{s.pctAntigPorAnio}%</td>
                <td className="muted" style={{ fontSize: 12 }}>{presLbl(s.presBase)}</td>
                <td className="muted" style={{ fontSize: 12 }}>{(s.tituloSecundario || s.tituloUniversitario) ? `Sec $${s.tituloSecundario || 0} · Univ $${s.tituloUniversitario || 0}` : '—'}</td>
                {puede && <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '3px 9px', fontSize: 12, marginRight: 6 }} onClick={() => setEdit({ ...s })}>✎</button>
                  <button className="btn ghost" style={{ padding: '3px 9px', fontSize: 12, color: 'var(--red)' }} onClick={() => borrar(s)}>✕</button>
                </td>}
              </tr>
            ))}
            {!items.length && <tr><td colSpan={puede ? 8 : 7} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin sindicatos.</td></tr>}
          </tbody>
        </table>
      </div>
      <HistorialConfig modulo="sindicatos" />
    </>
  );
}
