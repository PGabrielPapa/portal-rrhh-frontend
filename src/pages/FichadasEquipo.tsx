import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  minToHhmm, DetalleDias, aprobBadge, calcLiquidable,
  type FichadaData, type EstadoAprob,
} from '../components/FichadasDetalle';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fmt = (d?: string) => d ? new Date(d).toLocaleString('es-AR') : '—';

interface Row {
  id: number; empleado_id: number; leg_num: string; nom: string; empresa: string;
  data: FichadaData; estado?: EstadoAprob;
  rrhh_por?: string; rrhh_at?: string; rrhh_obs?: string;
  ger_por?: string; ger_at?: string; ger_obs?: string;
}

export default function FichadasEquipo() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [expand, setExpand] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(''); setExpand(new Set());
    try {
      const r = await api.get<Row[]>(`/fichadas/equipo/${anio}/${mes}`);
      setRows(r); setLoaded(true);
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function toggle(id: number) {
    setExpand((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function resolver(r: Row, accion: 'aprobar' | 'rechazar') {
    setErr(''); setOk('');
    let obs: string | undefined;
    if (accion === 'rechazar') {
      const c = window.prompt(`Observación para devolver a RR.HH. la novedad de ${r.nom}:`, '');
      if (c == null) return;
      if (!c.trim()) { setErr('Para rechazar tenés que escribir un comentario.'); return; }
      obs = c.trim();
    }
    setBusy(true);
    try {
      await api.patch(`/fichadas/${r.id}/aprobacion`, { etapa: 'gerencia', accion, obs });
      setOk(accion === 'aprobar' ? `Autorizada la novedad de ${r.nom}.` : `Novedad de ${r.nom} devuelta a RR.HH.`);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function aprobarTodo() {
    const ids = visibles.filter((r) => r.estado === 'aprob_rrhh').map((r) => r.id);
    if (!ids.length) { setErr('No hay horas extra pendientes de autorizar.'); return; }
    if (!window.confirm(`Vas a autorizar las horas extra de ${ids.length} fichada(s). ¿Confirmás?`)) return;
    setErr(''); setOk(''); setBusy(true);
    try {
      const r = await api.post<{ actualizados: number }>(`/fichadas/${anio}/${mes}/aprobacion-masiva`, { etapa: 'gerencia', accion: 'aprobar', ids });
      setOk(`${r.actualizados} novedad(es) autorizadas.`);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  // El gerente solo ve fichadas que generaron horas extra netas.
  const conExtra = rows.filter((r) => calcLiquidable(r.data).extraLiquidable > 0);
  const visibles = soloPendientes ? conExtra.filter((r) => r.estado === 'aprob_rrhh') : conExtra;
  const pendientes = conExtra.filter((r) => r.estado === 'aprob_rrhh').length;
  const autorizadas = conExtra.filter((r) => r.estado === 'autorizada').length;

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 14 }}>
        Acá aparecen <b>solo las fichadas de tu equipo que generaron horas extra</b> y que <b>RR.HH. ya controló y aceptó</b>. Revisá el detalle día por día y <b>autorizá las horas extra</b> que estén OK; las autorizadas quedan listas para liquidar. Si algo no cierra, <b>devolvelo</b> a RR.HH. con un comentario. Las fichadas <b>sin horas extra</b> quedan firmes con RR.HH. y no necesitan tu autorización.
      </p>

      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {ok && <div className="ok" style={{ marginBottom: 12 }}>✓ {ok}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field"><label>Mes</label>
            <select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="field"><label>Año</label>
            <input className="input" type="number" style={{ width: 100 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
          </div>
          <button className="btn" onClick={load}>🔍 Consultar</button>
          <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
            Solo horas extra pendientes de autorizar
          </label>
          {loaded && pendientes > 0 && (
            <button className="btn" style={{ background: '#16a34a', marginLeft: 'auto' }} onClick={aprobarTodo} disabled={busy}>
              ✓ Autorizar todo lo visible ({pendientes})
            </button>
          )}
        </div>
      </div>

      {loaded && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
            <Stat n={pendientes} label="Esperando tu visto bueno" color={pendientes ? '#d97706' : undefined} />
            <Stat n={autorizadas} label="Autorizadas" color={autorizadas ? '#16a34a' : undefined} />
            <Stat n={rows.length} label={`Con horas extra (${MESES[mes - 1]} ${anio})`} />
          </div>
        </div>
      )}

      {loaded && (
        <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 16 }}>
          <table>
            <thead><tr><th style={{ width: 24 }}></th><th>Legajo</th><th>Empleado</th><th>Empresa</th><th>Estado</th><th style={{ textAlign: 'right' }}>Días</th><th style={{ textAlign: 'right' }}>A recuperar</th><th style={{ textAlign: 'right' }}>Extra neto</th><th style={{ textAlign: 'right' }}>Tard.</th><th style={{ textAlign: 'right' }}>Injustif.</th><th></th></tr></thead>
            <tbody>
              {visibles.map((r) => (
                <FilaEquipo key={r.empleado_id} r={r} abierto={expand.has(r.empleado_id)} onToggle={() => toggle(r.empleado_id)} onResolver={resolver} busy={busy} />
              ))}
              {!visibles.length && <tr><td colSpan={11} className="muted" style={{ textAlign: 'center', padding: 20 }}>{conExtra.length ? 'No hay horas extra pendientes de tu autorización.' : `Sin horas extra de tu equipo para ${MESES[mes - 1]} ${anio}. (RR.HH. todavía no aceptó fichadas con extra, o tu equipo no generó horas extra.)`}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FilaEquipo({ r, abierto, onToggle, onResolver, busy }: {
  r: Row; abierto: boolean; onToggle: () => void;
  onResolver: (r: Row, accion: 'aprobar' | 'rechazar') => void; busy: boolean;
}) {
  const d = r.data || {};
  const accionable = r.estado === 'aprob_rrhh';
  const { aRecuperar, extraLiquidable } = calcLiquidable(d);
  const inj = d.diasInjustificados || 0;
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td style={{ textAlign: 'center', color: '#888' }}>{abierto ? '▼' : '▸'}</td>
        <td className="muted">{r.leg_num}</td>
        <td>{r.nom}</td>
        <td className="muted">{r.empresa}</td>
        <td>{aprobBadge(r.estado)}</td>
        <td style={{ textAlign: 'right' }}>{d.diasTrabajados ?? 0}</td>
        <td style={{ textAlign: 'right', color: aRecuperar ? '#dc2626' : undefined, fontWeight: aRecuperar ? 600 : 400 }}>{aRecuperar ? minToHhmm(aRecuperar) : '—'}</td>
        <td style={{ textAlign: 'right', color: extraLiquidable > 0 ? '#16a34a' : undefined, fontWeight: 600 }}>{extraLiquidable > 0 ? minToHhmm(extraLiquidable) : '—'}</td>
        <td style={{ textAlign: 'right' }}>{minToHhmm(d.tardanzasMin || 0)}</td>
        <td style={{ textAlign: 'right', color: inj ? '#dc2626' : undefined, fontWeight: inj ? 600 : 400 }}>{inj || '—'}</td>
        <td style={{ textAlign: 'right' }}>
          {accionable && (
            <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button className="btn" style={{ background: '#16a34a' }} disabled={busy} onClick={(e) => { e.stopPropagation(); onResolver(r, 'aprobar'); }}>✓</button>
              <button className="btn danger" disabled={busy} onClick={(e) => { e.stopPropagation(); onResolver(r, 'rechazar'); }}>✗</button>
            </span>
          )}
        </td>
      </tr>
      {abierto && (
        <tr>
          <td colSpan={11} style={{ background: 'rgba(120,130,160,.06)', padding: '4px 10px 14px' }}>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center', margin: '8px 2px' }}>
              {r.rrhh_por && <span className="muted" style={{ fontSize: 13 }}>Aceptada por RR.HH. ({r.rrhh_por}) el {fmt(r.rrhh_at)}</span>}
              {r.ger_obs && <span style={{ fontSize: 13, color: '#dc2626' }}>Tu observación: {r.ger_obs}</span>}
              {r.estado === 'autorizada' && <span className="muted" style={{ fontSize: 13 }}>Autorizada por {r.ger_por} el {fmt(r.ger_at)}</span>}
              {accionable && (
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ background: '#16a34a' }} disabled={busy} onClick={(e) => { e.stopPropagation(); onResolver(r, 'aprobar'); }}>✓ Autorizar</button>
                  <button className="btn danger" disabled={busy} onClick={(e) => { e.stopPropagation(); onResolver(r, 'rechazar'); }}>✗ Devolver a RR.HH.</button>
                </span>
              )}
            </div>
            <DetalleDias d={d} nom={r.nom} gerente />
          </td>
        </tr>
      )}
    </>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 23, fontWeight: 700, color }}>{n}</div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}
