import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const TAREAS = [
  { key: 'fichadas', label: 'Fichadas (autorizar)' },
  { key: 'licencias', label: 'Licencias (aprobar)' },
  { key: 'adelantos', label: 'Adelantos (recomendar) — solo a gerente' },
  { key: 'evaluaciones', label: 'Evaluaciones' },
];
interface Cand { id: number; nom: string; leg_num: string; role: string; empresa: string; }
interface Deleg { id: number; delegado_nom: string; delegado_empresa: string; tarea: string; desde?: string; hasta?: string; estado: string; nota?: string; }
const fmtF = (d?: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR') : '—';
const tareaLabel = (t: string) => TAREAS.find((x) => x.key === t)?.label.split(' —')[0] || t;

export default function Delegaciones() {
  const [cands, setCands] = useState<Cand[]>([]);
  const [mias, setMias] = useState<Deleg[]>([]);
  const [delegado, setDelegado] = useState('');
  const [tareas, setTareas] = useState<Set<string>>(new Set());
  const [permanente, setPermanente] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [nota, setNota] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setCands(await api.get<Cand[]>('/delegaciones/candidatos'));
      setMias(await api.get<Deleg[]>('/delegaciones/mias'));
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  useEffect(() => { load(); }, []);

  function toggle(t: string) { setTareas((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; }); }

  async function crear() {
    setMsg(null);
    if (!delegado || !tareas.size) { setMsg({ t: 'Elegí un delegado y al menos una tarea.', ok: false }); return; }
    setBusy(true);
    try {
      const r = await api.post<{ delegado: string }>('/delegaciones', {
        delegadoId: Number(delegado), tareas: [...tareas],
        desde: desde || undefined, hasta: permanente ? undefined : (hasta || undefined), nota: nota || undefined,
      });
      setMsg({ t: `Delegación creada para ${r.delegado}.`, ok: true });
      setTareas(new Set()); setNota('');
      load();
    } catch (e: any) { setMsg({ t: e.message, ok: false }); } finally { setBusy(false); }
  }
  async function revocar(d: Deleg) {
    if (!window.confirm(`¿Revocar la delegación de "${tareaLabel(d.tarea)}" a ${d.delegado_nom}?`)) return;
    try { await api.patch(`/delegaciones/${d.id}/revocar`, {}); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  const candElegido = cands.find((c) => String(c.id) === delegado);
  const adelantosBloqueado = tareas.has('adelantos') && candElegido && candElegido.role !== 'manager';

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 14 }}>
        Delegá tus tareas de aprobación en otra persona (un coordinador u otro gerente). El delegado las verá y operará sobre tu equipo. <b>Adelantos</b> solo puede delegarse a un gerente. Podés ponerle fecha de fin o dejarla permanente, y revocarla cuando quieras.
      </p>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓' : '⚠'} {msg.t}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Nueva delegación</h3>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 280 }}><label>Delegar en</label>
            <select className="input" value={delegado} onChange={(e) => setDelegado(e.target.value)}>
              <option value="">Elegí un empleado…</option>
              {cands.map((c) => <option key={c.id} value={c.id}>{c.nom} · {c.empresa}{c.role === 'manager' ? ' · gerente' : ''}</option>)}
            </select>
          </div>
        </div>
        <div style={{ margin: '10px 2px' }}>
          <label className="muted">Tareas a delegar</label>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
            {TAREAS.map((t) => <label key={t.key} className="row" style={{ gap: 6, alignItems: 'center' }}><input type="checkbox" checked={tareas.has(t.key)} onChange={() => toggle(t.key)} /> {t.label}</label>)}
          </div>
          {adelantosBloqueado && <div className="err" style={{ marginTop: 8 }}>⚠ {candElegido?.nom} no es gerente: no se puede delegar Adelantos. Destildá Adelantos o elegí un gerente.</div>}
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="row" style={{ gap: 6, alignItems: 'center' }}><input type="checkbox" checked={permanente} onChange={(e) => setPermanente(e.target.checked)} /> Permanente</label>
          <div className="field"><label>Desde (opcional)</label><input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
          {!permanente && <div className="field"><label>Hasta</label><input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>}
          <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Nota (opcional)</label><input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. cubre mis vacaciones" /></div>
          <button className="btn" onClick={crear} disabled={busy || !!adelantosBloqueado}>{busy ? '…' : 'Delegar'}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <h3 style={{ margin: '12px 16px' }}>Mis delegaciones</h3>
        <table>
          <thead><tr><th>Delegado</th><th>Tarea</th><th>Vigencia</th><th>Estado</th><th>Nota</th><th></th></tr></thead>
          <tbody>
            {mias.map((d) => (
              <tr key={d.id}>
                <td>{d.delegado_nom} <span className="muted">· {d.delegado_empresa}</span></td>
                <td>{tareaLabel(d.tarea)}</td>
                <td className="muted">{d.desde ? fmtF(d.desde) : 'ya'} → {d.hasta ? fmtF(d.hasta) : 'permanente'}</td>
                <td><span style={{ color: d.estado === 'activa' ? '#16a34a' : '#888' }}>{d.estado}</span></td>
                <td className="muted">{d.nota || '—'}</td>
                <td style={{ textAlign: 'right' }}>{d.estado === 'activa' && <button className="btn danger" onClick={() => revocar(d)}>Revocar</button>}</td>
              </tr>
            ))}
            {!mias.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>Todavía no delegaste ninguna tarea.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
