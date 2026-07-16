import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Com { id: number; titulo: string; cuerpo: string; fijado: boolean; leidos: number; createdAt: string; }
interface Rank { nom: string; leg_num: string; n: number; }
const fecha = (s: string) => new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ComunicadosRRHH() {
  const [coms, setComs] = useState<Com[]>([]);
  const [rank, setRank] = useState<Rank[]>([]);
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [fijado, setFijado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() {
    api.get<Com[]>('/comunicaciones/comunicados').then(setComs).catch(() => {});
    api.get<Rank[]>('/comunicaciones/reconocimientos/ranking').then(setRank).catch(() => {});
  }
  useEffect(() => { cargar(); }, []);

  async function publicar() {
    if (!titulo.trim()) return;
    try { await api.post('/comunicaciones/comunicados', { titulo: titulo.trim(), cuerpo, fijado }); setTitulo(''); setCuerpo(''); setFijado(false); setMsg({ t: 'Comunicado publicado', ok: true }); cargar(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function toggleFijar(c: Com) { try { await api.patch(`/comunicaciones/comunicados/${c.id}`, { fijado: !c.fijado }); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  async function borrar(c: Com) { if (!confirm('¿Borrar el comunicado?')) return; try { await api.del(`/comunicaciones/comunicados/${c.id}`); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      <div className="card" style={{ marginBottom: 14 }}>
        <h4 style={{ marginTop: 0 }}>Nuevo comunicado</h4>
        <div className="field" style={{ marginBottom: 8 }}><label>Título</label><input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div className="field" style={{ marginBottom: 8 }}><label>Cuerpo</label><textarea className="input" rows={4} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} /></div>
        <label className="row" style={{ gap: 6, fontSize: 13, marginBottom: 8 }}><input type="checkbox" checked={fijado} onChange={(e) => setFijado(e.target.checked)} /> Fijar arriba del muro</label>
        <button className="btn" onClick={publicar} disabled={!titulo.trim()}>Publicar</button>
      </div>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '2 1 340px' }}>
          <h4 style={{ marginTop: 0 }}>Comunicados publicados</h4>
          {coms.map((c) => (
            <div key={c.id} className="card" style={{ marginBottom: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div><b>{c.fijado ? '📌 ' : ''}{c.titulo}</b><div className="muted" style={{ fontSize: 12 }}>{fecha(c.createdAt)} · {c.leidos} leído(s)</div></div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => toggleFijar(c)}>{c.fijado ? 'Desfijar' : 'Fijar'}</button>
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => borrar(c)}>Borrar</button>
                </div>
              </div>
            </div>
          ))}
          {!coms.length && <div className="muted">No hay comunicados.</div>}
        </div>
        <div style={{ flex: '1 1 240px' }}>
          <h4 style={{ marginTop: 0 }}>Ranking de reconocimientos</h4>
          {rank.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>Sin reconocimientos aún.</div>
            : rank.map((r, i) => <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}><span>{i + 1}. {r.nom}</span><b>{r.n}</b></div>)}
        </div>
      </div>
    </>
  );
}
