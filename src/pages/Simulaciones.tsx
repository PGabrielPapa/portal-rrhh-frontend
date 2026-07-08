import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';
import EmpleadoPicker from '../components/EmpleadoPicker';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const $ = (n: any) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SUPUESTOS_BAJA: [string, string][] = [['renuncia', 'Renuncia (Art. 240)'], ['sin_causa', 'Despido sin causa (Art. 245)'], ['fuerza_mayor', 'Fuerza mayor / falta de trabajo (Art. 247)'], ['con_causa', 'Despido con justa causa (Art. 242)'], ['mutuo', 'Mutuo acuerdo (Art. 241)'], ['jubilacion', 'Jubilación / Retiro (Art. 252)'], ['fallecimiento', 'Fallecimiento (Art. 248)'], ['prueba', 'Período de prueba (Art. 92 bis)']];

interface Item { legNum: string; nom: string; empresa: string; netoActual: number; netoSim: number; costoActual: number; costoSim: number; }
interface Resp { incrementoPct: number; cant: number; items: Item[]; totales: { netoActual: number; netoSim: number; costoActual: number; costoSim: number; deltaCosto: number; deltaNeto: number }; }

function SimIncremento() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [empresa, setEmpresa] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [pct, setPct] = useState('10');
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get<Empleado[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {}); }, []);
  async function simular() {
    setErr(''); setBusy(true); setData(null);
    try { setData(await api.post<Resp>('/liquidacion/simular', { anio, mes, empresa: empresa || undefined, incrementoPct: Number(pct) })); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const t = data?.totales;
  const pctCosto = t && t.costoActual ? (t.deltaCosto / t.costoActual * 100) : 0;

  return (
    <>
      <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>Simulá el impacto de un incremento salarial en el costo laboral, sin afectar la liquidación oficial.</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
          <div className="field"><label>Año</label><input className="input" type="number" style={{ width: 100 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
          <div className="field"><label>Empresa</label><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select></div>
          <div className="field"><label>Incremento %</label><input className="input" type="number" step="0.01" style={{ width: 100 }} value={pct} onChange={(e) => setPct(e.target.value)} /></div>
          <button className="btn" onClick={simular} disabled={busy}>{busy ? 'Calculando…' : '🧮 Simular'}</button>
        </div>
        {err && <div className="err" style={{ marginTop: 10 }}>⚠ {err}</div>}
      </div>

      {t && (
        <>
          <div className="grid2" style={{ marginBottom: 16 }}>
            <div className="card"><div className="muted" style={{ fontSize: 12 }}>Costo laboral actual ({data!.cant} empl.)</div><div style={{ fontSize: 20, fontFamily: 'monospace' }}>$ {$(t.costoActual)}</div></div>
            <div className="card"><div className="muted" style={{ fontSize: 12 }}>Costo laboral simulado (+{data!.incrementoPct}%)</div><div style={{ fontSize: 20, fontFamily: 'monospace', color: 'var(--accent2)' }}>$ {$(t.costoSim)}</div>
              <div style={{ fontSize: 13, color: 'var(--yellow)' }}>Δ $ {$(t.deltaCosto)} ({pctCosto.toFixed(2)}%)</div></div>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead><tr><th>Legajo</th><th>Empleado</th><th>Empresa</th><th style={{ textAlign: 'right' }}>Neto actual</th><th style={{ textAlign: 'right' }}>Neto sim.</th><th style={{ textAlign: 'right' }}>Costo actual</th><th style={{ textAlign: 'right' }}>Costo sim.</th></tr></thead>
              <tbody>
                {data!.items.map((it, i) => (
                  <tr key={i}><td>{it.legNum}</td><td>{it.nom}</td><td>{it.empresa}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(it.netoActual)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(it.netoSim)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(it.costoActual)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent2)' }}>{$(it.costoSim)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}


function SimGratificacion() {
  const [empresa, setEmpresa] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [concepto, setConcepto] = useState('Gratificación extraordinaria');
  const [tipo, setTipo] = useState('rem');
  const [modo, setModo] = useState('fijo');
  const [valor, setValor] = useState('100000');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => { api.get<Empleado[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {}); }, []);
  async function calcular() {
    setErr(''); setBusy(true); setData(null);
    try { setData(await api.post('/liquidacion/simular-gratificacion', { empresa: empresa || undefined, concepto, tipo, modo, valor: Number(valor) })); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const t = data?.totales;
  function csv() {
    if (!data) return;
    const head = 'Legajo,Nombre,Empresa,Importe,Aportes,Neto,Contribuciones,Incidencia SAC,Costo';
    const lines = data.items.map((x: any) => `${x.legNum},"${x.nom}","${x.empresa}",${x.importe},${x.aportes},${x.neto},${x.contrib},${x.incidSac},${x.costo}`);
    const blob = new Blob(['\ufeff' + [head, ...lines].join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gratificacion.csv'; a.click();
  }

  return (
    <>
      <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>Simulá una gratificación remunerativa (con aportes y contribuciones) o no remunerativa (Art. 103 bis, sin aportes), sin afectar la liquidación.</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid2" style={{ marginBottom: 10 }}>
          <div className="field"><label>Concepto</label><input className="input" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></div>
          <div className="field"><label>Tipo</label><select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="rem">Remunerativa (con aportes)</option><option value="norem">No remunerativa (Art. 103 bis, sin aportes)</option></select></div>
          <div className="field"><label>Modo</label><select className="input" value={modo} onChange={(e) => setModo(e.target.value)}><option value="fijo">Monto fijo por empleado</option><option value="pctBruto">% del bruto</option></select></div>
          <div className="field"><label>{modo === 'pctBruto' ? 'Porcentaje %' : 'Monto $'}</label><input className="input" type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div className="field"><label>Empresa</label><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select></div>
        </div>
        <button className="btn" onClick={calcular} disabled={busy || !valor}>{busy ? 'Calculando…' : '🎁 Calcular gratificación'}</button>
        {err && <div className="err" style={{ marginTop: 10 }}>⚠ {err}</div>}
      </div>

      {t && (
        <>
          <div className="card" style={{ marginBottom: 14, fontSize: 13 }}>
            <strong>{data.cant} empleados</strong> · Importe total <strong>$ {$(t.importe)}</strong>
            {data.tipo === 'rem' && <> · Aportes $ {$(t.aportes)} · Contribuciones $ {$(t.contrib)} · Incidencia SAC $ {$(t.incidSac)}</>}
            {' '}· <strong style={{ color: 'var(--accent2)' }}>Costo empresa $ {$(t.costo)}</strong>
            <button className="btn ghost" style={{ marginLeft: 10, padding: '3px 10px', fontSize: 12 }} onClick={csv}>⬇ CSV</button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead><tr><th>Legajo</th><th>Empleado</th><th>Empresa</th><th style={{ textAlign: 'right' }}>Importe</th><th style={{ textAlign: 'right' }}>Aportes</th><th style={{ textAlign: 'right' }}>Neto</th><th style={{ textAlign: 'right' }}>Contrib.</th><th style={{ textAlign: 'right' }}>Costo</th></tr></thead>
              <tbody>
                {data.items.map((x: any, i: number) => (
                  <tr key={i}><td>{x.legNum}</td><td>{x.nom}</td><td>{x.empresa}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(x.importe)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(x.aportes)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{$(x.neto)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(x.contrib)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent2)' }}>{$(x.costo)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function SimFinal() {
  const [emp, setEmp] = useState<Empleado | null>(null);
  const [fechaEgreso, setFechaEgreso] = useState('');
  const [diasVac, setDiasVac] = useState('');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  async function calcular() {
    if (!emp) return; setErr(''); setBusy(true); setData(null);
    try { setData(await api.post('/liquidacion/simular-final', { empleadoId: emp.id, fechaEgreso, diasVacNoGozadas: diasVac ? Number(diasVac) : 0 })); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>Simulá la liquidación final de un empleado y compará los 7 supuestos legales de baja.</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid2" style={{ marginBottom: 10 }}>
          <div className="field"><label>Empleado</label><EmpleadoPicker onSelect={setEmp} /></div>
          <div className="field"><label>Fecha de egreso *</label><input className="input" type="date" value={fechaEgreso} onChange={(e) => setFechaEgreso(e.target.value)} /></div>
          <div className="field"><label>Días de vacaciones no gozadas</label><input className="input" type="number" value={diasVac} onChange={(e) => setDiasVac(e.target.value)} /></div>
        </div>
        <button className="btn" onClick={calcular} disabled={busy || !emp || !fechaEgreso}>{busy ? 'Calculando…' : '⚖️ Comparar supuestos'}</button>
        {err && <div className="err" style={{ marginTop: 10 }}>⚠ {err}</div>}
      </div>

      {data && (
        <>
          <div className="muted" style={{ marginBottom: 8 }}>{data.empleado.nom} · Leg. {data.empleado.legNum} · {data.empleado.empresa} · Ingreso {String(data.empleado.ingreso || '').slice(0, 10)}</div>
          <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 14 }}>
            <table>
              <thead><tr><th>Supuesto legal</th><th style={{ textAlign: 'right' }}>Total a pagar (neto)</th></tr></thead>
              <tbody>
                {data.escenarios.map((es: any) => (
                  <tr key={es.supuesto}><td>{es.label}</td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>$ {$(es.neto)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.escenarios.map((es: any) => (
            <details key={es.supuesto} className="card" style={{ marginBottom: 8 }}>
              <summary style={{ cursor: 'pointer' }}><strong>{es.label}</strong> — neto $ {$(es.neto)}</summary>
              <table style={{ width: '100%', fontSize: 13, marginTop: 8 }}><tbody>
                {es.haberes.map((h: any, i: number) => <tr key={i}><td>{h.concepto}{h.tipo === 'norem' ? ' (no rem.)' : h.tipo === 'exento' ? ' (exento)' : ''}</td><td style={{ textAlign: 'right', fontFamily: 'monospace' }}>$ {$(h.monto)}</td></tr>)}
              </tbody></table>
            </details>
          ))}
        </>
      )}
    </>
  );
}

function SimFinalMasiva() {
  const [empresa, setEmpresa] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [fechaEgreso, setFechaEgreso] = useState('');
  const [supuesto, setSupuesto] = useState('sin_causa');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api.get<Empleado[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {}); }, []);
  async function calcular() {
    setErr(''); setBusy(true); setData(null);
    try { setData(await api.post('/liquidacion/simular-final-masivo', { empresa: empresa || undefined, fechaEgreso, supuesto })); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  function csv() {
    if (!data) return;
    const sup = data.supuestos as any[];
    const head = ['Legajo', 'Empleado', 'Empresa', ...sup.map((sp) => sp.lbl)].join(',');
    const lines = data.items.map((it: any) => [it.legNum, `"${it.nom}"`, `"${it.empresa}"`, ...sup.map((sp) => it.netos[sp.v] ?? 0)].join(','));
    const tot = ['TOTAL', '', '', ...sup.map((sp) => data.totales[sp.v] ?? 0)].join(',');
    const blob = new Blob(['\ufeff' + [head, ...lines, tot].join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'liquidaciones_finales_masivas.csv'; a.click();
  }
  const sup = (data?.supuestos || []) as any[];
  return (
    <>
      <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>Liquidación final de todo el plantel (o de una empresa) comparando los 7 supuestos legales de baja, a una misma fecha de egreso. No afecta la liquidación oficial.</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field"><label>Empresa</label><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select></div>
          <div className="field"><label>Fecha de egreso *</label><input className="input" type="date" value={fechaEgreso} onChange={(e) => setFechaEgreso(e.target.value)} /></div>
          <div className="field"><label>Causa de desvinculación</label><select className="input" value={supuesto} onChange={(e) => setSupuesto(e.target.value)}>{SUPUESTOS_BAJA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <button className="btn" onClick={calcular} disabled={busy || !fechaEgreso}>{busy ? 'Calculando…' : '⚖️ Comparar supuestos (masivo)'}</button>
        </div>
        {err && <div className="err" style={{ marginTop: 10 }}>⚠ {err}</div>}
      </div>
      {data && (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <div className="row" style={{ justifyContent: 'space-between', padding: '8px 12px' }}><strong>{data.cant} empleados</strong><button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={csv}>⬇ CSV</button></div>
          <table>
            <thead><tr><th>Legajo</th><th>Empleado</th><th>Empresa</th>{sup.map((sp) => <th key={sp.v} style={{ textAlign: 'right' }}>{sp.lbl}</th>)}</tr></thead>
            <tbody>
              {data.items.map((it: any, i: number) => (
                <tr key={i}><td style={{ fontFamily: 'monospace' }}>{it.legNum}</td><td>{it.nom}</td><td>{it.empresa}</td>
                  {sup.map((sp) => <td key={sp.v} style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(it.netos[sp.v])}</td>)}</tr>
              ))}
            </tbody>
            <tfoot><tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}><td colSpan={3}>Totales</td>{sup.map((sp) => <td key={sp.v} style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--green)' }}>{$(data.totales[sp.v])}</td>)}</tr></tfoot>
          </table>
        </div>
      )}
    </>
  );
}
function SimBruto() {
  const [neto, setNeto] = useState('');
  const [sind, setSind] = useState('');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function calc() {
    setErr(''); setBusy(true); setData(null);
    try { setData(await api.post<any>('/liquidacion/simular-bruto', { neto: Number(neto), sindicalPct: Number(sind) || 0 })); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <>
      <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>Ingresá el neto "de bolsillo" y calculá el sueldo bruto necesario (aportes del trabajador con tope SIPA; sin Impuesto a las Ganancias).</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field"><label>Neto deseado *</label><input className="input" type="number" style={{ width: 180 }} value={neto} onChange={(e) => setNeto(e.target.value)} /></div>
          <div className="field"><label>Cuota sindical % (opcional)</label><input className="input" type="number" step="0.01" style={{ width: 150 }} value={sind} onChange={(e) => setSind(e.target.value)} /></div>
          <button className="btn" onClick={calc} disabled={busy || !(Number(neto) > 0)}>{busy ? 'Calculando…' : 'Calcular bruto'}</button>
        </div>
        {err && <p className="err" style={{ marginBottom: 0 }}>⚠ {err}</p>}
      </div>
      {data && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 15 }}><span>Sueldo bruto necesario</span><strong style={{ color: 'var(--green)', fontFamily: 'monospace' }}>$ {$(data.bruto)}</strong></div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '10px 0' }} />
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}><span className="muted">Aportes Jub + OS + ANSSAL + PAMI (base $ {$(data.base)})</span><span style={{ fontFamily: 'monospace' }}>$ {$(data.aportes.jubOsPamiAnssal)}</span></div>
          {data.aportes.sindical > 0 && <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}><span className="muted">Cuota sindical</span><span style={{ fontFamily: 'monospace' }}>$ {$(data.aportes.sindical)}</span></div>}
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}><span className="muted">Neto resultante</span><span style={{ fontFamily: 'monospace' }}>$ {$(data.neto)}</span></div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>{data.nota}</p>
        </div>
      )}
    </>
  );
}
export default function Simulaciones() {
  const [tab, setTab] = useState('incremento');
  return (
    <>
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        <button className={`btn ${tab === 'incremento' ? '' : 'ghost'}`} style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => setTab('incremento')}>Incremento salarial</button>
        <button className={`btn ${tab === 'gratificacion' ? '' : 'ghost'}`} style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => setTab('gratificacion')}>Gratificaciones</button>
        <button className={`btn ${tab === 'final' ? '' : 'ghost'}`} style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => setTab('final')}>Liquidación final</button>
        <button className={`btn ${tab === 'final_masiva' ? '' : 'ghost'}`} style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => setTab('final_masiva')}>Final masiva</button>
        <button className={`btn ${tab === 'bruto' ? '' : 'ghost'}`} style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => setTab('bruto')}>Bruto desde neto</button>
      </div>
      {tab === 'incremento' ? <SimIncremento /> : tab === 'gratificacion' ? <SimGratificacion /> : tab === 'final' ? <SimFinal /> : tab === 'final_masiva' ? <SimFinalMasiva /> : <SimBruto />}
    </>
  );
}