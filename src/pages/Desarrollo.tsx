import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import EmpleadoPicker from '../components/EmpleadoPicker';

interface KR { id?: number; descripcion: string; valorInicial: number; valorActual: number; valorObjetivo: number; unidad?: string; progreso?: number; }
interface Okr { id: number; ambito: string; empleadoId?: number; empleadoNom?: string; titulo: string; periodo?: string; estado: string; resultados: KR[]; avance: number; }
interface Sol { id: number; empleadoId: number; empleadoNom: string; legNum: string; periodo?: string; estado: string; competencias: string[]; respuestas: number; }
interface Result { evaluadores: number; porCompetencia: { competencia: string; promedio: number; respuestas: number }[]; porRelacion: { relacion: string; promedio: number }[]; comentarios: { relacion: string; competencia: string; comentario: string }[]; }

const RELACIONES = ['jefe', 'par', 'reporte', 'auto'];

export default function Desarrollo() {
  const [tab, setTab] = useState<'okrs' | 'feedback'>('okrs');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button className={`btn ${tab === 'okrs' ? '' : 'ghost'}`} onClick={() => setTab('okrs')}>OKRs (objetivos y resultados)</button>
        <button className={`btn ${tab === 'feedback' ? '' : 'ghost'}`} onClick={() => setTab('feedback')}>Feedback 360°</button>
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {tab === 'okrs' ? <OKRs setMsg={setMsg} /> : <Feedback setMsg={setMsg} />}
    </>
  );
}

function OKRs({ setMsg }: { setMsg: (m: { t: string; ok: boolean }) => void }) {
  const [okrs, setOkrs] = useState<Okr[]>([]);
  const [titulo, setTitulo] = useState('');
  const [ambito, setAmbito] = useState('empleado');
  const [empleadoId, setEmpleadoId] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState('');
  const [krs, setKrs] = useState<KR[]>([{ descripcion: '', valorInicial: 0, valorActual: 0, valorObjetivo: 100, unidad: '' }]);
  const [actuales, setActuales] = useState<Record<number, number>>({});

  function cargar() { api.get<Okr[]>('/desarrollo/okrs').then(setOkrs).catch(() => {}); }
  useEffect(() => { cargar(); }, []);

  async function crear() {
    if (!titulo.trim()) return;
    try {
      await api.post('/desarrollo/okrs', { titulo: titulo.trim(), ambito, empleadoId: ambito === 'empleado' ? empleadoId : null, periodo, resultados: krs.filter((k) => k.descripcion.trim()) });
      setTitulo(''); setPeriodo(''); setKrs([{ descripcion: '', valorInicial: 0, valorActual: 0, valorObjetivo: 100, unidad: '' }]); setEmpleadoId(null);
      setMsg({ t: 'OKR creado', ok: true }); cargar();
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function guardarAvances(o: Okr) {
    const resultados = o.resultados.map((k) => ({ id: k.id, valorActual: actuales[k.id!] ?? k.valorActual }));
    try { await api.patch(`/desarrollo/okrs/${o.id}`, { resultados }); setMsg({ t: 'Avances guardados', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function cerrar(o: Okr) { try { await api.patch(`/desarrollo/okrs/${o.id}`, { estado: 'cerrado' }); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  async function borrar(o: Okr) { if (!confirm('¿Borrar el OKR?')) return; try { await api.del(`/desarrollo/okrs/${o.id}`); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h4 style={{ marginTop: 0 }}>Nuevo OKR</h4>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 240px' }}><label>Objetivo</label><input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Mejorar la satisfacción del cliente" /></div>
          <div className="field"><label>Ámbito</label><select className="input" value={ambito} onChange={(e) => setAmbito(e.target.value)}><option value="empleado">Empleado</option><option value="equipo">Equipo</option><option value="empresa">Empresa</option></select></div>
          <div className="field"><label>Período</label><input className="input" style={{ width: 110 }} value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="2026-Q3" /></div>
        </div>
        {ambito === 'empleado' && <div className="field" style={{ marginTop: 8, maxWidth: 340 }}><label>Empleado</label><EmpleadoPicker onSelect={(e) => setEmpleadoId(e ? e.id : null)} /></div>}
        <div style={{ marginTop: 10 }}>
          <label className="muted" style={{ fontSize: 12 }}>Resultados clave (medibles)</label>
          {krs.map((k, i) => (
            <div key={i} className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '2 1 220px' }}><input className="input" placeholder="Descripción del resultado" value={k.descripcion} onChange={(e) => setKrs((p) => p.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))} /></div>
              <div className="field"><label style={{ fontSize: 10 }}>Inicial</label><input className="input" style={{ width: 80 }} type="number" value={k.valorInicial} onChange={(e) => setKrs((p) => p.map((x, j) => j === i ? { ...x, valorInicial: Number(e.target.value) } : x))} /></div>
              <div className="field"><label style={{ fontSize: 10 }}>Objetivo</label><input className="input" style={{ width: 80 }} type="number" value={k.valorObjetivo} onChange={(e) => setKrs((p) => p.map((x, j) => j === i ? { ...x, valorObjetivo: Number(e.target.value) } : x))} /></div>
              <div className="field"><label style={{ fontSize: 10 }}>Unidad</label><input className="input" style={{ width: 70 }} value={k.unidad} onChange={(e) => setKrs((p) => p.map((x, j) => j === i ? { ...x, unidad: e.target.value } : x))} placeholder="%" /></div>
              {krs.length > 1 && <button className="btn ghost" style={{ padding: '4px 8px' }} onClick={() => setKrs((p) => p.filter((_, j) => j !== i))}>✕</button>}
            </div>
          ))}
          <button className="btn ghost" style={{ marginTop: 8, fontSize: 12 }} onClick={() => setKrs((p) => [...p, { descripcion: '', valorInicial: 0, valorActual: 0, valorObjetivo: 100, unidad: '' }])}>+ Resultado</button>
        </div>
        <button className="btn" style={{ marginTop: 10 }} onClick={crear} disabled={!titulo.trim()}>Crear OKR</button>
      </div>

      {okrs.map((o) => (
        <div key={o.id} className="card" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <b>{o.titulo}</b> <span className="badge" style={{ marginLeft: 6 }}>{o.ambito}</span>
              {o.estado === 'cerrado' && <span className="badge" style={{ marginLeft: 4, color: 'var(--muted)' }}>cerrado</span>}
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{o.empleadoNom ? `${o.empleadoNom} · ` : ''}{o.periodo || 'sin período'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent2)' }}>{o.avance}%</div>
              <div className="muted" style={{ fontSize: 11 }}>avance</div>
            </div>
          </div>
          {o.resultados.map((k) => (
            <div key={k.id} className="row" style={{ alignItems: 'center', gap: 8, margin: '6px 0' }}>
              <span style={{ flex: '1 1 200px', fontSize: 13 }}>{k.descripcion}</span>
              <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden', minWidth: 100 }}>
                <div style={{ width: `${k.progreso || 0}%`, background: 'rgba(34,197,94,.6)', height: 16 }} />
              </div>
              <span className="muted" style={{ fontSize: 12, width: 42, textAlign: 'right' }}>{k.progreso || 0}%</span>
              {o.estado !== 'cerrado' && <input className="input" style={{ width: 90, padding: '2px 6px' }} type="number" defaultValue={k.valorActual} title="Valor actual" onChange={(e) => setActuales((a) => ({ ...a, [k.id!]: Number(e.target.value) }))} />}
              <span className="muted" style={{ fontSize: 11 }}>{k.unidad}</span>
            </div>
          ))}
          {o.estado !== 'cerrado' && <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => guardarAvances(o)}>Guardar avances</button>
            <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => cerrar(o)}>Cerrar</button>
            <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => borrar(o)}>Borrar</button>
          </div>}
        </div>
      ))}
      {!okrs.length && <div className="muted">No hay OKRs cargados.</div>}
    </>
  );
}

function Feedback({ setMsg }: { setMsg: (m: { t: string; ok: boolean }) => void }) {
  const [sols, setSols] = useState<Sol[]>([]);
  const [empleadoId, setEmpleadoId] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState('');
  const [comps, setComps] = useState('Liderazgo, Comunicación, Trabajo en equipo, Orientación a resultados');
  const [resp, setResp] = useState<{ solId: number; evaluador: string; relacion: string; puntajes: Record<string, number>; comentarios: Record<string, string> } | null>(null);
  const [result, setResult] = useState<{ solId: number; data: Result } | null>(null);
  const [invitar, setInvitar] = useState<{ solId: number; empId: number | null; relacion: string } | null>(null);

  function cargar() { api.get<Sol[]>('/desarrollo/feedback').then(setSols).catch(() => {}); }
  useEffect(() => { cargar(); }, []);

  async function crear() {
    if (!empleadoId) { setMsg({ t: 'Elegí el empleado a evaluar', ok: false }); return; }
    const competencias = comps.split(',').map((s) => s.trim()).filter(Boolean);
    try { await api.post('/desarrollo/feedback', { empleadoId, periodo, competencias }); setEmpleadoId(null); setPeriodo(''); setMsg({ t: 'Solicitud de feedback creada', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function enviarResp() {
    if (!resp) return;
    const s = sols.find((x) => x.id === resp.solId);
    const respuestas = (s?.competencias || []).map((c) => ({ competencia: c, puntaje: resp.puntajes[c] || 0, comentario: resp.comentarios[c] || '' }));
    try { await api.post(`/desarrollo/feedback/${resp.solId}/respuestas`, { evaluador: resp.evaluador, relacion: resp.relacion, respuestas }); setResp(null); setMsg({ t: 'Respuesta registrada', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function verResultados(id: number) {
    try { const data = await api.get<Result>(`/desarrollo/feedback/${id}/resultados`); setResult({ solId: id, data }); } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function invitarEval() {
    if (!invitar || !invitar.empId) { setMsg({ t: 'Elegí a quién invitar', ok: false }); return; }
    try { await api.post(`/desarrollo/feedback/${invitar.solId}/invitar`, { invitados: [{ empleadoId: invitar.empId, relacion: invitar.relacion }] }); setInvitar(null); setMsg({ t: 'Evaluador invitado', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function toggleEstado(s: Sol) { try { await api.patch(`/desarrollo/feedback/${s.id}`, { estado: s.estado === 'abierta' ? 'cerrada' : 'abierta' }); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  async function borrar(s: Sol) { if (!confirm('¿Borrar la solicitud?')) return; try { await api.del(`/desarrollo/feedback/${s.id}`); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h4 style={{ marginTop: 0 }}>Nueva solicitud de feedback 360°</h4>
        <div className="field" style={{ maxWidth: 340, marginBottom: 8 }}><label>Empleado a evaluar</label><EmpleadoPicker onSelect={(e) => setEmpleadoId(e ? e.id : null)} /></div>
        <div className="field" style={{ maxWidth: 160, marginBottom: 8 }}><label>Período</label><input className="input" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="2026-H2" /></div>
        <div className="field" style={{ marginBottom: 8 }}><label>Competencias a evaluar (separadas por coma)</label><input className="input" value={comps} onChange={(e) => setComps(e.target.value)} /></div>
        <button className="btn" onClick={crear}>Crear solicitud</button>
      </div>

      {sols.map((s) => (
        <div key={s.id} className="card" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <b>{s.empleadoNom}</b> <span className="muted">(leg. {s.legNum})</span>
              <span className="badge" style={{ marginLeft: 6, color: s.estado === 'abierta' ? 'var(--green)' : 'var(--muted)' }}>{s.estado}</span>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{s.periodo || 'sin período'} · {s.competencias.length} competencias · {s.respuestas} respuesta(s)</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {s.estado === 'abierta' && <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setResp({ solId: s.id, evaluador: '', relacion: 'par', puntajes: {}, comentarios: {} })}>Responder</button>}
              {s.estado === 'abierta' && <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setInvitar({ solId: s.id, empId: null, relacion: 'par' })}>Invitar</button>}
              <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => verResultados(s.id)}>Resultados</button>
              <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleEstado(s)}>{s.estado === 'abierta' ? 'Cerrar' : 'Reabrir'}</button>
              <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => borrar(s)}>Borrar</button>
            </div>
          </div>

          {invitar?.solId === s.id && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: '1 1 240px' }}><label>Invitar evaluador</label><EmpleadoPicker onSelect={(e) => setInvitar({ ...invitar, empId: e ? e.id : null })} /></div>
                <div className="field"><label>Relación</label><select className="input" value={invitar.relacion} onChange={(e) => setInvitar({ ...invitar, relacion: e.target.value })}>{RELACIONES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                <button className="btn" style={{ padding: '6px 12px' }} onClick={invitarEval}>Invitar</button>
                <button className="btn ghost" style={{ padding: '6px 12px' }} onClick={() => setInvitar(null)}>Cerrar</button>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>El evaluador verá la evaluación en su espacio («Mi feedback 360») y podrá responder.</div>
            </div>
          )}
          {result?.solId === s.id && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{result.data.evaluadores} respuesta(s) · promedio por competencia (0-5)</div>
              {result.data.porCompetencia.map((c) => (
                <div key={c.competencia} className="row" style={{ alignItems: 'center', gap: 8, margin: '4px 0' }}>
                  <span style={{ flex: '1 1 160px', fontSize: 13 }}>{c.competencia}</span>
                  <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden', minWidth: 100 }}><div style={{ width: `${(c.promedio / 5) * 100}%`, background: 'rgba(94,194,255,.7)', height: 16 }} /></div>
                  <b style={{ width: 34, textAlign: 'right' }}>{c.promedio.toFixed(1)}</b>
                </div>
              ))}
              {result.data.porRelacion.length > 0 && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Por relación: {result.data.porRelacion.map((r) => `${r.relacion} ${r.promedio.toFixed(1)}`).join(' · ')}</div>}
              {result.data.comentarios.length > 0 && <div style={{ marginTop: 8 }}>{result.data.comentarios.map((c, i) => <div key={i} className="muted" style={{ fontSize: 12 }}>“{c.comentario}” <span style={{ opacity: .7 }}>— {c.relacion}, {c.competencia}</span></div>)}</div>}
              <button className="btn ghost" style={{ marginTop: 8, padding: '3px 10px', fontSize: 12 }} onClick={() => setResult(null)}>Ocultar</button>
            </div>
          )}

          {resp?.solId === s.id && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 6 }}>
                <div className="field"><label>Evaluador (opcional)</label><input className="input" value={resp.evaluador} onChange={(e) => setResp({ ...resp, evaluador: e.target.value })} placeholder="Anónimo" /></div>
                <div className="field"><label>Relación</label><select className="input" value={resp.relacion} onChange={(e) => setResp({ ...resp, relacion: e.target.value })}>{RELACIONES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
              </div>
              {s.competencias.map((c) => (
                <div key={c} className="row" style={{ gap: 8, alignItems: 'center', margin: '4px 0' }}>
                  <span style={{ width: 180, fontSize: 13 }}>{c}</span>
                  <select className="input" style={{ width: 70 }} value={resp.puntajes[c] || 0} onChange={(e) => setResp({ ...resp, puntajes: { ...resp.puntajes, [c]: Number(e.target.value) } })}>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                  <input className="input" style={{ flex: 1 }} placeholder="Comentario (opcional)" value={resp.comentarios[c] || ''} onChange={(e) => setResp({ ...resp, comentarios: { ...resp.comentarios, [c]: e.target.value } })} />
                </div>
              ))}
              <div className="row" style={{ gap: 6, marginTop: 8 }}><button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={enviarResp}>Enviar respuesta</button><button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setResp(null)}>Cancelar</button></div>
            </div>
          )}
        </div>
      ))}
      {!sols.length && <div className="muted">No hay solicitudes de feedback.</div>}
    </>
  );
}
