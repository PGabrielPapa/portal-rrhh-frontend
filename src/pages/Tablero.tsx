import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Dash {
  periodo: { anio: number; mes: number };
  headcount: number; totalEmpleados: number; masaBruta: number; costoLaboral: number; contribPct: number;
  sueldoProm: number; antiguedadProm: number; altas: number; bajas: number;
  ausentismo: { dias: number; casos: number };
  porEmpresa: { empresa: string; headcount: number; masaBruta: number }[];
  genero: Record<string, number>;
  evolucion: { mes: number; neto: number }[];
}
const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const $ = (n: number) => '$ ' + (n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

function Card({ t, v, sub }: { t: string; v: string; sub?: string }) {
  return (
    <div className="card" style={{ flex: '1 1 160px', minWidth: 160 }}>
      <div className="muted" style={{ fontSize: 12 }}>{t}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{v}</div>
      {sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

export default function Tablero() {
  const d = new Date();
  const [anio, setAnio] = useState(d.getFullYear());
  const [mes, setMes] = useState(d.getMonth() + 1);
  const [data, setData] = useState<Dash | null>(null);
  const [err, setErr] = useState('');

  async function cargar() {
    setErr('');
    try { setData(await api.get<Dash>(`/dashboard?anio=${anio}&mes=${mes}`)); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [anio, mes]);

  const maxEvo = data ? Math.max(1, ...data.evolucion.map((e) => e.neto)) : 1;
  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
        <div className="field"><label>Año</label><input className="input" style={{ width: 100 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
      </div>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {data && <>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <Card t="Plantel activo" v={String(data.headcount)} sub={`${data.totalEmpleados} en total`} />
          <Card t="Masa salarial bruta" v={$(data.masaBruta)} />
          <Card t="Costo laboral estimado" v={$(data.costoLaboral)} sub={`+${data.contribPct}% contribuciones`} />
          <Card t="Sueldo promedio" v={$(data.sueldoProm)} />
          <Card t="Antigüedad promedio" v={`${data.antiguedadProm} años`} />
          <Card t="Altas / Bajas del mes" v={`${data.altas} / ${data.bajas}`} />
          <Card t="Ausentismo del mes" v={`${data.ausentismo.dias} días`} sub={`${data.ausentismo.casos} casos`} />
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="card" style={{ flex: '1 1 320px' }}>
            <h4 style={{ marginTop: 0 }}>Por empresa</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr><th style={{ textAlign: 'left', padding: '4px 8px' }}>Empresa</th><th style={{ textAlign: 'right' }}>Plantel</th><th style={{ textAlign: 'right', padding: '4px 8px' }}>Masa bruta</th></tr></thead>
              <tbody>{data.porEmpresa.map((e) => <tr key={e.empresa}><td style={{ padding: '4px 8px' }}>{e.empresa}</td><td style={{ textAlign: 'right' }}>{e.headcount}</td><td style={{ textAlign: 'right', padding: '4px 8px', fontFamily: 'monospace' }}>{$(e.masaBruta)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="card" style={{ flex: '1 1 220px' }}>
            <h4 style={{ marginTop: 0 }}>Distribución por género</h4>
            {Object.entries(data.genero).map(([g, n]) => <div key={g} className="row" style={{ justifyContent: 'space-between' }}><span>{g}</span><b>{n}</b></div>)}
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <h4 style={{ marginTop: 0 }}>Evolución neto liquidado {anio}</h4>
          <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 140 }}>
            {data.evolucion.map((e) => (
              <div key={e.mes} style={{ flex: 1, textAlign: 'center' }} title={$(e.neto)}>
                <div style={{ height: `${Math.round((e.neto / maxEvo) * 110)}px`, background: 'rgba(61,127,255,.5)', borderRadius: '4px 4px 0 0' }} />
                <div className="muted" style={{ fontSize: 10 }}>{MESES[e.mes]}</div>
              </div>
            ))}
            {!data.evolucion.length && <span className="muted">Sin recibos liquidados este año.</span>}
          </div>
        </div>
      </>}
    </>
  );
}
