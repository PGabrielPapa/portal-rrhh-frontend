import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Dash {
  siniestrosTotal: number; siniestrosAbiertos: number; siniestrosPorTipo: { tipo: string; n: number }[]; siniestrosPorMes: { mes: string; n: number }[];
  ncAbiertas: number; ncCerradas: number;
  medVencidas: number; medPorVencer: number; medVigentes: number; medProximas: { tipo: string; fecha_vencimiento: string }[];
  audTotal: number; audAbiertas: number; accionesPendientes: number; cartReponer: number; evidencias: number; minutas: number;
}
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const mesLbl = (m: string) => { const p = m.split('-'); return p[1] ? `${MESES[Number(p[1]) - 1]} ${p[0].slice(2)}` : m; };

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || 'var(--t1)' }}>{value}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function ChsDashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get<Dash>('/chs/dashboard').then(setD).catch((e: any) => setErr(e.message)); }, []);
  if (err) return <div className="err">⚠ {err}</div>;
  if (!d) return <div className="muted">Cargando indicadores…</div>;

  const maxMes = Math.max(1, ...(d.siniestrosPorMes || []).map((x) => x.n));
  const ncTotal = d.ncAbiertas + d.ncCerradas;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <Stat label="Siniestros (total)" value={d.siniestrosTotal} />
        <Stat label="Siniestros abiertos" value={d.siniestrosAbiertos} color={d.siniestrosAbiertos ? 'var(--red)' : 'var(--green)'} />
        <Stat label="Acciones pendientes" value={d.accionesPendientes} color={d.accionesPendientes ? 'var(--yellow)' : 'var(--green)'} />
        <Stat label="Mediciones vencidas" value={d.medVencidas} color={d.medVencidas ? 'var(--red)' : 'var(--green)'} />
        <Stat label="Mediciones por vencer" value={d.medPorVencer} color={d.medPorVencer ? 'var(--yellow)' : 'var(--green)'} />
        <Stat label="No conformidades abiertas" value={d.ncAbiertas} color={d.ncAbiertas ? 'var(--yellow)' : 'var(--green)'} />
        <Stat label="Auditorías abiertas" value={`${d.audAbiertas}/${d.audTotal}`} />
        <Stat label="Cartelería a reponer" value={d.cartReponer} color={d.cartReponer ? 'var(--red)' : 'var(--green)'} />
      </div>

      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Siniestros / incidentes por mes (12 meses)</h4>
          {!(d.siniestrosPorMes || []).length ? <div className="muted">Sin datos.</div> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, marginTop: 10 }}>
              {d.siniestrosPorMes.map((x) => (
                <div key={x.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 11 }}>{x.n}</div>
                  <div title={`${x.mes}: ${x.n}`} style={{ width: '70%', height: `${(x.n / maxMes) * 100}px`, minHeight: x.n ? 4 : 0, background: 'var(--accent2)', borderRadius: 3 }} />
                  <div className="muted" style={{ fontSize: 10 }}>{mesLbl(x.mes)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0 }}>Siniestros por clasificación</h4>
          {!(d.siniestrosPorTipo || []).length ? <div className="muted">Sin datos.</div> : (
            <div style={{ marginTop: 8 }}>
              {d.siniestrosPorTipo.map((x) => (
                <div key={x.tipo} className="row" style={{ gap: 8, marginBottom: 6, fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{x.tipo}</span>
                  <div style={{ flex: 2, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(x.n / Math.max(1, d.siniestrosTotal)) * 100}%`, background: 'var(--red)', height: 14 }} />
                  </div>
                  <span style={{ width: 24, textAlign: 'right' }}>{x.n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0 }}>No conformidades: abiertas vs. cerradas</h4>
          <div className="row" style={{ gap: 16, marginTop: 8 }}>
            <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--yellow)' }}>{d.ncAbiertas}</div><div className="muted" style={{ fontSize: 12 }}>Abiertas</div></div>
            <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>{d.ncCerradas}</div><div className="muted" style={{ fontSize: 12 }}>Cerradas</div></div>
          </div>
          {ncTotal > 0 && <div style={{ marginTop: 10, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}><div style={{ width: `${(d.ncCerradas / ncTotal) * 100}%`, background: 'var(--green)', height: 12 }} /><div style={{ flex: 1, background: 'var(--yellow)', height: 12 }} /></div>}
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0 }}>Mediciones próximas a vencer / vencidas</h4>
          {!(d.medProximas || []).length ? <div className="muted">Ninguna en los próximos 30 días.</div> : (
            <div style={{ marginTop: 6 }}>
              {d.medProximas.map((m, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>{m.tipo || 'Medición'} <span className="muted">· vence {fmt(m.fecha_vencimiento)}</span></div>)}
            </div>
          )}
        </div>
      </div>

      <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>Indicadores del Comité de HyS · Minutas registradas: {d.minutas} · Evidencias de mejora: {d.evidencias}</p>
    </>
  );
}
