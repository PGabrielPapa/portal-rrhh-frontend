import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import FlujoAprobacion from '../components/FlujoAprobacion';

interface Pend { tipo: string; proceso: string; base: string; id: number; empleado: string; legNum?: string; paso?: string; createdAt?: string; }
const ICONO: Record<string, string> = { adelanto: '💵', licencia: '🌴', sancion: '⚠️' };
const NOMBRE: Record<string, string> = { adelanto: 'Adelanto', licencia: 'Licencia', sancion: 'Sanción' };

export default function MisAprobaciones() {
  const [items, setItems] = useState<Pend[]>([]);
  const [cargando, setCargando] = useState(true);

  function load() {
    setCargando(true);
    api.get<{ total: number; items: Pend[] }>('/aprobaciones/pendientes')
      .then((r) => setItems(r.items || []))
      .catch(() => setItems([]))
      .finally(() => setCargando(false));
  }
  useEffect(() => { load(); }, []);

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>
        Todo lo que espera tu decisión, en un solo lugar. Resolvé el paso que te toca de cada trámite; al hacerlo, el circuito avanza automáticamente al siguiente nivel.
      </p>
      {cargando ? <div className="muted">Cargando…</div> : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <div style={{ marginTop: 8, fontWeight: 700 }}>No tenés aprobaciones pendientes</div>
          <div className="muted" style={{ fontSize: 13 }}>Cuando alguien inicie un trámite que requiera tu visto bueno, va a aparecer acá.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((it) => (
            <div key={`${it.tipo}-${it.id}`} className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ marginRight: 6 }}>{ICONO[it.tipo] || '📄'}</span>
                  <b>{NOMBRE[it.tipo] || it.tipo}</b> de {it.empleado} {it.legNum ? <span className="muted">({it.legNum})</span> : null}
                </div>
                {it.paso && <span className="badge" style={{ color: 'var(--accent2)', borderColor: 'var(--accent2)' }}>tu paso: {it.paso}</span>}
              </div>
              <FlujoAprobacion base={it.base} id={it.id} onResuelto={load} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
