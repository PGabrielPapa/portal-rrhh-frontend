import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Panel reutilizable de "Historial de cambios" para módulos de configuración.
export default function HistorialConfig({ modulo }: { modulo: string }) {
  const [hist, setHist] = useState<any[]>([]);
  const [ver, setVer] = useState(false);
  function load() { api.get<any[]>(`/config-hist?modulo=${encodeURIComponent(modulo)}`).then(setHist).catch(() => {}); }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [modulo]);
  if (!hist.length) return null;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Historial de cambios <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({hist.length})</span></h3>
        <div>
          {ver && <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12, marginRight: 6 }} onClick={load}>↻ Actualizar</button>}
          <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setVer((v) => !v)}>{ver ? 'Ocultar' : 'Ver'}</button>
        </div>
      </div>
      {ver && (
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg2)' }}>{['Fecha', 'Ítem', 'Campo', 'Antes', 'Después', 'Por'].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {hist.map((h) => (
                <tr key={h.id}>
                  <td style={{ padding: '3px 8px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{new Date(h.created_at).toLocaleString('es-AR')}</td>
                  <td style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{h.ref || '—'}</td>
                  <td style={{ padding: '3px 8px' }}>{h.campo}</td>
                  <td style={{ padding: '3px 8px', fontFamily: 'monospace' }} className="muted">{h.valor_anterior ?? '—'}</td>
                  <td style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{h.valor_nuevo ?? '—'}</td>
                  <td style={{ padding: '3px 8px' }} className="muted">{h.actor_dni || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
