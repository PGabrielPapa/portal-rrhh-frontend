import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Aus { nom: string; tipo: string; desde: string; hasta: string; }
interface Rk { nom: string; min: number; }
interface Cumple { nom: string; fecha: string; dias: number; edad: number | null; }
interface Aniv { nom: string; fecha: string; dias: number; anios: number; }
interface Prueba { nom: string; dias: number; hito: number; }
interface Dash {
  periodo: { anio: number; mes: number };
  sinEquipo?: boolean;
  kpi: { dotacion: number; masaBruta: number; costoLaboral: number; contribPct: number; antiguedadProm: number; edadProm: number };
  pendientes: { adelantos: number; fichadas: number; licencias: number; evaluaciones: number; anualAbierto: boolean };
  asistencia: { ausentesHoy: Aus[]; ausentismoDias: number };
  puntualidad: { tardanzasCasos: number; tardanzasMin: number; ranking: Rk[] };
  extra: { totalMin: number; ranking: Rk[] };
  avisos: { cumple: Cumple[]; aniversarios: Aniv[]; prueba: Prueba[] };
  evolucion: { anio: number; mes: number; neto: number }[];
}

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

  async function cargar() {
    setErr(''); setBusy(true);
    try { setData(await api.get<Dash>(`/dashboard/gerente?anio=${anio}&mes=${mes}`)); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [anio, mes]);

  const maxEvo = data ? Math.max(1, ...data.evolucion.map((e) => e.neto)) : 1;

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
          <Pend t="Horas extra para autorizar" n={data.pendientes.fichadas} ico="🕒" onClick={() => nav('/m/fichadas-equipo')} />
          <Pend t="Licencias para aprobar" n={data.pendientes.licencias} ico="🏖" onClick={() => nav('/m/licencias-equipo')} />
          <Pend t={data.pendientes.anualAbierto ? 'Evaluaciones (período abierto)' : 'Evaluaciones de prueba'} n={data.pendientes.evaluaciones} ico="📈" onClick={() => nav('/m/evaluaciones-equipo')} />
        </div>

        {/* Asistencia + Puntualidad */}
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 18 }}>
          <div className="card" style={{ flex: '1 1 300px' }}>
            <h4 style={{ marginTop: 0 }}>Ausentes hoy <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({data.asistencia.ausentesHoy.length})</span></h4>
            {data.asistencia.ausentesHoy.length === 0
              ? <div className="muted" style={{ fontSize: 13 }}>Nadie con licencia activa hoy.</div>
              : data.asistencia.ausentesHoy.map((a, i) => (
                <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                  <span>{a.nom}</span><span className="muted">{a.tipo} · hasta {String(a.hasta).slice(0, 10)}</span>
                </div>))}
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Ausentismo del mes: {data.asistencia.ausentismoDias} día(s) de licencia.</div>
          </div>
          <div className="card" style={{ flex: '1 1 300px' }}>
            <h4 style={{ marginTop: 0 }}>Llegadas tarde del mes</h4>
            <div className="row" style={{ gap: 16, marginBottom: 8 }}>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{data.puntualidad.tardanzasCasos}</div><div className="muted" style={{ fontSize: 11 }}>empleados con tardanzas</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{hm(data.puntualidad.tardanzasMin)}</div><div className="muted" style={{ fontSize: 11 }}>acumulado del equipo</div></div>
            </div>
            {data.puntualidad.ranking.map((r, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}>
                <span>{r.nom}</span><span className="muted" style={{ fontFamily: 'var(--font-mono)' }}>{hm(r.min)}</span>
              </div>))}
            {data.puntualidad.ranking.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Sin tardanzas registradas.</div>}
          </div>
        </div>

        {/* Horas extra + Evolución */}
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 18 }}>
          <div className="card" style={{ flex: '1 1 300px' }}>
            <h4 style={{ marginTop: 0 }}>Horas extra del mes <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({hm(data.extra.totalMin)})</span></h4>
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
