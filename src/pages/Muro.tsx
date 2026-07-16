import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import EmpleadoPicker from '../components/EmpleadoPicker';

interface Com { id: number; titulo: string; cuerpo: string; fijado: boolean; leido: boolean; leidos: number; createdAt: string; }
interface Rec { id: number; valor?: string; mensaje: string; de: string; para: string; paraLeg: string; createdAt: string; }
const VALORES = ['Trabajo en equipo', 'Compromiso', 'Actitud', 'Innovación', 'Foco en el cliente', 'Ayuda a un par'];
const fecha = (s: string) => new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

export default function Muro() {
  const [coms, setComs] = useState<Com[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [para, setPara] = useState<number | null>(null);
  const [valor, setValor] = useState(VALORES[0]);
  const [mensaje, setMensaje] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() {
    api.get<Com[]>('/comunicaciones/comunicados').then(setComs).catch(() => {});
    api.get<Rec[]>('/comunicaciones/reconocimientos').then(setRecs).catch(() => {});
  }
  useEffect(() => { cargar(); }, []);

  async function marcarLeido(c: Com) { try { await api.post(`/comunicaciones/comunicados/${c.id}/leido`, {}); setComs((cs) => cs.map((x) => x.id === c.id ? { ...x, leido: true, leidos: x.leidos + 1 } : x)); } catch { /* noop */ } }
  async function reconocer() {
    if (!para) { setMsg({ t: 'Elegí a quién reconocer', ok: false }); return; }
    try { await api.post('/comunicaciones/reconocimientos', { paraEmpleadoId: para, valor, mensaje: mensaje.trim() }); setMensaje(''); setPara(null); setMsg({ t: '¡Reconocimiento enviado!', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  return (
    <>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '2 1 340px', minWidth: 300 }}>
          <h4 style={{ marginTop: 0 }}>Comunicados</h4>
          {coms.length === 0 && <div className="muted">No hay comunicados por ahora.</div>}
          {coms.map((c) => (
            <div key={c.id} className="card" style={{ marginBottom: 10, borderLeft: c.fijado ? '3px solid var(--accent2)' : undefined }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <b>{c.fijado ? '📌 ' : ''}{c.titulo}</b>
                <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fecha(c.createdAt)}</span>
              </div>
              {c.cuerpo && <div style={{ whiteSpace: 'pre-wrap', marginTop: 6, fontSize: 14 }}>{c.cuerpo}</div>}
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                {c.leido ? <span className="badge" style={{ color: 'var(--green)' }}>✔ Leído</span>
                  : <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => marcarLeido(c)}>Marcar como leído</button>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: '1 1 280px', minWidth: 260 }}>
          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ marginTop: 0 }}>Reconocer a un compañero</h4>
            <div className="field" style={{ marginBottom: 8 }}><label>Para</label><EmpleadoPicker onSelect={(e) => setPara(e ? e.id : null)} /></div>
            <div className="field" style={{ marginBottom: 8 }}><label>Valor</label><select className="input" value={valor} onChange={(e) => setValor(e.target.value)}>{VALORES.map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
            <div className="field" style={{ marginBottom: 8 }}><label>Mensaje</label><textarea className="input" rows={2} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="¡Gracias por…!" /></div>
            <button className="btn" onClick={reconocer}>Enviar reconocimiento</button>
          </div>
          <h4 style={{ marginTop: 0 }}>Reconocimientos recientes</h4>
          {recs.length === 0 && <div className="muted">Todavía no hay reconocimientos.</div>}
          {recs.map((r) => (
            <div key={r.id} className="card" style={{ marginBottom: 8, padding: 10 }}>
              <div style={{ fontSize: 13 }}>🏅 <b>{r.para}</b> {r.valor && <span className="badge" style={{ marginLeft: 4 }}>{r.valor}</span>}</div>
              {r.mensaje && <div style={{ fontSize: 13, marginTop: 4 }}>“{r.mensaje}”</div>}
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>de {r.de} · {fecha(r.createdAt)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
