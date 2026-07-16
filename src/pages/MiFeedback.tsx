import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Inv { solicitudId: number; periodo?: string; estado: string; competencias: string[]; relacion: string; respondido: boolean; evaluado: string; evaluadoLeg: string; }

export default function MiFeedback() {
  const [items, setItems] = useState<Inv[]>([]);
  const [resp, setResp] = useState<{ solId: number; puntajes: Record<string, number>; comentarios: Record<string, string> } | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() { api.get<Inv[]>('/mi-feedback').then(setItems).catch(() => {}); }
  useEffect(() => { cargar(); }, []);

  async function enviar(inv: Inv) {
    if (!resp) return;
    const respuestas = inv.competencias.map((c) => ({ competencia: c, puntaje: resp.puntajes[c] || 0, comentario: resp.comentarios[c] || '' }));
    try { await api.post(`/mi-feedback/${inv.solicitudId}/responder`, { respuestas }); setResp(null); setMsg({ t: '¡Gracias! Tu feedback fue registrado.', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  const pend = items.filter((i) => !i.respondido && i.estado === 'abierta');
  return (
    <>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {pend.length > 0 && <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid var(--yellow)' }}>Tenés <b>{pend.length}</b> evaluación(es) de feedback pendiente(s).</div>}
      {items.length === 0 && <div className="muted">No tenés evaluaciones de feedback asignadas.</div>}
      {items.map((inv) => (
        <div key={inv.solicitudId} className="card" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <b>Evaluar a {inv.evaluado}</b> <span className="muted">(leg. {inv.evaluadoLeg})</span>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Tu relación: {inv.relacion} · {inv.periodo || 'sin período'} · {inv.competencias.length} competencias</div>
            </div>
            {inv.respondido ? <span className="badge" style={{ color: 'var(--green)' }}>✔ Respondido</span>
              : inv.estado === 'abierta' ? <button className="btn primary" style={{ padding: '6px 14px' }} onClick={() => setResp({ solId: inv.solicitudId, puntajes: {}, comentarios: {} })}>Responder</button>
              : <span className="badge">cerrada</span>}
          </div>
          {resp?.solId === inv.solicitudId && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Puntuá de 0 a 5. Tu respuesta es anónima; solo se guarda tu relación.</div>
              {inv.competencias.map((c) => (
                <div key={c} className="row" style={{ gap: 8, alignItems: 'center', margin: '4px 0' }}>
                  <span style={{ width: 180, fontSize: 13 }}>{c}</span>
                  <select className="input" style={{ width: 70 }} value={resp.puntajes[c] || 0} onChange={(e) => setResp({ ...resp, puntajes: { ...resp.puntajes, [c]: Number(e.target.value) } })}>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                  <input className="input" style={{ flex: 1 }} placeholder="Comentario (opcional)" value={resp.comentarios[c] || ''} onChange={(e) => setResp({ ...resp, comentarios: { ...resp.comentarios, [c]: e.target.value } })} />
                </div>
              ))}
              <div className="row" style={{ gap: 6, marginTop: 8 }}><button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => enviar(inv)}>Enviar</button><button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setResp(null)}>Cancelar</button></div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
