import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Marca { id: number; ts: string; tipo: string; lat?: number; lng?: number; precision_m?: number; }
const hora = (s: string) => new Date(s).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export default function FicharWeb() {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [proximo, setProximo] = useState<'entrada' | 'salida'>('entrada');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() { api.get<{ marcas: Marca[]; proximo: 'entrada' | 'salida' }>('/fichaje/mias').then((r) => { setMarcas(r.marcas); setProximo(r.proximo); }).catch(() => {}); }
  useEffect(() => { cargar(); }, []);

  function fichar() {
    setBusy(true); setMsg(null);
    const enviar = (coords?: GeolocationCoordinates) => {
      api.post('/fichaje', coords ? { lat: coords.latitude, lng: coords.longitude, precision: coords.accuracy } : {})
        .then(() => { setMsg({ t: `Marca de ${proximo} registrada ✓`, ok: true }); cargar(); })
        .catch((e: any) => setMsg({ t: e.message, ok: false }))
        .finally(() => setBusy(false));
    };
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => enviar(pos.coords),
        () => { enviar(); },  // si rechaza el permiso, ficha igual sin ubicación
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else enviar();
  }

  return (
    <>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      <div className="card" style={{ textAlign: 'center', marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 13 }}>Tu próxima marca</div>
        <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 12px', color: proximo === 'entrada' ? 'var(--green)' : 'var(--accent2)' }}>{proximo === 'entrada' ? 'ENTRADA' : 'SALIDA'}</div>
        <button className="btn primary" style={{ fontSize: 18, padding: '12px 28px' }} onClick={fichar} disabled={busy}>{busy ? 'Registrando…' : `Fichar ${proximo}`}</button>
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Se registra la hora y, si lo permitís, tu ubicación. Este fichaje es independiente del reloj de planta.</div>
      </div>
      <div className="card">
        <h4 style={{ marginTop: 0 }}>Mis marcas de hoy</h4>
        {marcas.length === 0 ? <div className="muted">Todavía no fichaste hoy.</div>
          : marcas.map((m) => (
            <div key={m.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
              <span><span className="badge" style={{ color: m.tipo === 'entrada' ? 'var(--green)' : 'var(--accent2)' }}>{m.tipo}</span> {hora(m.ts)}</span>
              <span className="muted" style={{ fontSize: 12 }}>{m.lat != null && Number.isFinite(Number(m.lat)) ? `📍 ${Number(m.lat).toFixed(4)}, ${Number(m.lng).toFixed(4)}` : 'sin ubicación'}</span>
                        </div>
          ))}
      </div>
    </>
  );
}
