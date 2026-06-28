import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { minToHhmm, DetalleDias, aprobBadge, calcLiquidable, type FichadaData, type EstadoAprob } from './FichadasDetalle';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface Periodo { id: number; anio: number; mes: number; data: FichadaData; estado?: EstadoAprob; rrhh_at?: string; ger_at?: string; }

function Stat({ n, label, color }: { n: string; label: string; color?: string }) {
  return <div><div style={{ fontSize: 20, fontWeight: 700, color }}>{n}</div><div className="muted" style={{ fontSize: 11 }}>{label}</div></div>;
}

export default function MisFichadas({ nom, mostrarVacio }: { nom?: string; mostrarVacio?: boolean }) {
  const [row, setRow] = useState<Periodo | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get<Periodo | null>('/fichadas/mias/ultima')
      .then((r) => setRow(r))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  if (!row) {
    if (!mostrarVacio) return null;
    return (
      <div className="card" style={{ marginBottom: 22 }}>
        <h4 style={{ margin: 0 }}>🕒 Mis fichadas</h4>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Todavía no hay fichadas cargadas para tu legajo. Cuando RR.HH. importe el reloj, las vas a ver acá.</div>
      </div>
    );
  }

  const d = row.data || {};
  const { extraLiquidable, aRecuperar } = calcLiquidable(d);
  const inj = d.diasInjustificados || 0;

  return (
    <div className="card" style={{ marginBottom: 22 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h4 style={{ margin: 0 }}>🕒 Mis fichadas — {MESES[row.mes - 1]} {row.anio}</h4>
        {aprobBadge(row.estado)}
      </div>
      <div className="row" style={{ gap: 20, flexWrap: 'wrap', margin: '12px 0 6px' }}>
        <Stat n={String(d.diasTrabajados ?? 0)} label="Días trabajados" />
        <Stat n={minToHhmm(d.tardanzasMin || 0)} label="Llegadas tarde" color={d.tardanzasMin ? '#d97706' : undefined} />
        <Stat n={minToHhmm(extraLiquidable)} label="Horas extra" color={extraLiquidable > 0 ? '#16a34a' : undefined} />
        <Stat n={aRecuperar ? minToHhmm(aRecuperar) : '—'} label="A recuperar" color={aRecuperar ? '#dc2626' : undefined} />
        <Stat n={String(inj)} label="Faltas injustificadas" color={inj ? '#dc2626' : undefined} />
      </div>
      <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setAbierto((a) => !a)}>
        {abierto ? 'Ocultar detalle' : 'Ver detalle día por día'}
      </button>
      {abierto && <div style={{ marginTop: 10 }}><DetalleDias d={d} nom={nom || 'Mis fichadas'} /></div>}
    </div>
  );
}
