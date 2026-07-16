import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Doc { id: number; titulo: string; descripcion: string; url?: string; created_at: string; firmado_at?: string | null; }
const fecha = (s?: string | null) => s ? new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export default function MisDocumentosFirma() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() { api.get<Doc[]>('/firmas/pendientes').then(setDocs).catch(() => {}); }
  useEffect(() => { cargar(); }, []);

  async function firmar(d: Doc) {
    if (!confirm(`Vas a firmar "${d.titulo}". Queda registrado tu nombre, fecha y hora. ¿Confirmás?`)) return;
    try { await api.post(`/firmas/${d.id}/firmar`, {}); setMsg({ t: 'Documento firmado ✓', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  const pend = docs.filter((d) => !d.firmado_at);
  return (
    <>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {pend.length > 0 && <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid var(--yellow)' }}>Tenés <b>{pend.length}</b> documento(s) pendiente(s) de firma.</div>}
      {docs.length === 0 && <div className="muted">No tenés documentos para firmar.</div>}
      {docs.map((d) => (
        <div key={d.id} className="card" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <b>{d.titulo}</b>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Publicado: {fecha(d.created_at)}</div>
            </div>
            {d.firmado_at
              ? <span className="badge" style={{ color: 'var(--green)' }}>✔ Firmado {fecha(d.firmado_at)}</span>
              : <button className="btn primary" style={{ padding: '6px 14px' }} onClick={() => firmar(d)}>Firmar</button>}
          </div>
          {d.descripcion && <div style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 14 }}>{d.descripcion}</div>}
          {d.url && <div style={{ marginTop: 8 }}><a href={d.url} target="_blank" rel="noreferrer">📄 Abrir documento</a></div>}
        </div>
      ))}
    </>
  );
}
