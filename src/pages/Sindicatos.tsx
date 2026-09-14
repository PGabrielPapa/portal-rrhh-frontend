import { useEffect, useState } from 'react';
import HistorialConfig from '../components/HistorialConfig';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Sind { id?: number; codigo: string; nombre: string; pctEmpleado: number; pctSolidario: number; pctPatronal: number; pctAntigPorAnio: number; montoAntigPorAnio: number; complementoSinNoRem: boolean; noRemConAntigPres: boolean; pctArt37_1: number; pctArt37_2: number; pctPremio: number; nota?: string; tituloSecundario: number; tituloUniversitario: number; presBase: string; pctPresentismo: number; }
const PRES = [['basico', 'Solo básico'], ['basico+antig', 'Básico + antigüedad'], ['basico+antig+titulo', 'Básico + antig. + título'], ['basico+antig+titulo+acuenta', 'Básico + antig. + título + a cuenta fut. aumentos']];
const vacio = (): Sind => ({ codigo: '', nombre: '', pctEmpleado: 0, pctSolidario: 0, pctPatronal: 0, pctAntigPorAnio: 1, montoAntigPorAnio: 0, complementoSinNoRem: false, noRemConAntigPres: false, pctArt37_1: 0, pctArt37_2: 0, pctPremio: 0, nota: '', tituloSecundario: 0, tituloUniversitario: 0, presBase: 'basico', pctPresentismo: 0 });


// ── Aportes y contribuciones especiales del gremio ───────────────────────────
// Son los conceptos que cada convenio cobra aparte de la cuota sindical (INACAP,
// La Estrella, aporte extraordinario OSECAC, los de UOM…). Se guardan en la misma
// tabla que consumen el asiento de sueldos y el motor de liquidación.
interface Concepto {
  id: number; columna: string; descripcion: string; codSindicato: string | null;
  tipo: string; base: string; pct: number; importe: number;
  cuenta: string | null; confirmado: boolean; activo: boolean; nota?: string | null;
}
const CNum = ({ valor, onGuardar, ancho = 90 }: { valor: number; onGuardar: (v: number) => void; ancho?: number }) => {
  const [v, setV] = useState(String(valor ?? 0));
  useEffect(() => { setV(String(valor ?? 0)); }, [valor]);
  return <input className="input" style={{ width: ancho, padding: '2px 6px', textAlign: 'right', fontFamily: 'monospace' }}
    value={v} onChange={(e) => setV(e.target.value)}
    onBlur={() => { const n = Number(v.replace(',', '.')); if (!isNaN(n) && n !== Number(valor)) onGuardar(n); }}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
};
const CTxt = ({ valor, onGuardar, ancho = 160 }: { valor: string; onGuardar: (v: string) => void; ancho?: number }) => {
  const [v, setV] = useState(valor ?? '');
  useEffect(() => { setV(valor ?? ''); }, [valor]);
  return <input className="input" style={{ width: ancho, padding: '2px 6px' }}
    value={v} onChange={(e) => setV(e.target.value)}
    onBlur={() => { if (v !== (valor ?? '')) onGuardar(v); }}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
};

export default function Sindicatos() {
  const { user } = useAuth();
  const puede = user?.role === 'rrhh' || user?.role === 'admin';
  const [items, setItems] = useState<Sind[]>([]);
  const [edit, setEdit] = useState<Sind | null>(null);
  const [err, setErr] = useState('');
  const [porEmp, setPorEmp] = useState<any[]>([]);
  const [verEmp, setVerEmp] = useState(false);

  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [verConceptos, setVerConceptos] = useState(false);
  const [nuevoC, setNuevoC] = useState<any>(null);

  async function load() { try { setItems(await api.get<Sind[]>('/sindicatos')); } catch (e: any) { setErr(e.message); } }
  async function loadConceptos() { try { setConceptos(await api.get<Concepto[]>('/sindicatos/conceptos')); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { load(); loadConceptos(); }, []);

  async function guardarConcepto(c: Concepto, campo: string, valor: any) {
    setErr('');
    setConceptos((l) => l.map((x) => (x.id === c.id ? { ...x, [campo]: valor } : x)));
    try { await api.put(`/sindicatos/conceptos/${c.id}`, { [campo]: valor }); }
    catch (e: any) { setErr(e.message); loadConceptos(); }
  }
  async function crearConcepto() {
    setErr('');
    try { await api.post('/sindicatos/conceptos', nuevoC); setNuevoC(null); loadConceptos(); }
    catch (e: any) { setErr(e.message); }
  }
  async function borrarConcepto(c: Concepto) {
    if (!window.confirm(`¿Eliminar el concepto ${c.columna}?`)) return;
    try { await api.del(`/sindicatos/conceptos/${c.id}`); loadConceptos(); }
    catch (e: any) { setErr(e.message); }
  }
  const conceptosDe = (codigo: string) => conceptos.filter((c) => (c.codSindicato || '').toUpperCase() === codigo.toUpperCase());
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
            <div className="field"><label>Antig./pres. sobre No Rem</label><select className="input" value={edit.noRemConAntigPres ? 'si' : 'no'} onChange={(e) => setF('noRemConAntigPres', e.target.value === 'si')}><option value="no">No</option><option value="si">Sí (calcula antig. y pres. también sobre el No Rem)</option></select></div>
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
                <td><strong>{s.codigo}</strong></td><td>{s.nombre}
                  {conceptosDe(s.codigo).length > 0 && <span className="badge" style={{ marginLeft: 6 }} title="Aportes y contribuciones especiales del gremio">+{conceptosDe(s.codigo).length} concepto(s)</span>}
                  {s.nota ? <div className="muted" style={{ fontSize: 11 }}>{s.nota}</div> : ''}</td>
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
      <div style={{ margin: '16px 0 10px' }}>
        <button className="btn ghost" onClick={() => setVerConceptos((v) => !v)}>
          {verConceptos ? '▾' : '▸'} Aportes y contribuciones especiales del gremio ({conceptos.length})
          {conceptos.filter((c) => !c.confirmado && c.activo).length > 0 &&
            <span className="badge" style={{ marginLeft: 8, color: 'var(--red)' }}>{conceptos.filter((c) => !c.confirmado && c.activo).length} sin confirmar</span>}
        </button>
      </div>

      {verConceptos && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <strong>Aportes y contribuciones especiales</strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Lo que cada convenio cobra además de la cuota sindical: INACAP, La Estrella, aporte extraordinario OSECAC,
              los conceptos de UOM. Un concepto sin gremio se aplica a todos los legajos.
              <strong> Sólo se liquidan los marcados como confirmados</strong>, y el asiento los imputa a la cuenta indicada.
            </div>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead><tr>
                <th style={{ textAlign: 'left' }}>Código</th><th style={{ textAlign: 'left' }}>Descripción</th>
                <th style={{ textAlign: 'left' }}>Gremio</th><th style={{ textAlign: 'left' }}>Tipo</th>
                <th style={{ textAlign: 'left' }}>Base</th><th>%</th><th>Importe fijo</th>
                <th style={{ textAlign: 'left' }}>Cuenta</th><th>Confirmado</th><th>Activo</th>{puede && <th></th>}
              </tr></thead>
              <tbody>
                {conceptos.map((c) => (
                  <tr key={c.id} style={!c.confirmado && c.activo ? { background: 'rgba(234,179,8,.08)' } : undefined}>
                    <td style={{ fontFamily: 'monospace' }}>{c.columna}</td>
                    <td><CTxt valor={c.descripcion} ancho={230} onGuardar={(v) => guardarConcepto(c, 'descripcion', v)} /></td>
                    <td>
                      <select className="input" style={{ padding: '2px 6px', width: 130 }} value={c.codSindicato || ''}
                        onChange={(e) => guardarConcepto(c, 'codSindicato', e.target.value)}>
                        <option value="">(todos)</option>
                        {items.map((x) => <option key={x.codigo} value={x.codigo}>{x.codigo}</option>)}
                        {c.codSindicato && !items.some((x) => x.codigo === c.codSindicato) && <option value={c.codSindicato}>{c.codSindicato} (fuera del catálogo)</option>}
                      </select>
                    </td>
                    <td>
                      <select className="input" style={{ padding: '2px 6px', width: 120 }} value={c.tipo}
                        onChange={(e) => guardarConcepto(c, 'tipo', e.target.value)}>
                        <option value="contribucion">contribución</option><option value="aporte">aporte</option>
                      </select>
                    </td>
                    <td>
                      <select className="input" style={{ padding: '2px 6px', width: 135 }} value={c.base}
                        onChange={(e) => guardarConcepto(c, 'base', e.target.value)}>
                        <option value="fijo">importe fijo</option><option value="remunerativo">% s/ remunerativo</option>
                      </select>
                    </td>
                    <td><CNum valor={c.pct} ancho={70} onGuardar={(v) => guardarConcepto(c, 'pct', v)} /></td>
                    <td><CNum valor={c.importe} onGuardar={(v) => guardarConcepto(c, 'importe', v)} /></td>
                    <td><CTxt valor={c.cuenta || ''} ancho={80} onGuardar={(v) => guardarConcepto(c, 'cuenta', v)} /></td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={c.confirmado} onChange={(e) => guardarConcepto(c, 'confirmado', e.target.checked)} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={c.activo} onChange={(e) => guardarConcepto(c, 'activo', e.target.checked)} />
                    </td>
                    {puede && <td style={{ textAlign: 'right' }}>
                      <button className="btn ghost" style={{ padding: '3px 9px', fontSize: 12, color: 'var(--red)' }} onClick={() => borrarConcepto(c)}>✕</button>
                    </td>}
                  </tr>
                ))}
                {!conceptos.length && <tr><td colSpan={11} className="muted" style={{ textAlign: 'center', padding: 16 }}>Sin conceptos especiales.</td></tr>}
              </tbody>
            </table>
          </div>
          {puede && (
            <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
              {nuevoC ? (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="field"><label>Código</label><input className="input" style={{ width: 140 }} value={nuevoC.columna} onChange={(e) => setNuevoC({ ...nuevoC, columna: e.target.value.toUpperCase() })} placeholder="CONT_XXX" /></div>
                  <div className="field"><label>Descripción</label><input className="input" style={{ width: 240 }} value={nuevoC.descripcion} onChange={(e) => setNuevoC({ ...nuevoC, descripcion: e.target.value })} /></div>
                  <div className="field"><label>Gremio</label>
                    <select className="input" style={{ width: 140 }} value={nuevoC.codSindicato} onChange={(e) => setNuevoC({ ...nuevoC, codSindicato: e.target.value })}>
                      <option value="">(todos)</option>{items.map((x) => <option key={x.codigo} value={x.codigo}>{x.codigo}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Tipo</label>
                    <select className="input" style={{ width: 130 }} value={nuevoC.tipo} onChange={(e) => setNuevoC({ ...nuevoC, tipo: e.target.value })}>
                      <option value="contribucion">contribución</option><option value="aporte">aporte</option>
                    </select>
                  </div>
                  <div className="field"><label>Base</label>
                    <select className="input" style={{ width: 145 }} value={nuevoC.base} onChange={(e) => setNuevoC({ ...nuevoC, base: e.target.value })}>
                      <option value="fijo">importe fijo</option><option value="remunerativo">% s/ remunerativo</option>
                    </select>
                  </div>
                  <div className="field"><label>%</label><input className="input" type="number" step="0.0001" style={{ width: 90 }} value={nuevoC.pct} onChange={(e) => setNuevoC({ ...nuevoC, pct: e.target.value })} /></div>
                  <div className="field"><label>Importe</label><input className="input" type="number" step="0.01" style={{ width: 110 }} value={nuevoC.importe} onChange={(e) => setNuevoC({ ...nuevoC, importe: e.target.value })} /></div>
                  <div className="field"><label>Cuenta</label><input className="input" style={{ width: 90 }} value={nuevoC.cuenta} onChange={(e) => setNuevoC({ ...nuevoC, cuenta: e.target.value })} /></div>
                  <button className="btn" onClick={crearConcepto} disabled={!nuevoC.columna || !nuevoC.descripcion}>Agregar</button>
                  <button className="btn ghost" onClick={() => setNuevoC(null)}>Cancelar</button>
                </div>
              ) : (
                <button className="btn ghost" onClick={() => setNuevoC({ columna: '', descripcion: '', codSindicato: '', tipo: 'contribucion', base: 'fijo', pct: 0, importe: 0, cuenta: '' })}>+ Nuevo concepto</button>
              )}
            </div>
          )}
        </div>
      )}

      <HistorialConfig modulo="sindicatos" />
    </>
  );
}
