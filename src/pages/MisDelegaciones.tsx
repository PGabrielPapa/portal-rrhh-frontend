import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Rec { id: number; delegante_nom: string; delegante_empresa: string; tarea: string; tareaLabel: string; desde?: string; hasta?: string; }
const fmtF = (d?: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR') : '—';

export default function MisDelegaciones() {
  const [rows, setRows] = useState<Rec[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => { api.get<Rec[]>('/delegaciones/recibidas').then(setRows).catch((e) => setErr(e.message)); }, []);

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 14 }}>
        Tareas que otros gerentes te delegaron. Cada una aparece en el menú, en el grupo <b>Delegado a mí</b>, para que la gestiones sobre el equipo de quien te delegó.
      </p>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Tarea</th><th>Delegada por</th><th>Vigencia</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.tareaLabel || r.tarea}</td>
                <td>{r.delegante_nom} <span className="muted">· {r.delegante_empresa}</span></td>
                <td className="muted">{r.desde ? fmtF(r.desde) : 'ya'} → {r.hasta ? fmtF(r.hasta) : 'permanente'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 20 }}>No tenés tareas delegadas.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
