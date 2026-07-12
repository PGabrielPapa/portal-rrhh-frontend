import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Descripción / perfil de puestos (estilo Meta4 PeopleNet): misión, funciones, requisitos, competencias.
interface Puesto { id: number; codigo: string; nombre: string; area?: string; perfil?: any; }
const CAMPOS: [string, string, boolean][] = [
  ['mision', 'Misión del puesto', true],
  ['funciones', 'Funciones principales', true],
  ['requisitos', 'Requisitos (formación / experiencia)', true],
  ['competencias', 'Competencias requeridas', true],
  ['reportaA', 'Reporta a', false],
  ['aCargo', 'Personal a cargo', false],
];

export default function DescripcionPuestos() {
  const [items, setItems] = useState<Puesto[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Puesto | null>(null);
  const [f, setF] = useState<any>({});
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  async function load() { try { setItems(await api.get<Puesto[]>('/puestos')); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { load(); }, []);

  function abrir(p: Puesto) { setSel(p); setF({ ...(p.perfil || {}) }); setMsg(''); setErr(''); }
  async function guardar() {
    if (!sel) return; setErr(''); setMsg('');
    try { await api.put(`/puestos/${sel.id}/perfil`, f); setMsg('Descripción guardada.'); load(); }
    catch (e: any) { setErr(e.message); }
  }
  const filtrados = items.filter((p) => !q || `${p.codigo} ${p.nombre} ${p.area || ''}`.toLowerCase().includes(q.toLowerCase()));
  const tienePerfil = (p: Puesto) => p.perfil && Object.values(p.perfil).some((v) => String(v || '').trim());

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}
      <p className="muted" style={{ marginTop: 0 }}>Definí el perfil de cada puesto: misión, funciones, requisitos y competencias. Sirve para búsquedas, evaluaciones y sucesión.</p>

      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '0 0 320px', maxWidth: 340 }}>
          <input className="input" placeholder="Buscar puesto…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ maxHeight: 460, overflow: 'auto' }}>
            {filtrados.map((p) => (
              <div key={p.id} onClick={() => abrir(p)} style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 8, background: sel?.id === p.id ? 'rgba(61,127,255,.12)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13 }}>{p.nombre} {tienePerfil(p) ? <span className="badge" style={{ color: 'var(--green)' }}>✓ perfil</span> : <span className="badge muted">sin perfil</span>}</div>
                <div className="muted" style={{ fontSize: 11 }}>{p.codigo}{p.area ? ' · ' + p.area : ''}</div>
              </div>
            ))}
            {!filtrados.length && <div className="muted" style={{ padding: 10 }}>Sin puestos.</div>}
          </div>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          {!sel ? <div className="muted">Elegí un puesto de la lista para editar su descripción.</div> : (<>
            <h3 style={{ marginTop: 0 }}>{sel.nombre} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>{sel.codigo}{sel.area ? ' · ' + sel.area : ''}</span></h3>
            {CAMPOS.map(([k, label, multi]) => (
              <div className="field" key={k} style={{ marginBottom: 10 }}>
                <label>{label}</label>
                {multi
                  ? <textarea className="input" rows={3} value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                  : <input className="input" value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
              </div>
            ))}
            <button className="btn primary" onClick={guardar}>Guardar descripción</button>
          </>)}
        </div>
      </div>
    </>
  );
}
