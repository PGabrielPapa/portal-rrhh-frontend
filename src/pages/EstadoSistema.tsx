import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Estado {
  ts: string;
  db: { ok: boolean; ms?: number; error?: string };
  backup: { ok: boolean; ultimo?: string; fecha?: string; cantidad?: number; auto?: boolean; mensaje?: string; error?: string };
  automatizaciones: {
    valoresLegales?: { ok: boolean; vigenciaDesde?: string; mensaje?: string; error?: string };
    ganancias?: { ok: boolean; periodo?: string; mensaje?: string; error?: string };
    escala?: { ok: boolean; vigencia?: string; mesLabel?: string; convenios?: number; mensaje?: string; error?: string };
  };
}
const fmt = (d?: string) => d ? new Date(d).toLocaleString('es-AR') : '—';
const fmtDia = (d?: string) => d ? new Date(d).toLocaleDateString('es-AR') : '—';

function Estado({ ok, txt }: { ok: boolean; txt: string }) {
  return <span className="badge" style={{ color: ok ? 'var(--green)' : 'var(--red)' }}>{ok ? '✓ ' : '⚠ '}{txt}</span>;
}

export default function EstadoSistema() {
  const [e, setE] = useState<Estado | null>(null);
  const [err, setErr] = useState('');
  const [cargando, setCargando] = useState(true);
  function load() { setCargando(true); api.get<Estado>('/admin/estado-sistema').then(setE).catch((x) => setErr(x.message)).finally(() => setCargando(false)); }
  useEffect(() => { load(); }, []);

  if (cargando) return <div className="muted">Cargando estado…</div>;
  if (err || !e) return <div className="err">⚠ No se pudo obtener el estado: {err || 'sin datos'}</div>;
  const a = e.automatizaciones;

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Estado de salud del backend, la base y las automatizaciones. Consultado: {fmt(e.ts)}.</p>
        <button className="btn ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={load}>↻ Actualizar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Servidor y base de datos</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Backend</span><Estado ok={true} txt="respondiendo" /></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Base de datos</span><Estado ok={e.db.ok} txt={e.db.ok ? `OK (${e.db.ms} ms)` : 'sin conexión'} /></div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Respaldos</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Último respaldo</span><Estado ok={!!e.backup.ok} txt={e.backup.ok ? fmt(e.backup.fecha) : (e.backup.mensaje || 'sin respaldos')} /></div>
            {e.backup.ok && <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Copias guardadas</span><span>{e.backup.cantidad}</span></div>}
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Automático diario</span><Estado ok={!!e.backup.auto} txt={e.backup.auto ? 'activado' : 'desactivado'} /></div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Valores legales</div>
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Vigentes desde</span><Estado ok={!!a.valoresLegales?.ok} txt={a.valoresLegales?.ok ? fmtDia(a.valoresLegales.vigenciaDesde) : (a.valoresLegales?.mensaje || 'sin datos')} /></div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Impuesto a las Ganancias</div>
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Tabla vigente</span><Estado ok={!!a.ganancias?.ok} txt={a.ganancias?.ok ? (a.ganancias.periodo || 'vigente') : (a.ganancias?.mensaje || 'sin datos')} /></div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Escala salarial unificada</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Vigente</span><Estado ok={!!a.escala?.ok} txt={a.escala?.ok ? (a.escala.mesLabel || fmtDia(a.escala.vigencia)) : (a.escala?.mensaje || 'sin datos')} /></div>
            {a.escala?.ok && <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Convenios vigentes</span><span>{a.escala.convenios}</span></div>}
          </div>
        </div>
      </div>
    </>
  );
}
