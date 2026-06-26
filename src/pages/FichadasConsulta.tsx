import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';
import {
  minToHhmm, DetalleDias, aprobBadge, calcLiquidable,
  type FichadaData, type EstadoAprob,
} from '../components/FichadasDetalle';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fmt = (d?: string) => d ? new Date(d).toLocaleString('es-AR') : '—';

interface Row {
  id: number; empleado_id: number; leg_num: string; nom: string; empresa: string;
  data: FichadaData; importado_por?: string; updated_at?: string;
  estado?: EstadoAprob; responsable?: string | null;
  rrhh_por?: string; rrhh_at?: string; rrhh_obs?: string;
  ger_por?: string; ger_at?: string; ger_obs?: string;
}
interface ImportLog {
  id: number; anio: number; mes: number; archivo?: string; filas: number; legajos: number;
  matcheados: number; sin_match: number; importado_por?: string; created_at?: string;
}
type Filtro = 'todos' | 'revisar' | 'injustificado' | 'conflicto' | 'pendientes' | 'observadas' | 'autorizadas';

export default function FichadasConsulta() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [log, setLog] = useState<ImportLog[]>([]);
  const [expand, setExpand] = useState<Set<number>>(new Set());
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [bajando, setBajando] = useState<'xlsx' | 'pdf' | null>(null);

  async function load() {
    setErr(''); setExpand(new Set());
    try {
      const r = await api.get<Row[]>(`/fichadas/${anio}/${mes}`);
      setRows(r); setLoaded(true);
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { api.get<ImportLog[]>('/fichadas/importaciones/log').then(setLog).catch(() => {}); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function toggle(id: number) {
    setExpand((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function descargar(formato: 'xlsx' | 'pdf') {
    setErr(''); setBajando(formato);
    try {
      const blob = await fetchBlob(`/fichadas/${anio}/${mes}/export?formato=${formato}${empresaFiltro ? `&empresa=${encodeURIComponent(empresaFiltro)}` : ''}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Fichadas_${anio}-${String(mes).padStart(2, '0')}${empresaFiltro ? '_' + empresaFiltro.replace(/[^\w]+/g, '') : ''}.${formato}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) { setErr(e.message || 'No se pudo generar la descarga.'); }
    finally { setBajando(null); }
  }

  // Aprobar / rechazar una novedad (etapa RR.HH.).
  async function resolver(r: Row, accion: 'aprobar' | 'rechazar') {
    setErr(''); setOk('');
    let obs: string | undefined;
    if (accion === 'rechazar') {
      const c = window.prompt(`Observación para devolver la novedad de ${r.nom}:`, r.rrhh_obs || '');
      if (c == null) return;            // canceló
      if (!c.trim()) { setErr('Para rechazar tenés que escribir un comentario.'); return; }
      obs = c.trim();
    }
    setBusy(true);
    try {
      await api.patch(`/fichadas/${r.id}/aprobacion`, { etapa: 'rrhh', accion, obs });
      setOk(accion === 'aprobar' ? `Aceptada la novedad de ${r.nom}; pasa a ${r.responsable || 'su responsable directo'}.` : `Novedad de ${r.nom} devuelta con observación.`);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  // Aprobar en bloque todas las novedades visibles que estén pendientes/observadas.
  async function aprobarTodo() {
    const ids = visibles.filter((r) => r.estado === 'pendiente' || r.estado === 'observada').map((r) => r.id);
    if (!ids.length) { setErr('No hay novedades pendientes en la vista actual.'); return; }
    if (!window.confirm(`Vas a aceptar ${ids.length} novedad(es). Cada una pasará a su responsable directo. ¿Confirmás?`)) return;
    setErr(''); setOk(''); setBusy(true);
    try {
      const r = await api.post<{ actualizados: number }>(`/fichadas/${anio}/${mes}/aprobacion-masiva`, { etapa: 'rrhh', accion: 'aprobar', ids });
      setOk(`${r.actualizados} novedad(es) aceptadas y enviadas al 2º control.`);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  // Empresas presentes en el período (para el filtro de control).
  const empresas = [...new Set(rows.map((r) => r.empresa).filter(Boolean))].sort();
  // Alcance por empresa: acota tabla y totales a la empresa elegida.
  const baseRows = empresaFiltro ? rows.filter((r) => r.empresa === empresaFiltro) : rows;

  const visibles = baseRows.filter((r) => {
    if (filtro === 'revisar') return (r.data.diasARevisar?.length || 0) > 0;
    if (filtro === 'injustificado') return (r.data.diasInjustificados || 0) > 0;
    if (filtro === 'conflicto') return (r.data.diasLicenciaConflicto || 0) > 0;
    if (filtro === 'pendientes') return r.estado === 'pendiente' || r.estado === 'observada';
    if (filtro === 'observadas') return r.estado === 'observada';
    if (filtro === 'autorizadas') return r.estado === 'autorizada';
    return true;
  });
  const tot = baseRows.reduce((acc, r) => {
    acc.dias += r.data.diasTrabajados || 0;
    acc.rev += (r.data.diasARevisar?.length || 0);
    acc.lic += (r.data.diasLicencia || 0);
    acc.inj += (r.data.diasInjustificados || 0);
    acc.conf += (r.data.diasLicenciaConflicto || 0);
    if (r.estado === 'pendiente' || r.estado === 'observada') acc.pend += 1;
    if (r.estado === 'autorizada') acc.autoriz += 1;
    return acc;
  }, { dias: 0, rev: 0, lic: 0, inj: 0, conf: 0, pend: 0, autoriz: 0 });

  const pendientesVisibles = visibles.filter((r) => r.estado === 'pendiente' || r.estado === 'observada').length;

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 14 }}>
        Hacé clic en un empleado para ver el <b>detalle día por día</b>. Cuando las novedades están OK, <b>aceptalas</b>: cada una pasa al <b>responsable directo</b> (según el organigrama) para el 2º control. Solo las <b>autorizadas</b> quedan listas para liquidar. Lo que se autoriza/liquida son las <b>horas extra</b> y el <b>tiempo en contra (a recuperar)</b>; las <b>horas a favor</b> son solo de control y no se liquidan. Para cargar un período usá <b>Importar fichadas</b>.
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
          {loaded && empresas.length > 1 && (
            <div className="field"><label>Empresa</label>
              <select className="input" value={empresaFiltro} onChange={(e) => { setEmpresaFiltro(e.target.value); setExpand(new Set()); }}>
                <option value="">Todas</option>
                {empresas.map((em) => <option key={em} value={em}>{em}</option>)}
              </select>
            </div>
          )}
          {loaded && rows.length > 0 && (
            <div className="field"><label>Filtro</label>
              <select className="input" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
                <option value="todos">Todos</option>
                <option value="pendientes">Pendientes de aceptar</option>
                <option value="observadas">Observadas</option>
                <option value="autorizadas">Autorizadas</option>
                <option value="revisar">Con días a revisar</option>
                <option value="injustificado">Con injustificados</option>
                <option value="conflicto">Con conflicto de licencia</option>
              </select>
            </div>
          )}
          {loaded && rows.length > 0 && (
            <div className="row" style={{ gap: 8, marginLeft: 'auto', alignItems: 'flex-end' }}>
              {pendientesVisibles > 0 && (
                <button className="btn" style={{ background: '#16a34a' }} onClick={aprobarTodo} disabled={busy}>
                  ✓ Aprobar todo lo visible ({pendientesVisibles})
                </button>
              )}
              <button className="btn" onClick={() => descargar('xlsx')} disabled={!!bajando}>{bajando === 'xlsx' ? '…' : '⬇ Excel'}</button>
              <button className="btn" onClick={() => descargar('pdf')} disabled={!!bajando}>{bajando === 'pdf' ? '…' : '⬇ PDF'}</button>
            </div>
          )}
        </div>
      </div>

      {loaded && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
            <Stat n={baseRows.length} label={`Empleados${empresaFiltro ? ` · ${empresaFiltro}` : ''} (${MESES[mes - 1]} ${anio})`} />
            <Stat n={tot.pend} label="Pendientes de aceptar" color={tot.pend ? '#d97706' : undefined} />
            <Stat n={tot.autoriz} label="Autorizadas" color={tot.autoriz ? '#16a34a' : undefined} />
            <Stat n={tot.dias} label="Días trabajados" />
            <Stat n={tot.lic} label="Días licencia" />
            <Stat n={tot.rev} label="A revisar" color={tot.rev ? '#d97706' : undefined} />
            <Stat n={tot.inj} label="Injustificados" color={tot.inj ? '#dc2626' : undefined} />
            <Stat n={tot.conf} label="Conflicto licencia" color={tot.conf ? '#dc2626' : undefined} />
          </div>
        </div>
      )}

      {loaded && (
        <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 16 }}>
          <table>
            <thead><tr><th style={{ width: 24 }}></th><th>Legajo</th><th>Empleado</th><th>Empresa</th><th>Aprobación</th><th style={{ textAlign: 'right' }}>Días trab.</th><th style={{ textAlign: 'right' }}>Banco mes</th><th style={{ textAlign: 'right' }}>Extra neto</th><th style={{ textAlign: 'right' }}>Tard.</th><th style={{ textAlign: 'right' }}>Lic.</th><th style={{ textAlign: 'right' }}>Revisar</th><th style={{ textAlign: 'right' }}>Injustif.</th><th style={{ textAlign: 'right' }}>Conflic.</th></tr></thead>
            <tbody>
              {visibles.map((r) => (
                <FilaEmpleado key={r.empleado_id} r={r} abierto={expand.has(r.empleado_id)} onToggle={() => toggle(r.empleado_id)} onResolver={resolver} busy={busy} />
              ))}
              {!visibles.length && <tr><td colSpan={13} className="muted" style={{ textAlign: 'center', padding: 20 }}>{rows.length ? 'Ningún empleado coincide con el filtro.' : `No hay fichadas importadas para ${MESES[mes - 1]} ${anio}.`}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <h3 style={{ margin: '12px 16px' }}>Historial de importaciones</h3>
        <table>
          <thead><tr><th>Período</th><th style={{ textAlign: 'right' }}>Filas</th><th style={{ textAlign: 'right' }}>Legajos</th><th style={{ textAlign: 'right' }}>Cruzaron</th><th style={{ textAlign: 'right' }}>Sin match</th><th>Archivo</th><th>Importado por</th><th>Fecha</th></tr></thead>
          <tbody>
            {log.map((l) => (
              <tr key={l.id}>
                <td>{MESES[l.mes - 1]} {l.anio}</td>
                <td style={{ textAlign: 'right' }}>{l.filas}</td>
                <td style={{ textAlign: 'right' }}>{l.legajos}</td>
                <td style={{ textAlign: 'right', color: '#16a34a' }}>{l.matcheados}</td>
                <td style={{ textAlign: 'right', color: l.sin_match ? '#dc2626' : undefined }}>{l.sin_match}</td>
                <td className="muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.archivo || '—'}</td>
                <td className="muted">{l.importado_por || '—'}</td>
                <td className="muted">{fmt(l.created_at)}</td>
              </tr>
            ))}
            {!log.length && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 20 }}>Todavía no se importó ningún período.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FilaEmpleado({ r, abierto, onToggle, onResolver, busy }: {
  r: Row; abierto: boolean; onToggle: () => void;
  onResolver: (r: Row, accion: 'aprobar' | 'rechazar') => void; busy: boolean;
}) {
  const d = r.data || {};
  const nRev = d.diasARevisar?.length || 0;
  const nInj = d.diasInjustificados || 0;
  const nConf = d.diasLicenciaConflicto || 0;
  const { extraLiquidable } = calcLiquidable(d);
  const aceptable = r.estado === 'pendiente' || r.estado === 'observada';
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td style={{ textAlign: 'center', color: '#888' }}>{abierto ? '▼' : '▸'}</td>
        <td className="muted">{r.leg_num}</td>
        <td>{r.nom}</td>
        <td className="muted">{r.empresa}</td>
        <td>{aprobBadge(r.estado)}</td>
        <td style={{ textAlign: 'right' }}>{d.diasTrabajados ?? 0}</td>
        <td style={{ textAlign: 'right', color: (d.bancoNetoMin || 0) < 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{minToHhmm(d.bancoNetoMin || 0)}</td>
        <td style={{ textAlign: 'right', color: extraLiquidable > 0 ? '#16a34a' : undefined, fontWeight: 600 }}>{extraLiquidable > 0 ? minToHhmm(extraLiquidable) : '—'}</td>
        <td style={{ textAlign: 'right' }}>{minToHhmm(d.tardanzasMin || 0)}{d.diasTardanza ? <span className="muted"> ({d.diasTardanza})</span> : null}</td>
        <td style={{ textAlign: 'right' }} className="muted">{d.diasLicencia || '—'}</td>
        <td style={{ textAlign: 'right', color: nRev ? '#d97706' : undefined }}>{nRev || '—'}</td>
        <td style={{ textAlign: 'right', color: nInj ? '#dc2626' : undefined, fontWeight: nInj ? 600 : 400 }}>{nInj || '—'}</td>
        <td style={{ textAlign: 'right', color: nConf ? '#dc2626' : undefined, fontWeight: nConf ? 600 : 400 }}>{nConf || '—'}</td>
      </tr>
      {abierto && (
        <tr>
          <td colSpan={13} style={{ background: 'rgba(120,130,160,.06)', padding: '4px 10px 14px' }}>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center', margin: '8px 2px' }}>
              <span className="muted" style={{ fontSize: 13 }}>2º control: <b>{r.responsable || 'CEO / Admin'}</b></span>
              {r.rrhh_obs && <span style={{ fontSize: 13, color: '#dc2626' }}>Obs. RR.HH.: {r.rrhh_obs}</span>}
              {r.ger_obs && <span style={{ fontSize: 13, color: '#dc2626' }}>Obs. gerente: {r.ger_obs}</span>}
              {r.ger_por && r.estado === 'autorizada' && <span className="muted" style={{ fontSize: 13 }}>Autorizada por {r.ger_por}</span>}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {aceptable && <button className="btn" style={{ background: '#16a34a' }} disabled={busy} onClick={(e) => { e.stopPropagation(); onResolver(r, 'aprobar'); }}>✓ Aceptar</button>}
                {aceptable && <button className="btn danger" disabled={busy} onClick={(e) => { e.stopPropagation(); onResolver(r, 'rechazar'); }}>✗ Observar</button>}
              </span>
            </div>
            <DetalleDias d={d} nom={r.nom} />
          </td>
        </tr>
      )}
    </>
  );
}

function Stat({ n, txt, label, color }: { n?: number; txt?: string; label: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 23, fontWeight: 700, color }}>{txt ?? n}</div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}
