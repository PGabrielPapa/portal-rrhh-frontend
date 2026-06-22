import { useState } from 'react';
import { api } from '../lib/api';
import GananciasCheck from '../components/GananciasCheck';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MOTIVOS: [string, string][] = [['sin_causa', 'Despido sin causa'], ['renuncia', 'Renuncia'], ['mutuo', 'Mutuo acuerdo (Art. 241)'], ['fallecimiento', 'Fallecimiento (Art. 248)'], ['prueba', 'Período de prueba']];
const money = (n: any) => '$ ' + (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Modo = 'mensual' | 'anual' | 'final';

export default function SimuladorGanancias() {
  const [modo, setModo] = useState<Modo>('anual');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [remBruto, setRemBruto] = useState('5000000');
  const [tieneConyuge, setTieneConyuge] = useState(false);
  const [hijos, setHijos] = useState('0');
  const [hijosInc, setHijosInc] = useState('0');
  const [noHabMonto, setNoHabMonto] = useState('0');
  const [noHabMes, setNoHabMes] = useState('0');
  const [ingreso, setIngreso] = useState(`${new Date().getFullYear() - 3}-01-01`);
  const [fechaEgreso, setFechaEgreso] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-28`);
  const [motivoBaja, setMotivoBaja] = useState('sin_causa');
  const [diasVacNoGozadas, setDiasVacNoGozadas] = useState('0');
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function simular() {
    setErr(''); setBusy(true); setRes(null);
    try {
      const body: any = {
        modo, anio, remBruto: Number(remBruto) || 0, tieneConyuge,
        hijos: Number(hijos) || 0, hijosInc: Number(hijosInc) || 0,
      };
      if (modo === 'mensual') { body.mes = mes; body.noHabMonto = Number(noHabMonto) || 0; body.noHabMes = Number(noHabMes) || 0; }
      if (modo === 'anual') { body.noHabMonto = Number(noHabMonto) || 0; body.noHabMes = Number(noHabMes) || 0; }
      if (modo === 'final') { body.ingreso = ingreso; body.fechaEgreso = fechaEgreso; body.motivoBaja = motivoBaja; body.diasVacNoGozadas = Number(diasVacNoGozadas) || 0; }
      setRes(await api.post('/ganancias/simular', body));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  const tab = (m: Modo, label: string) => (
    <button className={'btn' + (modo === m ? '' : ' ghost')} onClick={() => { setModo(m); setRes(null); }} style={{ padding: '6px 14px' }}>{label}</button>
  );
  const Row = ({ label, value, bold }: { label: string; value: any; bold?: boolean }) => (
    <div className="row" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span><span style={{ fontFamily: 'monospace' }}>{money(value)}</span>
    </div>
  );

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        {tab('mensual', 'Mensual')}{tab('anual', 'Anual')}{tab('final', 'Liquidación final')}
      </div>

      <GananciasCheck anio={anio} mes={modo === 'mensual' ? mes : 1} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div className="field"><label>Año fiscal</label><input className="input" type="number" style={{ width: 100 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
          {modo === 'mensual' && <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>}
          <div className="field"><label>Remuneración bruta mensual</label><input className="input" type="number" value={remBruto} onChange={(e) => setRemBruto(e.target.value)} /></div>
          <div className="field"><label>Hijos</label><input className="input" type="number" style={{ width: 80 }} value={hijos} onChange={(e) => setHijos(e.target.value)} /></div>
          <div className="field"><label>Hijos c/disc.</label><input className="input" type="number" style={{ width: 80 }} value={hijosInc} onChange={(e) => setHijosInc(e.target.value)} /></div>
          <label className="row muted" style={{ gap: 6, paddingBottom: 8 }}><input type="checkbox" checked={tieneConyuge} onChange={(e) => setTieneConyuge(e.target.checked)} /> Cónyuge a cargo</label>
        </div>

        {(modo === 'anual' || modo === 'mensual') && (
          <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginTop: 8 }}>
            <div className="field"><label>No habitual — monto (Apartado B)</label><input className="input" type="number" value={noHabMonto} onChange={(e) => setNoHabMonto(e.target.value)} placeholder="gratificación / ajuste" /></div>
            <div className="field"><label>No habitual — mes de pago</label>
              <select className="input" value={noHabMes} onChange={(e) => setNoHabMes(e.target.value)}>
                <option value="0">— sin no habitual —</option>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>
        )}

        {modo === 'final' && (
          <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginTop: 8 }}>
            <div className="field"><label>Fecha de ingreso</label><input className="input" type="date" value={ingreso} onChange={(e) => setIngreso(e.target.value)} /></div>
            <div className="field"><label>Fecha de egreso</label><input className="input" type="date" value={fechaEgreso} onChange={(e) => setFechaEgreso(e.target.value)} /></div>
            <div className="field"><label>Motivo de baja</label><select className="input" value={motivoBaja} onChange={(e) => setMotivoBaja(e.target.value)}>{MOTIVOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="field"><label>Días vac. no gozadas</label><input className="input" type="number" style={{ width: 110 }} value={diasVacNoGozadas} onChange={(e) => setDiasVacNoGozadas(e.target.value)} /></div>
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}><button className="btn" onClick={simular} disabled={busy}>{busy ? 'Calculando…' : 'Simular'}</button></div>
        {err && <div className="err" style={{ marginTop: 10 }}>⚠ {err}</div>}
      </div>

      {/* ───── MENSUAL ───── */}
      {res && res.modo === 'mensual' && res.detalle && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Retención de {MESES[res.mes - 1]} {res.anio} <span className="muted" style={{ fontSize: 12 }}>· tabla {res.tablaPeriodo || '—'}</span></h3>
          <div style={{ maxWidth: 560 }}>
            <Row label="Remuneración gravada acumulada (A+B)" value={res.detalle.gravadoBase} />
            <Row label="SAC — 1/12 (Apartado C)" value={res.detalle.sacProvision} />
            <Row label="Aportes (incl. 1/12 SAC)" value={res.detalle.aportes} />
            <Row label="Ganancia no imponible" value={res.detalle.mni} />
            <Row label="Deducción especial" value={res.detalle.dedEspecial} />
            <Row label="Cargas de familia" value={res.detalle.cargasFamilia} />
            <Row label="Remuneración sujeta a impuesto" value={res.detalle.remSujeta} bold />
            <Row label="Impuesto determinado (acumulado)" value={res.detalle.impuestoDeterminado} />
            <Row label="Retenido en meses anteriores" value={res.detalle.retenidoAnterior} />
            <Row label="Retención del mes" value={res.detalle.retencionMes} bold />
          </div>
        </div>
      )}

      {/* ───── ANUAL ───── */}
      {res && res.modo === 'anual' && (
        <>
          <div className="card" style={{ marginBottom: 16, fontSize: 13 }}>
            <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
              <div><div className="muted" style={{ fontSize: 11 }}>Tabla</div><b>{res.tablaPeriodo || '—'}</b></div>
              <div><div className="muted" style={{ fontSize: 11 }}>Aportes ({res.pctAportes}%/mes)</div><b>{money(res.aporMes)}</b></div>
              <div><div className="muted" style={{ fontSize: 11 }}>Retenido en el año</div><b>{money(res.totalRetenidoMensual)}</b></div>
              <div><div className="muted" style={{ fontSize: 11 }}>Impuesto anual</div><b>{money(res.anual.impuestoDeterminado)}</b></div>
              <div><div className="muted" style={{ fontSize: 11 }}>Ajuste liquidación anual</div>
                <b style={{ color: Math.abs(res.anual.ajusteFinal) < 0.5 ? 'var(--green)' : 'var(--yellow)' }}>
                  {Math.abs(res.anual.ajusteFinal) < 0.5 ? 'reconcilia $ 0,00 ✓' : (res.anual.ajusteFinal > 0 ? 'a retener ' : 'a devolver ') + money(Math.abs(res.anual.ajusteFinal))}
                </b>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead><tr><th>Mes</th><th style={{ textAlign: 'right' }}>Gravado (A+B)</th><th style={{ textAlign: 'right' }}>SAC 1/12</th><th style={{ textAlign: 'right' }}>Aportes</th><th style={{ textAlign: 'right' }}>Deducc. pers.</th><th style={{ textAlign: 'right' }}>Rem. sujeta</th><th style={{ textAlign: 'right' }}>Retención del mes</th></tr></thead>
              <tbody>
                {res.meses.map((m: any) => (
                  <tr key={m.mes}>
                    <td>{MESES[m.mes - 1]}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(m.gravadoBase)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(m.sacProvision)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(m.aportes)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(m.deducciones)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(m.remSujeta)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{money(m.retencionMes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ───── FINAL ───── */}
      {res && res.modo === 'final' && res.recibo && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Liquidación final — egreso {res.fechaEgreso} <span className="muted" style={{ fontSize: 12 }}>· {MOTIVOS.find((x) => x[0] === res.motivoBaja)?.[1]}</span></h3>
          <div style={{ maxWidth: 620 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', margin: '6px 0' }}>Haberes</div>
            {res.recibo.haberes.map((h: any, i: number) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span>{h.concepto} {h.tipo === 'exento' && <span className="muted">(exento)</span>}{h.tipo === 'norem' && <span className="muted">(no rem.)</span>}</span>
                <span style={{ fontFamily: 'monospace' }}>{money(h.monto)}</span>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', margin: '10px 0 6px' }}>Descuentos</div>
            {res.recibo.descuentos.map((d: any, i: number) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span>{d.concepto}</span><span style={{ fontFamily: 'monospace' }}>{money(d.monto)}</span>
              </div>
            ))}
            <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0', fontWeight: 700, fontSize: 15, marginTop: 4 }}>
              <span>Neto a cobrar</span><span style={{ fontFamily: 'monospace' }}>{money(res.recibo.totales?.neto)}</span>
            </div>
            {res.recibo.ganancias && (
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Ganancias (liquidación final): remuneración sujeta {money(res.recibo.ganancias.remSujeta)} · impuesto determinado {money(res.recibo.ganancias.impuestoDeterminado)} · retenido antes {money(res.recibo.ganancias.retenidoAnterior)}. Las indemnizaciones están exentas (Art. 20 / jurisprudencia).
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
