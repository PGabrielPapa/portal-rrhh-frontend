import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Row { id: number; ts: string; tipo: string; lat?: number; lng?: number; precision_m?: number; nom: string; leg_num: string; empresa: string; }
const hora = (s: string) => new Date(s).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export default function FichajeWebRRHH() {
  const [dia, setDia] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    setErr('');
    api.get<Row[]>(`/fichaje?dia=${dia}`).then(setRows).catch((e) => setErr(e.message));
  }, [dia]);

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>
        Fichaje web (self check-in) de los empleados. Es independiente de las fichadas del reloj Pro-Soft y no las modifica.
      </p>
      <div className="row" style={{ marginBottom: 12, gap: 10, alignItems: 'flex-end' }}>
        <div className="field"><label>Día</label><input className="input" type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></div>
      </div>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Empleado</th><th>Empresa</th><th>Hora</th><th>Tipo</th><th>Ubicación</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.nom} <span className="muted">({r.leg_num})</span></td>
                <td>{r.empresa}</td>
                <td>{hora(r.ts)}</td>
                <td><span className="badge" style={{ color: r.tipo === 'entrada' ? 'var(--green)' : 'var(--accent2)' }}>{r.tipo}</span></td>
                <td>{r.lat != null ? <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer">📍 ver mapa</a> : <span className="muted">—</span>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin fichajes web ese día.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
