import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import EmpleadoPicker from '../components/EmpleadoPicker';
import type { Empleado } from '../lib/types';

interface Tipo { tipo: string; label: string }
interface Doc { id: number; empleadoId: number; nom: string; legNum: string; empresa: string; tipo: string; tipoLabel: string; descripcion?: string; fechaEmision?: string; fechaVencimiento?: string; obs?: string }
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
const diasA = (s?: string) => s ? Math.round((new Date(s).getTime() - Date.now()) / 864e5) : null;

export default function LegajoDocs() {
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [items, setItems] = useState<Doc[]>([]);
  const [soloVencer, setSoloVencer] = useState(false);
  const [emp, setEmp] = useState<Empleado | null>(null);
  const [form, setForm] = useState<{ tipo: string; descripcion: string; fechaEmision: string; fechaVencimiento: string; obs: string }>({ tipo: 'examen_periodico', descripcion: '', fechaEmision: '', fechaVencimiento: '', obs: '' });
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  useEffect(() => { api.get<Tipo[]>('/legajo-docs/_tipos').then(setTipos).catch(() => {}); }, []);
  async function load() { try { setItems(await api.get<Doc[]>(`/legajo-docs${soloVencer ? '?porVencer=1&dias=60' : ''}`)); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [soloVencer]);

  async function guardar() {
    if (!emp) { setMsg({ t: 'Elegí un empleado', ok: false }); return; }
    if (!form.tipo) { setMsg({ t: 'Elegí el tipo', ok: false }); return; }
    try { await api.post('/legajo-docs', { empleadoId: emp.id, ...form }); setMsg({ t: 'Documento guardado', ok: true }); setForm({ tipo: 'examen_periodico', descripcion: '', fechaEmision: '', fechaVencimiento: '', obs: '' }); setEmp(null); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(d: Doc) { if (!confirm('¿Eliminar el documento?')) return; try { await api.del(`/legajo-docs/${d.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="grid2">
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Empleado</label><EmpleadoPicker onSelect={setEmp} /></div>
          <div className="field"><label>Tipo</label><select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{tipos.map((t) => <option key={t.tipo} value={t.tipo}>{t.label}</option>)}</select></div>
          <div className="field"><label>Descripción</label><input className="input" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
          <div className="field"><label>Fecha emisión</label><input className="input" type="date" value={form.fechaEmision} onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })} /></div>
          <div className="field"><label>Vencimiento</label><input className="input" type="date" value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Observaciones</label><input className="input" value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} /></div>
        </div>
        <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={guardar}>Guardar documento</button></div>
        {msg && <p className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 0 }}>{msg.t}</p>}
      </div>

      <div className="row" style={{ marginBottom: 8 }}><label className="row muted" style={{ gap: 6 }}><input type="checkbox" checked={soloVencer} onChange={(e) => setSoloVencer(e.target.checked)} /> Solo por vencer (60 días)</label></div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--bg2)' }}>{['Empleado', 'Documento', 'Descripción', 'Vencimiento', '', ''].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((d) => { const dd = diasA(d.fechaVencimiento); const col = dd == null ? undefined : dd < 0 ? '#b91c1c' : dd <= 30 ? '#b45309' : undefined; return (
              <tr key={d.id}>
                <td style={{ padding: '4px 8px' }}>{d.nom} <span className="muted">· {d.legNum}</span></td>
                <td style={{ padding: '4px 8px' }}>{d.tipoLabel}</td>
                <td style={{ padding: '4px 8px' }} className="muted">{d.descripcion || '—'}</td>
                <td style={{ padding: '4px 8px', color: col }}>{fmt(d.fechaVencimiento)}</td>
                <td style={{ padding: '4px 8px', color: col, fontSize: 12 }}>{dd == null ? '' : dd < 0 ? `vencido hace ${-dd}d` : `en ${dd}d`}</td>
                <td style={{ padding: '4px 8px' }}><button className="btn danger" onClick={() => borrar(d)}>Eliminar</button></td>
              </tr>); })}
            {!items.length && <tr><td colSpan={6} className="muted" style={{ padding: 10 }}>No hay documentos cargados.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
