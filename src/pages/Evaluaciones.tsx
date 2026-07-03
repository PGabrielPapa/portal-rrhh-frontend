import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';
import EmpleadoPicker from '../components/EmpleadoPicker';
import { EVAL_ITEMS, EVAL_LABELS } from '../lib/evalItems';

interface V { id: number; periodo: string; tipo?: string; calificacion?: string; comentarios?: string; promedio?: number; datos?: any; nom?: string; leg_num?: string; empresa?: string; created_by?: string; validador?: string; area_org?: string; gerencia?: string; }
const TIPOS = ['Anual', 'Período de prueba', 'Semestral'];

export default function Evaluaciones() {
  const { key } = useParams();
  const modoMias = key === 'mis-evaluaciones';
  const esRRHH = key === 'evaluaciones';
  const esGerente = key === 'evaluaciones-equipo';
  const titulo = modoMias ? 'Mis evaluaciones' : esRRHH ? 'Evaluaciones — RR.HH.' : 'Evaluaciones del equipo';

  const [items, setItems] = useState<V[]>([]);
  const [q, setQ] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [empresa, setEmpresa] = useState('');
  const [fAnio, setFAnio] = useState(''); const [fTipo, setFTipo] = useState(''); const [fCalif, setFCalif] = useState(''); const [fGcia, setFGcia] = useState('');
  const [emp, setEmp] = useState<Empleado | null>(null);
  const [equipo, setEquipo] = useState<Empleado[]>([]);
  const [f, setF] = useState<Record<string, string>>({ tipo: 'Anual', calificacion: 'Bueno', periodo: `Anual ${new Date().getFullYear()}` });
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [periodo, setPeriodo] = useState<{ anio: number; abierto: boolean; abierto_at?: string; cerrado_at?: string } | null>(null);
  const [pend, setPend] = useState<{ anual: { anio: number; abierto: boolean } | null; equipoCount: number; prueba: { id: number; nom: string; legNum: string; ingreso?: string; dias: number; hito: number }[] } | null>(null);
  const [anioPer, setAnioPer] = useState(new Date().getFullYear());
  const [scores, setScores] = useState<Record<string, Record<number, number>>>({});
  const setScore = (cat: string, i: number, v: number) => setScores((p) => ({ ...p, [cat]: { ...(p[cat] || {}), [i]: v } }));
  const promedio = (() => { const a: number[] = []; Object.values(scores).forEach((c) => Object.values(c).forEach((v) => v > 0 && a.push(v))); return a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 100) / 100 : 0; })();
  const calificacionAuto = promedio > 0 ? (EVAL_LABELS[Math.round(promedio)] || '') : '';
  const puedeRegistrar = esRRHH || key === 'evaluaciones-equipo';  // gerente y RR.HH. registran

  async function load() {
    try {
      if (modoMias) { setItems(await api.get<V[]>('/evaluaciones/mias')); return; }
      const p = new URLSearchParams(); if (q) p.set('q', q); if (empresa) p.set('empresa', empresa);
      setItems(await api.get<V[]>(`/evaluaciones?${p}`));
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  useEffect(() => { if (esRRHH) api.get<Empleado[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {}); }, [esRRHH]);
  useEffect(() => { if (esGerente) api.get<Empleado[]>('/empleados/equipo').then(setEquipo).catch(() => {}); }, [esGerente]);
  async function cargarPeriodo() { try { setPeriodo(await api.get('/evaluaciones/periodo')); } catch { /* */ } }
  async function cargarPend() { try { setPend(await api.get('/evaluaciones/pendientes')); } catch { /* */ } }
  useEffect(() => { if (esRRHH) cargarPeriodo(); if (esGerente) cargarPend(); /* eslint-disable-next-line */ }, [esRRHH, esGerente]);
  async function abrirPeriodo() { try { await api.post('/evaluaciones/periodo', { anio: anioPer }); setMsg({ t: `Período de evaluación anual ${anioPer} abierto`, ok: true }); cargarPeriodo(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  async function cerrarPeriodo(anio: number) { try { await api.patch(`/evaluaciones/periodo/${anio}/cerrar`, {}); setMsg({ t: `Período ${anio} cerrado`, ok: true }); cargarPeriodo(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  function evaluarPrueba(p: { id: number; nom: string; legNum: string; hito: number }) {
    setEmp((equipo.find((x) => x.id === p.id) || { id: p.id, nom: p.nom, legNum: p.legNum }) as Empleado);
    setF({ ...f, tipo: 'Período de prueba', periodo: `Período de prueba ${p.hito} días`, calificacion: f.calificacion || 'Bueno' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [key, q, empresa]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault(); if (!emp) return;
    try { await api.post('/evaluaciones', { empleadoId: emp.id, periodo: f.periodo, tipo: f.tipo, calificacion: calificacionAuto, comentarios: f.comentarios, datos: { items: scores } }); setMsg({ t: 'Evaluación registrada', ok: true }); setEmp(null); setScores({}); load(); if (esGerente) cargarPend(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      {esRRHH && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>Período de evaluación de desempeño anual</h3>
          <p className="muted" style={{ marginTop: -6, fontSize: 12 }}>RR.HH. abre el período cada año (habitualmente en octubre). Mientras está abierto, los gerentes ven el aviso para evaluar a su personal.</p>
          {periodo
            ? <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge" style={{ color: periodo.abierto ? 'var(--green)' : 'var(--t3)' }}>{periodo.abierto ? `Abierto · ${periodo.anio}` : `Cerrado · ${periodo.anio}`}</span>
                {periodo.abierto
                  ? <button className="btn ghost" onClick={() => cerrarPeriodo(periodo.anio)}>Cerrar período {periodo.anio}</button>
                  : <button className="btn" onClick={abrirPeriodo}>Reabrir / abrir período</button>}
              </div>
            : <div className="muted" style={{ fontSize: 13 }}>Todavía no se abrió ningún período.</div>}
          {(!periodo || !periodo.abierto) && (
            <div className="row" style={{ gap: 8, alignItems: 'flex-end', marginTop: 10 }}>
              <div className="field"><label>Año</label><input className="input" type="number" style={{ width: 110 }} value={anioPer} onChange={(e) => setAnioPer(Number(e.target.value))} /></div>
              <button className="btn" onClick={abrirPeriodo}>Abrir período {anioPer}</button>
            </div>
          )}
        </div>
      )}

      {esGerente && pend && (
        <>
          {pend.anual?.abierto && pend.equipoCount > 0 && (
            <div className="card" style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(61,127,255,.1)', border: '1px solid rgba(61,127,255,.4)', color: 'var(--accent2)', fontWeight: 600 }}>
              📋 Período de evaluación de desempeño anual abierto — tiene personal a evaluar
            </div>
          )}
          {pend.prueba.length > 0 && (
            <div className="card" style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(234,179,8,.07)', border: '1px solid rgba(234,179,8,.35)' }}>
              <strong style={{ color: 'var(--yellow)' }}>⏰ Evaluaciones de período de prueba pendientes ({pend.prueba.length})</strong>
              <div className="muted" style={{ fontSize: 12, margin: '2px 0 8px' }}>A realizar a los 60, 120 y 170 días desde el ingreso.</div>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead><tr><th>Empleado</th><th style={{ textAlign: 'right' }}>Días desde ingreso</th><th>Hito</th><th></th></tr></thead>
                <tbody>
                  {pend.prueba.map((p, i) => (
                    <tr key={i}>
                      <td>{p.nom} <span className="muted">({p.legNum})</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{p.dias}</td>
                      <td><span className="badge" style={{ color: 'var(--yellow)' }}>{p.hito} días</span></td>
                      <td style={{ textAlign: 'right' }}><button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => evaluarPrueba(p)}>Evaluar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {puedeRegistrar && (
        <form className="card" style={{ marginBottom: 18 }} onSubmit={registrar}>
          <h3 style={{ marginTop: 0 }}>Registrar evaluación</h3>
          <div className="field" style={{ marginBottom: 10 }}><label>Empleado *</label>
            {esGerente
              ? <select className="input" value={emp?.id ?? ''} onChange={(e) => setEmp(equipo.find((x) => String(x.id) === e.target.value) || null)}>
                  <option value="">{equipo.length ? 'Elegí un integrante de tu equipo…' : 'No tenés personas a cargo en el organigrama'}</option>
                  {equipo.map((x) => <option key={x.id} value={x.id}>{x.nom} ({x.legNum})</option>)}
                </select>
              : <EmpleadoPicker onSelect={setEmp} />}
          </div>
          <div className="grid2" style={{ marginBottom: 10 }}>
            <div className="field"><label>Período *</label><input className="input" value={f.periodo || ''} onChange={set('periodo')} /></div>
            <div className="field"><label>Tipo</label><select className="input" value={f.tipo} onChange={set('tipo')}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label>Calificación (automática)</label><input className="input" readOnly value={promedio > 0 ? `${calificacionAuto} · ${promedio.toFixed(2)}/5` : 'Se calcula al completar la matriz'} /></div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Matriz de competencias (1 a 5) {promedio > 0 ? `· promedio ${promedio.toFixed(2)} (${EVAL_LABELS[Math.round(promedio)] || ''})` : ''}</div>
            {Object.entries(EVAL_ITEMS).map(([cat, def]) => (
              <details key={cat} style={{ marginBottom: 6 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--accent2)' }}>{def.label}</summary>
                <table style={{ width: '100%', fontSize: 12, marginTop: 6 }}><tbody>
                  {def.items.map((it, i) => (
                    <tr key={i}><td style={{ padding: '2px 6px' }}>{it}</td>
                      <td style={{ padding: '2px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <label key={n} title={EVAL_LABELS[n]} style={{ marginLeft: 6, cursor: 'pointer' }}><input type="radio" name={`${cat}-${i}`} checked={(scores[cat]?.[i] || 0) === n} onChange={() => setScore(cat, i, n)} /> {n}</label>
                        ))}
                      </td></tr>
                  ))}
                </tbody></table>
              </details>
            ))}
          </div>
          <div className="field" style={{ marginBottom: 12 }}><label>Comentarios</label><textarea className="input" rows={2} value={f.comentarios || ''} onChange={set('comentarios')} /></div>
          {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 8 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
          <button className="btn" disabled={!emp || !f.periodo || promedio === 0}>Registrar</button>
        </form>
      )}
      {!puedeRegistrar && msg && !msg.ok && <div className="err" style={{ marginBottom: 12 }}>⚠ {msg.t}</div>}

      {!modoMias && (() => {
        const yearOf = (p?: string) => (String(p || '').match(/\d{4}/) || [''])[0];
        const anios = [...new Set(items.map((v) => yearOf(v.periodo)).filter(Boolean))].sort().reverse();
        const tipos = [...new Set(items.map((v) => v.tipo).filter(Boolean) as string[])].sort();
        const califs = [...new Set(items.map((v) => v.calificacion).filter(Boolean) as string[])].sort();
        const gcias = [...new Set(items.map((v) => v.gerencia).filter((x) => x && x !== '—') as string[])].sort();
        return (
        <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <input className="input" style={{ maxWidth: 220 }} placeholder="Buscar empleado o legajo…" value={q} onChange={(e) => setQ(e.target.value)} />
          {esRRHH && <select className="input" style={{ maxWidth: 180 }} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
            <option value="">Todas las empresas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}
          </select>}
          <select className="input" style={{ maxWidth: 120 }} value={fAnio} onChange={(e) => setFAnio(e.target.value)}><option value="">Año</option>{anios.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          <select className="input" style={{ maxWidth: 170 }} value={fTipo} onChange={(e) => setFTipo(e.target.value)}><option value="">Tipo</option>{tipos.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className="input" style={{ maxWidth: 170 }} value={fCalif} onChange={(e) => setFCalif(e.target.value)}><option value="">Calificación</option>{califs.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select className="input" style={{ maxWidth: 220 }} value={fGcia} onChange={(e) => setFGcia(e.target.value)}><option value="">Gerencia (organigrama)</option>{gcias.map((g) => <option key={g} value={g}>{g}</option>)}</select>
        </div>
        );
      })()}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr>{!modoMias && <th>Empleado</th>}{esRRHH && <th>Empresa</th>}<th>Período</th><th>Tipo</th><th>Calificación</th><th>Promedio</th><th>Comentarios</th></tr></thead>
          <tbody>
            {items.filter((v) => (!fAnio || (String(v.periodo || '').match(/\d{4}/) || [''])[0] === fAnio) && (!fTipo || v.tipo === fTipo) && (!fCalif || v.calificacion === fCalif) && (!fGcia || v.gerencia === fGcia)).map((v) => (
              <tr key={v.id}>{!modoMias && <td>{v.nom} <span className="muted">({v.leg_num})</span></td>}{esRRHH && <td>{v.empresa}</td>}<td>{v.periodo}</td><td>{v.tipo || '—'}</td><td>{v.calificacion || '—'}</td><td style={{ fontFamily: 'monospace' }}>{v.promedio != null ? Number(v.promedio).toFixed(2) : '—'}</td><td>{v.comentarios || '—'}</td></tr>
            ))}
            {!items.length && <tr><td colSpan={modoMias ? 4 : (esRRHH ? 6 : 5)} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin evaluaciones.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
