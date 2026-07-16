import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Curso { inscripcionId: number; nombre: string; descripcion?: string; modalidad?: string; horas: number; estado: string; modulos: number; completos: number; pct: number; }
interface Modulo { id: number; titulo: string; tipo: string; url?: string; completado: boolean; }

export default function MiFormacion() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [mods, setMods] = useState<Record<number, Modulo[]>>({});
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() { api.get<Curso[]>('/mi-formacion').then(setCursos).catch(() => {}); }
  useEffect(() => { cargar(); }, []);

  async function abrir(c: Curso) {
    if (abierto === c.inscripcionId) { setAbierto(null); return; }
    setAbierto(c.inscripcionId);
    if (!mods[c.inscripcionId]) {
      try { const m = await api.get<Modulo[]>(`/mi-formacion/${c.inscripcionId}/modulos`); setMods((s) => ({ ...s, [c.inscripcionId]: m })); }
      catch (e: any) { setMsg({ t: e.message, ok: false }); }
    }
  }
  async function toggle(insId: number, m: Modulo) {
    try {
      await api.put(`/mi-formacion/${insId}/modulos/${m.id}`, { completado: !m.completado });
      setMods((s) => ({ ...s, [insId]: s[insId].map((x) => x.id === m.id ? { ...x, completado: !x.completado } : x) }));
      cargar();
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  return (
    <>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {cursos.length === 0 && <div className="muted">No estás inscripto en cursos por ahora.</div>}
      {cursos.map((c) => (
        <div key={c.inscripcionId} className="card" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => abrir(c)}>
            <div>
              <b>{c.nombre}</b> {c.modalidad && <span className="badge" style={{ marginLeft: 4 }}>{c.modalidad}</span>}
              {c.descripcion && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{c.descripcion}</div>}
            </div>
            <div style={{ textAlign: 'right', minWidth: 90 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: c.pct === 100 ? 'var(--green)' : 'var(--accent2)' }}>{c.pct}%</div>
              <div className="muted" style={{ fontSize: 11 }}>{c.completos}/{c.modulos} módulos</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: `${c.pct}%`, height: 8, background: c.pct === 100 ? 'rgba(34,197,94,.7)' : 'rgba(61,127,255,.6)' }} />
          </div>
          {abierto === c.inscripcionId && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              {(mods[c.inscripcionId] || []).length === 0 && <div className="muted" style={{ fontSize: 13 }}>Este curso todavía no tiene contenidos cargados.</div>}
              {(mods[c.inscripcionId] || []).map((m) => (
                <div key={m.id} className="row" style={{ alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <input type="checkbox" checked={m.completado} onChange={() => toggle(c.inscripcionId, m)} />
                  <span style={{ flex: 1, fontSize: 13, textDecoration: m.completado ? 'line-through' : undefined, opacity: m.completado ? .7 : 1 }}>{m.titulo} <span className="badge" style={{ marginLeft: 4 }}>{m.tipo}</span></span>
                  {m.url && <a href={m.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>abrir</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
