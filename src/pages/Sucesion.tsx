import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';
import EmpleadoPicker from '../components/EmpleadoPicker';

// Planes de sucesión por puesto (estilo Meta4).
interface Puesto { id: number; codigo: string; nombre: string; area?: string; }
const READY: [string, string][] = [['inmediato', 'Listo ya'], ['corto', 'Corto plazo (≤1 año)'], ['mediano', 'Mediano (1-2 años)'], ['largo', 'Largo (3+ años)']];
const readyLbl = (r: string) => READY.find(([v]) => v === r)?.[1] || r;

export default function Sucesion() {
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [pid, setPid] = useState('');
  const [suc, setSuc] = useState<any[]>([]);
  const [readiness, setReadiness] = useState('mediano'); const [nota, setNota] = useState('');
  const [nuevo, setNuevo] = useState<Empleado | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.get<Puesto[]>('/puestos').then(setPuestos).catch((e) => setErr(e.message)); }, []);
  async function load(id: string) { setPid(id); setErr(''); if (!id) { setSuc([]); return; } try { setSuc(await api.get<any[]>(`/talento/sucesiones/${id}`)); } catch (e: any) { setErr(e.message); } }
  async function agregar() { if (!pid || !nuevo) return; try { await api.post(`/talento/sucesiones/${pid}`, { empleadoId: nuevo.id, readiness, nota }); setNuevo(null); setNota(''); load(pid); } catch (e: any) { setErr(e.message); } }
  async function borrar(id: number) { try { await api.del(`/talento/sucesiones/${id}`); load(pid); } catch (e: any) { setErr(e.message); } }

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      <p className="muted" style={{ marginTop: 0 }}>Definí los sucesores posibles para cada puesto y su grado de preparación.</p>
      <div className="card" style={{ marginBottom: 14, maxWidth: 480 }}>
        <div className="field"><label>Puesto</label>
          <select className="input" value={pid} onChange={(e) => load(e.target.value)}>
            <option value="">Elegí un puesto…</option>
            {puestos.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.area ? ' · ' + p.area : ''}</option>)}
          </select>
        </div>
      </div>

      {pid && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Sucesores <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({suc.length})</span></h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg2)' }}>{['Empleado', 'Preparación', 'Nota', ''].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {suc.map((s) => (
                <tr key={s.id}>
                  <td style={{ padding: '4px 8px' }}>{s.nom} <span className="muted">({s.leg_num})</span></td>
                  <td style={{ padding: '4px 8px' }}>{readyLbl(s.readiness)}</td>
                  <td style={{ padding: '4px 8px' }} className="muted">{s.nota || '—'}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}><button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => borrar(s.id)}>✕</button></td>
                </tr>
              ))}
              {!suc.length && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 12 }}>Sin sucesores cargados.</td></tr>}
            </tbody>
          </table>
          <div className="row" style={{ gap: 8, marginTop: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 240 }}><label className="muted" style={{ fontSize: 12 }}>Agregar sucesor</label><EmpleadoPicker onSelect={setNuevo} /></div>
            <div className="field"><label>Preparación</label><select className="input" value={readiness} onChange={(e) => setReadiness(e.target.value)}>{READY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
            <button className="btn" onClick={agregar} disabled={!nuevo}>Agregar</button>
          </div>
        </div>
      )}
    </>
  );
}
