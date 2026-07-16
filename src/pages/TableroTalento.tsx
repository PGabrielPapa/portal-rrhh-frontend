import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Tal {
  anio: number;
  dotacion: number; altasAnio: number; bajasAnio: number; rotacion: number;
  antiguedadProm: number; edadProm: number; tasaAusentismo: number; diasAusencia: number;
  serie: { mes: number; altas: number; bajas: number }[];
  distribAntiguedad: { rango: string; n: number }[];
  ausentismoPorTipo: { tipo: string; dias: number; casos: number }[];
  porEmpresa: { empresa: string; n: number }[];
}
const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function Card({ t, v, sub }: { t: string; v: string; sub?: string }) {
  return (
    <div className="card" style={{ flex: '1 1 160px', minWidth: 160 }}>
      <div className="muted" style={{ fontSize: 12 }}>{t}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{v}</div>
      {sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

export default function TableroTalento() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [data, setData] = useState<Tal | null>(null);
  const [err, setErr] = useState('');

  async function cargar() {
    setErr('');
    try { setData(await api.get<Tal>(`/dashboard/talento?anio=${anio}`)); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [anio]);

  const maxSerie = data ? Math.max(1, ...data.serie.map((s) => Math.max(s.altas, s.bajas))) : 1;
  const maxAntig = data ? Math.max(1, ...data.distribAntiguedad.map((b) => b.n)) : 1;
  const maxAus = data ? Math.max(1, ...data.ausentismoPorTipo.map((a) => a.dias)) : 1;

  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Año</label><input className="input" style={{ width: 110 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
      </div>
      <p className="muted" style={{ marginTop: -8, marginBottom: 12, fontSize: 12 }}>
        Métricas de gestión de personas del año. La rotación es un índice estimado sobre la dotación promedio; el ausentismo excluye vacaciones y se estima sobre 220 días laborables por persona.
      </p>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {data && <>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <Card t="Dotación actual" v={String(data.dotacion)} />
          <Card t="Altas del año" v={String(data.altasAnio)} />
          <Card t="Bajas del año" v={String(data.bajasAnio)} />
          <Card t="Rotación" v={`${data.rotacion}%`} sub="índice anual estimado" />
          <Card t="Antigüedad promedio" v={`${data.antiguedadProm} años`} />
          <Card t="Edad promedio" v={data.edadProm ? `${data.edadProm} años` : '—'} sub={data.edadProm ? undefined : 'sin fecha de nac.'} />
          <Card t="Ausentismo" v={`${data.tasaAusentismo}%`} sub={`${data.diasAusencia} días (excl. vacaciones)`} />
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <h4 style={{ marginTop: 0 }}>Altas y bajas por mes — {anio}</h4>
          <div className="row" style={{ alignItems: 'flex-end', gap: 8, height: 150 }}>
            {data.serie.map((s) => (
              <div key={s.mes} style={{ flex: 1, textAlign: 'center' }} title={`Altas ${s.altas} · Bajas ${s.bajas}`}>
                <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: 115 }}>
                  <div style={{ width: 10, height: `${Math.round((s.altas / maxSerie) * 110)}px`, background: 'rgba(34,197,94,.7)', borderRadius: '3px 3px 0 0' }} />
                  <div style={{ width: 10, height: `${Math.round((s.bajas / maxSerie) * 110)}px`, background: 'rgba(239,68,68,.7)', borderRadius: '3px 3px 0 0' }} />
                </div>
                <div className="muted" style={{ fontSize: 10 }}>{MESES[s.mes]}</div>
              </div>
            ))}
          </div>
          <div className="row" style={{ gap: 16, marginTop: 6, fontSize: 12 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(34,197,94,.7)', borderRadius: 2, marginRight: 4 }} />Altas</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(239,68,68,.7)', borderRadius: 2, marginRight: 4 }} />Bajas</span>
          </div>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="card" style={{ flex: '1 1 320px' }}>
            <h4 style={{ marginTop: 0 }}>Distribución por antigüedad</h4>
            {data.distribAntiguedad.map((b) => (
              <div key={b.rango} className="row" style={{ alignItems: 'center', gap: 8, margin: '6px 0' }}>
                <span style={{ width: 70, fontSize: 13 }}>{b.rango}</span>
                <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((b.n / maxAntig) * 100)}%`, minWidth: b.n ? 18 : 0, background: 'rgba(61,127,255,.6)', height: 18 }} />
                </div>
                <b style={{ width: 30, textAlign: 'right' }}>{b.n}</b>
              </div>
            ))}
          </div>

          <div className="card" style={{ flex: '1 1 320px' }}>
            <h4 style={{ marginTop: 0 }}>Ausentismo por tipo <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(días, excl. vacaciones)</span></h4>
            {data.ausentismoPorTipo.length === 0
              ? <div className="muted" style={{ fontSize: 13 }}>Sin licencias registradas en el año.</div>
              : data.ausentismoPorTipo.map((a) => (
                <div key={a.tipo} className="row" style={{ alignItems: 'center', gap: 8, margin: '6px 0' }}>
                  <span style={{ width: 130, fontSize: 13, textTransform: 'capitalize' }}>{a.tipo}</span>
                  <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((a.dias / maxAus) * 100)}%`, minWidth: a.dias ? 18 : 0, background: 'rgba(234,179,8,.7)', height: 18 }} />
                  </div>
                  <b style={{ width: 42, textAlign: 'right' }}>{a.dias}</b>
                </div>
              ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <h4 style={{ marginTop: 0 }}>Dotación por empresa</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th style={{ textAlign: 'left', padding: '4px 8px' }}>Empresa</th><th style={{ textAlign: 'right', padding: '4px 8px' }}>Plantel activo</th></tr></thead>
            <tbody>{data.porEmpresa.map((e) => <tr key={e.empresa}><td style={{ padding: '4px 8px' }}>{e.empresa}</td><td style={{ textAlign: 'right', padding: '4px 8px' }}>{e.n}</td></tr>)}</tbody>
          </table>
        </div>
      </>}
    </>
  );
}
