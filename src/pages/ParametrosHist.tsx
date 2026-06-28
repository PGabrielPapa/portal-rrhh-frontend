import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Ver { id: number; vigencia_desde: string; nota?: string; updated_by?: string; updated_at?: string }
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };

export default function ParametrosHist() {
  const [items, setItems] = useState<Ver[]>([]);
  const [vig, setVig] = useState(new Date().toISOString().slice(0, 8) + '01');
  const [nota, setNota] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  async function load() { try { setItems(await api.get<Ver[]>('/parametros/periodos')); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); }, []);

  async function crear() {
    if (!vig) { setMsg({ t: 'Indicá la vigencia', ok: false }); return; }
    try { await api.post('/parametros/periodos', { vigenciaDesde: vig, nota }); setMsg({ t: 'Versión creada (foto de los parámetros actuales).', ok: true }); setNota(''); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(v: Ver) { if (!confirm(`¿Eliminar la versión con vigencia ${fmt(v.vigencia_desde)}?`)) return; try { await api.del(`/parametros/periodos/${v.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          Guardá una <b>foto de los parámetros de liquidación</b> con una fecha de vigencia. Al liquidar (o reliquidar) un período,
          el sistema usa automáticamente la versión vigente a esa fecha. Si no hay versión, usa los parámetros actuales.
        </p>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field"><label>Vigencia desde</label><input className="input" type="date" value={vig} onChange={(e) => setVig(e.target.value)} /></div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Nota</label><input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ej: aumento aportes / nueva escala" /></div>
          <button className="btn" onClick={crear}>Crear versión (foto actual)</button>
        </div>
        {msg && <p className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 0 }}>{msg.t}</p>}
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--bg2)' }}>{['Vigencia', 'Nota', 'Guardado por', 'Fecha', ''].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((v, idx) => (
              <tr key={v.id} style={idx === 0 ? { background: 'rgba(34,197,94,.08)' } : undefined}>
                <td style={{ padding: '4px 8px' }}>{fmt(v.vigencia_desde)} {idx === 0 && <span className="badge" style={{ marginLeft: 6 }}>más reciente</span>}</td>
                <td style={{ padding: '4px 8px' }} className="muted">{v.nota || '—'}</td>
                <td style={{ padding: '4px 8px' }}>{v.updated_by || '—'}</td>
                <td style={{ padding: '4px 8px' }}>{fmt(v.updated_at)}</td>
                <td style={{ padding: '4px 8px' }}><button className="btn danger" onClick={() => borrar(v)}>Eliminar</button></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={5} className="muted" style={{ padding: 10 }}>No hay versiones. Se usan los parámetros actuales.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
