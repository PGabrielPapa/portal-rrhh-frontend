import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Paso { orden: number; rol: string; etiqueta?: string; obligatorio?: boolean; }
interface Aprob { orden: number; rol?: string; etiqueta?: string; decision: string; actor_nom?: string; comentario?: string; at: string; }
interface Flujo { estado: string; tieneWorkflow: boolean; pasos: Paso[]; aprobaciones: Aprob[]; pasoActual: Paso | null; puedeResolver: boolean; }

// Flujo de aprobación multinivel genérico. `base` es la ruta del recurso, p. ej.
// '/anticipos' o '/licencias'. Espera endpoints GET `${base}/:id/flujo` y
// POST `${base}/:id/aprobar`. Si el ítem no tiene workflow, no muestra nada.
export default function FlujoAprobacion({ base, id, onResuelto }: { base: string; id: number; onResuelto?: () => void }) {
  const [f, setF] = useState<Flujo | null>(null);
  const [coment, setComent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function cargar() { api.get<Flujo>(`${base}/${id}/flujo`).then(setF).catch(() => setF(null)); }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [base, id]);

  async function resolver(decision: 'aprobado' | 'rechazado') {
    setBusy(true); setErr('');
    try { await api.post(`${base}/${id}/aprobar`, { decision, comentario: coment }); setComent(''); cargar(); onResuelto?.(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (!f || !f.tieneWorkflow) return null;
  const decididos = new Map(f.aprobaciones.map((a) => [a.orden, a]));
  const cerrado = f.estado !== 'pendiente';
  const cerradoOk = f.estado === 'aprobado' || f.estado === 'aprobada';
  return (
    <div style={{ marginTop: 8, padding: 10, background: 'var(--bg2)', borderRadius: 8 }}>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Flujo de aprobación</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {f.pasos.map((p, i) => {
          const a = decididos.get(p.orden);
          const actual = f.pasoActual && f.pasoActual.orden === p.orden;
          const color = a ? (a.decision === 'aprobado' ? 'var(--green)' : 'var(--red)') : actual ? 'var(--accent2)' : 'var(--muted)';
          return (
            <span key={p.orden} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span className="muted">→</span>}
              <span className="badge" style={{ color, borderColor: color }} title={a ? `${a.decision} por ${a.actor_nom || ''}` : (p.etiqueta || p.rol)}>
                {a ? (a.decision === 'aprobado' ? '✔' : '✕') : (actual ? '⏳' : '•')} {p.etiqueta || p.rol}{p.obligatorio === false ? ' (opc.)' : ''}
              </span>
            </span>
          );
        })}
      </div>
      {f.aprobaciones.length > 0 && (
        <div style={{ marginTop: 6 }}>{f.aprobaciones.map((a, i) => (
          <div key={i} className="muted" style={{ fontSize: 11 }}>{a.decision === 'aprobado' ? '✔' : '✕'} {a.etiqueta || a.rol}: {a.actor_nom} · {new Date(a.at).toLocaleDateString('es-AR')}{a.comentario ? ` — “${a.comentario}”` : ''}</div>
        ))}</div>
      )}
      {err && <div className="err" style={{ marginTop: 6, fontSize: 12 }}>⚠ {err}</div>}
      {f.estado === 'pendiente' && f.pasoActual && f.puedeResolver && (
        <div style={{ marginTop: 8 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Tu paso: <b>{f.pasoActual.etiqueta || f.pasoActual.rol}</b></div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Comentario (opcional)" value={coment} onChange={(e) => setComent(e.target.value)} />
            <button className="btn" style={{ padding: '4px 12px', fontSize: 12 }} disabled={busy} onClick={() => resolver('aprobado')}>Aprobar mi paso</button>
            <button className="btn ghost" style={{ padding: '4px 12px', fontSize: 12 }} disabled={busy} onClick={() => resolver('rechazado')}>Rechazar</button>
          </div>
        </div>
      )}
      {f.estado === 'pendiente' && f.pasoActual && !f.puedeResolver && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Esperando aprobación de: <b>{f.pasoActual.etiqueta || f.pasoActual.rol}</b></div>
      )}
      {cerrado && <div className="badge" style={{ marginTop: 6, color: cerradoOk ? 'var(--green)' : 'var(--red)' }}>{f.estado}</div>}
    </div>
  );
}
