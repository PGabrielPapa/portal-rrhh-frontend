import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import FichadasEquipo from './FichadasEquipo';

interface Aus { nom: string; tipo: string; desde: string; hasta: string; }
interface Rk { nom: string; min: number; }
interface Tarde { nom: string; fecha: string | null; dia: string | null; entrada: string | null; min: number; }
interface Cumple { nom: string; fecha: string; dias: number; edad: number | null; }
interface Aniv { nom: string; fecha: string; dias: number; anios: number; }
interface Prueba { nom: string; dias: number; hito: number; }
interface Dash {
  periodo: { anio: number; mes: number };
  sinEquipo?: boolean;
  kpi: { dotacion: number; masaBruta: number; costoLaboral: number; contribPct: number; antiguedadProm: number; edadProm: number };
  pendientes: { adelantos: number; fichadas: number; licencias: number; evaluaciones: number; anualAbierto: boolean };
  asistencia: { ausentesHoy: Aus[]; ausentismoDias: number };
  puntualidad: { tardanzasCasos: number; tardanzasMin: number; ranking: Rk[]; detalle: Tarde[] };
  extra: { totalMin: number; ranking: Rk[] };
  avisos: { cumple: Cumple[]; aniversarios: Aniv[]; prueba: Prueba[] };
  evolucion: { anio: number; mes: number; neto: number }[];
}
interface Ausente { nom: string; empresa: string; justificacion: string | null; }
interface DetT { nom: string; fecha: string; dia: string | null; entrada: string | null; min: number; }
interface Reloj {
  fecha: string;
  fichadas: { total: number; ficharon: number; ausentes: number; injustificados: number };
  ausentes: Ausente[];
  tardanzas: { casos: number; totalMin: number; ranking: { nom: string; min: number }[]; detalle: DetT[] };
}

const TOPE_EXAMEN = 20; // Tope anual de licencia por examen/estudio (grupo LEITEN-SINIS-BARTON-IDEE).
interface SaldoLic { id: number; nom: string; legNum: string; antiguedad: number; corresponden: number; tomados: number; saldoEsteAnio: number; saldoAnteriores: number; disponible: number; pendientes: number; aprobadasAnio: number; examenAnio: number; examenTope: number; }
const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const $ = (n: number) => '$ ' + (n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
const hm = (min: number) => { const h = Math.floor((min || 0) / 60); const m = Math.round((min || 0) % 60); return h ? `${h} h ${m} min` : `${m} min`; };

function Card({ t, v, sub }: { t: string; v: string; sub?: string }) {
  return (
    <div className="card" style={{ flex: '1 1 160px', minWidth: 160 }}>
      <div className="muted" style={{ fontSize: 12 }}>{t}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{v}</div>
      {sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

function Pend({ t, n, ico, onClick }: { t: string; n: number; ico: string; onClick: () => void }) {
  const activo = n > 0;
  return (
    <div className="card" onClick={onClick} title="Ir al módulo"
      style={{ flex: '1 1 150px', minWidth: 150, cursor: 'pointer', borderColor: activo ? 'var(--yellow)' : undefined }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 22 }}>{ico}</span>
        <span style={{ fontSize: 28, fontWeight: 800, color: activo ? 'var(--yellow)' : 'var(--t3)' }}>{n}</span>
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t}</div>
    </div>
  );
}

export default function TableroGerente() {
  const nav = useNavigate();
  const d = new Date();
  const [anio, setAnio] = useState(d.getFullYear());
  const [mes, setMes] = useState(d.getMonth() + 1);
  const [data, setData] = useState<Dash | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloj, setReloj] = useState<Reloj | null>(null);
  const [relojErr, setRelojErr] = useState('');
  const [verAutorizar, setVerAutorizar] = useState(false);
  const [saldos, setSaldos] = useState<SaldoLic[]>([]);

  // Datos del reloj EN VIVO (equipo): fichadas de hoy, ausentes y tardanzas del mes.
  useEffect(() => {
    setRelojErr(''); setReloj(null);
    api.get<Reloj>(`/prosoft/tablero?scope=equipo&anio=${anio}&mes=${mes}`).then(setReloj).catch((e) => setRelojErr(e.message));
  }, [anio, mes]);

  useEffect(() => { api.get<SaldoLic[]>('/licencias/equipo-saldos').then(setSaldos).catch(() => setSaldos([])); }, []);

  async function cargar() {
    setErr(''); setBusy(true);
    try { setData(await api.get<Dash>(`/dashboard/gerente?anio=${anio}&mes=${mes}`)); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [anio, mes]);

  const maxEvo = data?.evolucion?.length ? Math.max(1, ...data.evolucion.map((e) => e.neto)) : 1;

  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
        <div className="field"><label>Año</label><input className="input" style={{ width: 100 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
        {busy && <span className="muted" style={{ fontSize: 12 }}>Cargando…</span>}
      </div>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}

      {data?.sinEquipo && <div className="card muted">No tenés personal a cargo según el organigrama, así que todavía no hay datos para mostrar.</div>}

      {data && !data.sinEquipo && <>
        {/* KPIs */}
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <Card t="Personal a cargo" v={String(data.kpi.dotacion)} />
          <Card t="Costo laboral del mes" v={$(data.kpi.costoLaboral)} sub={`+${data.kpi.contribPct}% contribuciones`} />
          <Card t="Masa salarial bruta" v={$(data.kpi.masaBruta)} />
          <Card t="Antigüedad promedio" v={`${data.kpi.antiguedadProm} años`} />
          <Card t="Edad promedio" v={data.kpi.edadProm ? `${data.kpi.edadProm} años` : '—'} />
        </div>

        {/* Pendientes */}
        <h4 style={{ margin: '4px 0 8px' }}>Qué requiere tu atención</h4>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <Pend t="Adelantos para recomendar" n={data.pendientes.adelantos} ico="💸" onClick={() => nav('/m/aprobaciones')} />
          <Pend t="Fichadas para autorizar" n={data.pendientes.fichadas} ico="🕒" onClick={() => setVerAutorizar((v) => !v)} />
          <Pend t="Licencias para aprobar" n={data.pendientes.licencias} ico="🏖" onClick={() => nav('/m/licencias-equipo')} />
          <Pend t={data.pendientes.anualAbierto ? 'Evaluaciones (período abierto)' : 'Evaluaciones de prueba'} n={data.pendientes.evaluaciones} ico="📈" onClick={() => nav('/m/evaluaciones-equipo')} />
        </div>

        {/* Fichadas para autorizar (enviadas por RR.HH.) — desplegable dentro del tablero */}
        <div style={{ marginBottom: 12 }}>
          <button className="btn" onClick={() => setVerAutorizar((v) => !v)}>
            {verAutorizar ? '▲ Ocultar' : '▼ Ver'} fichadas para autorizar{data.pendientes.fichadas ? ` (${data.pendientes.fichadas})` : ''}
          </button>
        </div>
        {verAutorizar && (
          <div className="card" style={{ marginBottom: 18 }}>
            <h4 style={{ marginTop: 0 }}>Fichadas para autorizar — enviadas por RR.HH.</h4>
            <FichadasEquipo />
          </div>
        )}

        {/* Reloj EN VIVO: fichadas de hoy, ausentes de hoy (con justificación) y tardanzas del mes */}
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 18 }}>
          <div className="card" style={{ flex: '1 1 260px' }}>
            <h4 style={{ marginTop: 0 }}>Fichadas de hoy {reloj && <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({reloj.fichadas.ficharon}/{reloj.fichadas.total})</span>}</h4>
            {relojErr ? <div className="muted" style={{ fontSize: 13 }}>No se pudo traer del reloj: {relojErr}</div>
              : !reloj ? <div className="muted" style={{ fontSize: 13 }}>Cargando…</div>
                : <div className="row" style={{ gap: 18 }}>
                    <div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>{reloj.fichadas.ficharon}</div><div className="muted" style={{ fontSize: 11 }}>ficharon</div></div>
                    <div><div style={{ fontSize: 24, fontWeight: 700, color: reloj.fichadas.injustificados ? 'var(--red)' : undefined }}>{reloj.fichadas.injustificados}</div><div className="muted" style={{ fontSize: 11 }}>sin fichar</div></div>
                    <div><div style={{ fontSize: 24, fontWeight: 700 }}>{reloj.fichadas.total}</div><div className="muted" style={{ fontSize: 11 }}>del equipo</div></div>
                  </div>}
          </div>
          <div className="card" style={{ flex: '1 1 300px' }}>
            <h4 style={{ marginTop: 0 }}>Ausentes hoy {reloj && <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({reloj.ausentes.length})</span>}</h4>
            {relojErr ? <div className="muted" style={{ fontSize: 13 }}>—</div>
              : !reloj ? <div className="muted" style={{ fontSize: 13 }}>Cargando…</div>
                : reloj.ausentes.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>Nadie sin fichar hoy 👍</div>
                  : <div style={{ maxHeight: 260, overflow: 'auto' }}>
                      {reloj.ausentes.map((a, i) => (
                        <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '3px 0', borderTop: i ? '1px solid var(--border)' : undefined }}>
                          <span>{a.nom}</span>
                          {a.justificacion
                            ? <span style={{ color: '#2563eb' }}>{a.justificacion}</span>
                            : <span style={{ color: 'var(--red)', fontWeight: 600 }}>injustificado</span>}
                        </div>))}
                    </div>}
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>No fichó en día laborable. Con licencia o justificación cargada, muestra el motivo.</div>
          </div>
          <div className="card" style={{ flex: '1 1 320px' }}>
            <h4 style={{ marginTop: 0 }}>Llegadas tarde del mes {reloj && <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(acumulado)</span>}</h4>
            {relojErr ? <div className="muted" style={{ fontSize: 13 }}>—</div>
              : !reloj ? <div className="muted" style={{ fontSize: 13 }}>Cargando…</div>
                : <>
                    <div className="row" style={{ gap: 16, marginBottom: 8 }}>
                      <div><div style={{ fontSize: 22, fontWeight: 700 }}>{reloj.tardanzas.casos}</div><div className="muted" style={{ fontSize: 11 }}>empleados con tardanzas</div></div>
                      <div><div style={{ fontSize: 22, fontWeight: 700 }}>{hm(reloj.tardanzas.totalMin)}</div><div className="muted" style={{ fontSize: 11 }}>acumulado del equipo</div></div>
                    </div>
                    {reloj.tardanzas.detalle.length === 0
                      ? <div className="muted" style={{ fontSize: 13 }}>Sin tardanzas en el mes.</div>
                      : <div style={{ maxHeight: 260, overflow: 'auto' }}>
                          {reloj.tardanzas.detalle.map((t, i) => (
                            <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '3px 0', borderTop: i ? '1px solid var(--border)' : undefined }}>
                              <span>{t.nom} <span className="muted">· {[t.dia, t.fecha].filter(Boolean).join(' ')}{t.entrada ? ' · ingresó ' + t.entrada : ''}</span></span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--yellow)' }}>{hm(t.min)}</span>
                            </div>))}
                        </div>}
                  </>}
          </div>
        </div>

        {/* Horas extra + Evolución */}
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 18 }}>
          <div className="card" style={{ flex: '1 1 300px' }}>
            <h4 style={{ marginTop: 0 }}>Horas extras del mes <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({hm(data.extra.totalMin)})</span></h4>
            {data.extra.ranking.map((r, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}>
                <span>{r.nom}</span><span className="muted" style={{ fontFamily: 'var(--font-mono)' }}>{hm(r.min)}</span>
              </div>))}
            {data.extra.ranking.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Sin horas extra liquidables.</div>}
          </div>
          <div className="card" style={{ flex: '1 1 340px' }}>
            <h4 style={{ marginTop: 0 }}>Evolución del costo (neto liquidado)</h4>
            <div className="row" style={{ gap: 6, alignItems: 'flex-end', height: 120 }}>
              {data.evolucion.map((e, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div title={$(e.neto)} style={{ width: '70%', height: `${Math.max(2, (e.neto / maxEvo) * 100)}%`, background: 'var(--green)', borderRadius: '4px 4px 0 0', minHeight: 2 }} />
                  <div className="muted" style={{ fontSize: 10 }}>{MESES[e.mes]}</div>
                </div>))}
            </div>
          </div>
        </div>

        {/* Licencias del equipo — saldos */}
        <div className="card" style={{ marginBottom: 18, padding: 0, overflow: 'auto' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ margin: 0 }}>🏖 Licencias del equipo — saldos de vacaciones</h4>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Días por antigüedad (Art. 150 LCT), tomados en el año y saldo disponible. Incluye saldo de los 2 años anteriores. «Pend.» = solicitudes pendientes de aprobar.</div>
          </div>
          <table>
            <thead><tr><th>Empleado</th><th style={{ textAlign: 'center' }}>Antig.</th><th style={{ textAlign: 'center' }}>Corresponden</th><th style={{ textAlign: 'center' }}>Tomados {new Date().getFullYear()}</th><th style={{ textAlign: 'center' }}>Saldo año</th><th style={{ textAlign: 'center' }}>Saldo ant.</th><th style={{ textAlign: 'center' }}>Disponible</th><th style={{ textAlign: 'center' }}>Pend.</th></tr></thead>
            <tbody>
              {saldos.map((s) => (
                <tr key={s.id}>
                  <td>{s.nom} <span className="muted">({s.legNum})</span></td>
                  <td style={{ textAlign: 'center' }}>{s.antiguedad} a</td>
                  <td style={{ textAlign: 'center' }}>{s.corresponden}</td>
                  <td style={{ textAlign: 'center' }}>{s.tomados}</td>
                  <td style={{ textAlign: 'center' }}>{s.saldoEsteAnio}</td>
                  <td style={{ textAlign: 'center' }}>{s.saldoAnteriores}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: s.disponible > 0 ? 'var(--green)' : s.disponible < 0 ? 'var(--red)' : undefined }}>{s.disponible}</td>
                  <td style={{ textAlign: 'center' }}>{s.pendientes ? <span className="badge" style={{ color: 'var(--yellow)' }}>{s.pendientes}</span> : '—'}</td>
                </tr>))}
              {!saldos.length && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 16 }}>Sin datos de licencias del equipo.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Licencias por examen */}
        {saldos.some((s) => s.examenAnio > 0) && (
        <div className="card" style={{ marginBottom: 18, padding: 0, overflow: 'auto' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ margin: 0 }}>📖 Licencias por examen — {new Date().getFullYear()}</h4>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Días de licencia por examen/estudio tomados en el año. El tope depende del nivel de estudios del legajo (10 secundario · 20 terciario/universitario). Solo se listan quienes ya tomaron algún día.</div>
          </div>
          <table>
            <thead><tr><th>Empleado</th><th style={{ textAlign: 'center' }}>Días tomados</th><th style={{ textAlign: 'center' }}>Tope anual</th><th style={{ textAlign: 'center' }}>Disponible</th></tr></thead>
            <tbody>
              {saldos.filter((s) => s.examenAnio > 0).sort((a, b) => b.examenAnio - a.examenAnio).map((s) => {
                const tope = s.examenTope || TOPE_EXAMEN;
                const disp = tope - s.examenAnio;
                return (
                <tr key={s.id}>
                  <td>{s.nom} <span className="muted">({s.legNum})</span></td>
                  <td style={{ textAlign: 'center' }}>{s.examenAnio}</td>
                  <td style={{ textAlign: 'center' }}>{tope}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: disp > 0 ? 'var(--green)' : 'var(--red)' }}>{disp}</td>
                </tr>); })}
            </tbody>
          </table>
        </div>)}

        {/* Avisos */}
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="card" style={{ flex: '1 1 220px' }}>
            <h4 style={{ marginTop: 0 }}>🎂 Cumpleaños (30 días)</h4>
            {data.avisos.cumple.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>Sin cumpleaños próximos.</div>
              : data.avisos.cumple.map((c, i) => (
                <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}>
                  <span>{c.nom}{c.edad ? ` (${c.edad})` : ''}</span>
                  <span className="muted">{c.dias === 0 ? '¡hoy!' : `${c.fecha} · ${c.dias}d`}</span>
                </div>))}
          </div>
          <div className="card" style={{ flex: '1 1 220px' }}>
            <h4 style={{ marginTop: 0 }}>🎉 Aniversarios (30 días)</h4>
            {data.avisos.aniversarios.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>Sin aniversarios próximos.</div>
              : data.avisos.aniversarios.map((a, i) => (
                <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}>
                  <span>{a.nom} · {a.anios} año(s)</span>
                  <span className="muted">{a.dias === 0 ? '¡hoy!' : `${a.fecha} · ${a.dias}d`}</span>
                </div>))}
          </div>
          <div className="card" style={{ flex: '1 1 220px' }}>
            <h4 style={{ marginTop: 0 }}>⏳ Fin de período de prueba</h4>
            {data.avisos.prueba.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>Nada por revisar.</div>
              : data.avisos.prueba.map((p, i) => (
                <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}>
                  <span>{p.nom}</span><span className="muted">{p.dias} días (hito {p.hito})</span>
                </div>))}
          </div>
        </div>
      </>}
    </>
  );
}
