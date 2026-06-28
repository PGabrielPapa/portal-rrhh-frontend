import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Issue { severidad: string; empleadoId: number; nom: string; legNum: string; tipo: string; detalle: string }
interface Resp { periodo: { anio: number; mes: number }; resumen: { recibos: number; errores: number; warnings: number; info: number }; issues: Issue[] }
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const COLOR: Record<string, string> = { error: '#b91c1c', warn: '#b45309', info: '#1d4ed8' };
const LABEL: Record<string, string> = { error: 'Error', warn: 'Atención', info: 'Info' };

export default function ControlesLiq() {
  const d = new Date();
  const [anio, setAnio] = useState(d.getFullYear());
  const [mes, setMes] = useState(d.getMonth() + 1);
  const [umbral, setUmbral] = useState(30);
  const [data, setData] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function cargar() {
    setErr(''); setBusy(true); setData(null);
    try { setData(await api.get<Resp>(`/liquidacion/controles?anio=${anio}&mes=${mes}&umbral=${umbral}`)); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
        <div className="field"><label>Año</label><input className="input" style={{ width: 100 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
        <div className="field"><label>Umbral variación %</label><input className="input" style={{ width: 90 }} type="number" value={umbral} onChange={(e) => setUmbral(Number(e.target.value))} /></div>
        <button className="btn" onClick={cargar} disabled={busy}>{busy ? 'Revisando…' : 'Revisar'}</button>
        {data && <div className="muted" style={{ alignSelf: 'center' }}>{data.resumen.recibos} recibos · <b style={{ color: COLOR.error }}>{data.resumen.errores} errores</b> · <b style={{ color: COLOR.warn }}>{data.resumen.warnings} atención</b> · {data.resumen.info} info</div>}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Revisá esto <b>antes de publicar/cerrar</b> la corrida del período. Controla netos negativos, aportes fuera del 17%, sueldos sobre el tope SIPA, variaciones bruscas vs. el mes anterior y empleados activos sin recibo.</p>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {data && !data.issues.length && <p className="ok">Sin observaciones. La corrida luce consistente. 👍</p>}
      {data && data.issues.length > 0 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg2)' }}>
              {['', 'Empleado', 'Control', 'Detalle'].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.issues.map((it, i) => (
                <tr key={i}>
                  <td style={{ padding: '4px 8px' }}><span style={{ color: COLOR[it.severidad], fontWeight: 700 }}>{LABEL[it.severidad]}</span></td>
                  <td style={{ padding: '4px 8px' }}>{it.nom} <span className="muted">· {it.legNum}</span></td>
                  <td style={{ padding: '4px 8px' }}>{it.tipo}</td>
                  <td style={{ padding: '4px 8px' }}>{it.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
