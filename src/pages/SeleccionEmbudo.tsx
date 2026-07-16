import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Busqueda { id: number; titulo: string; estado: string; candidatos: number; }
interface Crit { criterio: string; peso: number; puntaje: number; }
interface Cand { id: number; nombre: string; email?: string; etapa: string; origen?: string | null; puntaje?: number | null; evaluacion?: Crit[]; }
interface Embudo { embudo: { etapa: string; n: number }[]; porOrigen: { origen: string; n: number }[]; total: number; contratados: number; tasaConversion: number; }

const ORIGENES = ['referido', 'portal', 'linkedin', 'consultora', 'otro'];
const CRITERIOS = ['Experiencia', 'Competencias técnicas', 'Ajuste cultural'];
const ETAPA_LBL: Record<string, string> = { postulado: 'Postulado', entrevista: 'Entrevista', oferta: 'Oferta', contratado: 'Contratado', descartado: 'Descartado' };

export default function SeleccionEmbudo() {
  const [busquedas, setBusquedas] = useState<Busqueda[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [cands, setCands] = useState<Cand[]>([]);
  const [emb, setEmb] = useState<Embudo | null>(null);
  const [scores, setScores] = useState<Record<number, Record<string, number>>>({});
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.get<Busqueda[]>('/reclutamiento/busquedas').then((b) => { setBusquedas(b); if (b[0]) setSel(b[0].id); }).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { if (sel != null) cargar(sel); /* eslint-disable-next-line */ }, [sel]);

  async function cargar(id: number) {
    setErr('');
    try {
      const [c, e] = await Promise.all([
        api.get<Cand[]>(`/reclutamiento/busquedas/${id}/candidatos`),
        api.get<Embudo>(`/reclutamiento/embudo?busquedaId=${id}`),
      ]);
      setCands(c); setEmb(e);
      const sc: Record<number, Record<string, number>> = {};
      for (const cand of c) { sc[cand.id] = {}; for (const cr of CRITERIOS) { const found = (cand.evaluacion || []).find((x) => x.criterio === cr); sc[cand.id][cr] = found ? found.puntaje : 0; } }
      setScores(sc);
    } catch (e2: any) { setErr(e2.message); }
  }
  async function guardarEval(c: Cand) {
    const s = scores[c.id] || {};
    const evaluacion = CRITERIOS.map((cr) => ({ criterio: cr, peso: 1, puntaje: Number(s[cr]) || 0 }));
    try { await api.patch(`/reclutamiento/candidatos/${c.id}`, { evaluacion }); setMsg({ t: `Evaluación de ${c.nombre} guardada`, ok: true }); cargar(sel!); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function cambiarOrigen(c: Cand, origen: string) {
    try { await api.patch(`/reclutamiento/candidatos/${c.id}`, { origen: origen || null }); cargar(sel!); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  const maxEmb = emb ? Math.max(1, ...emb.embudo.map((e) => e.n)) : 1;

  return (
    <>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      <div className="row" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Búsqueda</label>
          <select className="input" style={{ minWidth: 260 }} value={sel ?? ''} onChange={(e) => setSel(Number(e.target.value))}>
            {busquedas.map((b) => <option key={b.id} value={b.id}>{b.titulo} {b.estado === 'cerrada' ? '(cerrada)' : ''} · {b.candidatos} cand.</option>)}
          </select>
        </div>
      </div>

      {emb && <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 14 }}>
        <div className="card" style={{ flex: '1 1 340px' }}>
          <h4 style={{ marginTop: 0 }}>Embudo de selección</h4>
          {emb.embudo.map((e) => (
            <div key={e.etapa} className="row" style={{ alignItems: 'center', gap: 8, margin: '6px 0' }}>
              <span style={{ width: 100, fontSize: 13 }}>{ETAPA_LBL[e.etapa] || e.etapa}</span>
              <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round((e.n / maxEmb) * 100)}%`, minWidth: e.n ? 20 : 0, background: 'rgba(61,127,255,.6)', height: 18 }} />
              </div>
              <b style={{ width: 28, textAlign: 'right' }}>{e.n}</b>
            </div>
          ))}
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Tasa de conversión (contratados / total): <b>{emb.tasaConversion}%</b></div>
        </div>
        <div className="card" style={{ flex: '1 1 240px' }}>
          <h4 style={{ marginTop: 0 }}>Por origen</h4>
          {emb.porOrigen.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>Sin datos.</div>
            : emb.porOrigen.map((o) => <div key={o.origen} className="row" style={{ justifyContent: 'space-between' }}><span style={{ textTransform: 'capitalize' }}>{o.origen}</span><b>{o.n}</b></div>)}
        </div>
      </div>}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Candidato</th><th>Etapa</th><th>Origen</th>{CRITERIOS.map((c) => <th key={c} style={{ fontSize: 11 }}>{c}</th>)}<th style={{ textAlign: 'right' }}>Puntaje</th><th></th></tr></thead>
          <tbody>
            {cands.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}{c.email && <span className="muted"> · {c.email}</span>}</td>
                <td><span className="badge">{ETAPA_LBL[c.etapa] || c.etapa}</span></td>
                <td>
                  <select className="input" style={{ padding: '2px 6px', fontSize: 12, width: 120 }} value={c.origen || ''} onChange={(e) => cambiarOrigen(c, e.target.value)}>
                    <option value="">—</option>{ORIGENES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                {CRITERIOS.map((cr) => (
                  <td key={cr}><input className="input" style={{ width: 62, padding: '2px 6px' }} type="number" min={0} max={100} value={(scores[c.id]?.[cr]) ?? 0}
                    onChange={(e) => setScores((s) => ({ ...s, [c.id]: { ...(s[c.id] || {}), [cr]: Number(e.target.value) } }))} /></td>
                ))}
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{c.puntaje != null ? c.puntaje.toFixed(0) : '—'}</td>
                <td style={{ textAlign: 'right' }}><button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => guardarEval(c)}>Guardar</button></td>
              </tr>
            ))}
            {!cands.length && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>Esta búsqueda no tiene candidatos. Cargalos en «Reclutamiento / Selección».</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>El puntaje es el promedio ponderado de los criterios (0-100). El movimiento de etapas se sigue haciendo en «Reclutamiento / Selección».</p>
    </>
  );
}
