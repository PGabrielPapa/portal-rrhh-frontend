import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Encuestas disponibles para el empleado (responder).
export default function MisEncuestas() {
  const [encs, setEncs] = useState<any[]>([]);
  const [resp, setResp] = useState<Record<number, any>>({});
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');

  async function load() { try { setEncs(await api.get<any[]>('/encuestas/disponibles')); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { load(); }, []);

  const setR = (encId: number, pregId: number, campo: string, valor: any) =>
    setResp((s) => ({ ...s, [encId]: { ...(s[encId] || {}), [pregId]: { ...((s[encId] || {})[pregId] || {}), [campo]: valor } } }));

  async function enviar(enc: any) {
    setErr(''); setMsg('');
    const r = resp[enc.id] || {};
    const respuestas = enc.preguntas.map((p: any) => ({ preguntaId: p.id, valor: r[p.id]?.valor, texto: r[p.id]?.texto }));
    try { await api.post(`/encuestas/${enc.id}/responder`, { respuestas }); setMsg('¡Gracias por responder!'); load(); }
    catch (e: any) { setErr(e.message); }
  }

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}
      {!encs.length && <p className="muted">No tenés encuestas pendientes de responder.</p>}
      {encs.map((e) => (
        <div key={e.id} className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>{e.titulo} {e.anonima && <span className="badge">anónima</span>}</h3>
          {e.descripcion && <p className="muted" style={{ marginTop: 0 }}>{e.descripcion}</p>}
          {e.preguntas.map((p: any) => (
            <div key={p.id} className="field" style={{ marginBottom: 10 }}>
              <label>{p.texto}</label>
              {p.tipo === 'escala' ? (
                <div className="row" style={{ gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const on = (resp[e.id]?.[p.id]?.valor) === n;
                    return <button key={n} type="button" className={`btn ${on ? 'primary' : 'ghost'}`} style={{ padding: '4px 12px' }} onClick={() => setR(e.id, p.id, 'valor', n)}>{n}</button>;
                  })}
                  <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>1 = muy en desacuerdo · 5 = muy de acuerdo</span>
                </div>
              ) : p.tipo === 'nps' ? (
                <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                    const on = (resp[e.id]?.[p.id]?.valor) === n;
                    return <button key={n} type="button" className={`btn ${on ? 'primary' : 'ghost'}`} style={{ padding: '4px 10px' }} onClick={() => setR(e.id, p.id, 'valor', n)}>{n}</button>;
                  })}
                  <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>0 = nada probable · 10 = muy probable</span>
                </div>
              ) : (
                <textarea className="input" rows={2} value={resp[e.id]?.[p.id]?.texto || ''} onChange={(ev) => setR(e.id, p.id, 'texto', ev.target.value)} />
              )}
            </div>
          ))}
          <button className="btn primary" onClick={() => enviar(e)}>Enviar respuestas</button>
        </div>
      ))}
    </>
  );
}
