import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Alerta { tipo: string; titulo: string; detalle: string; fecha: string; dias: number; severidad: string; empleadoId?: number }
interface Resp { horizonte: number; resumen: { total: number; vencidos: number; urgentes: number }; alertas: Alerta[] }
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
const COLOR: Record<string, string> = { vencido: '#b91c1c', urgente: '#b45309', proximo: '#1d4ed8' };
const LABEL: Record<string, string> = { vencido: 'Vencido', urgente: 'Urgente', proximo: 'Próximo' };

export default function Alertas() {
  const [dias, setDias] = useState(30);
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState('');
  const [mailTo, setMailTo] = useState('');
  const [mailMsg, setMailMsg] = useState('');
  async function cargar() { setErr(''); try { setData(await api.get<Resp>(`/alertas?dias=${dias}`)); } catch (e: any) { setErr(e.message); } }
  async function enviarMail() {
    if (!mailTo.trim()) { setMailMsg('Indicá un correo'); return; }
    setMailMsg('Enviando…');
    try { const r = await api.post<{ enviadas?: number; sinAlertas?: boolean }>('/alertas/enviar-mail', { to: mailTo, dias }); setMailMsg(r.sinAlertas ? 'Sin alertas para enviar.' : `Enviado (${r.enviadas} alertas).`); }
    catch (e: any) { setMailMsg('Error: ' + e.message); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [dias]);

  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Ventana de aviso</label>
          <select className="input" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            <option value={15}>Próximos 15 días</option><option value={30}>Próximos 30 días</option><option value={60}>Próximos 60 días</option><option value={90}>Próximos 90 días</option>
          </select>
        </div>
        {data && <div className="muted" style={{ alignSelf: 'center' }}>{data.resumen.total} alertas · {data.resumen.vencidos} vencidas · {data.resumen.urgentes} urgentes</div>}
        <div style={{ flex: 1 }} />
        <input className="input" style={{ maxWidth: 200 }} placeholder="correo destino" value={mailTo} onChange={(e) => setMailTo(e.target.value)} />
        <button className="btn ghost" onClick={enviarMail}>✉ Enviar por mail</button>
      </div>
      {mailMsg && <p className="muted" style={{ marginTop: -6 }}>{mailMsg}</p>}
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {data && !data.alertas.length && <p className="muted">Sin vencimientos en la ventana elegida. 👍</p>}
      {data && data.alertas.map((a, i) => (
        <div key={i} className="card" style={{ marginBottom: 8, borderLeft: `4px solid ${COLOR[a.severidad] || '#888'}` }}>
          <div className="row" style={{ alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div><span className="badge" style={{ marginRight: 8 }}>{a.tipo}</span><b>{a.titulo}</b></div>
              <div className="muted" style={{ fontSize: 13 }}>{a.detalle} · vence {fmt(a.fecha)}</div>
            </div>
            <div style={{ textAlign: 'right', color: COLOR[a.severidad] }}>
              <div style={{ fontWeight: 700 }}>{LABEL[a.severidad]}</div>
              <div className="muted" style={{ fontSize: 12 }}>{a.dias < 0 ? `hace ${-a.dias} días` : `en ${a.dias} días`}</div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
