import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import Avatar from '../components/Avatar';

interface Ocupante { id: number; nom: string; legNum?: string; empresa?: string; cat?: string; tramo?: string; lugar?: string; tarea?: string; foto?: string; }
interface PNode { id: number; codigo: string; nombre: string; area: string; goToHr: boolean; ocupantes: Ocupante[]; hijos: PNode[]; totalRecursivo: number; }
interface OrgResp { raices: PNode[]; empresas: string[]; totalEmpleados: number; totalPuestos: number; }

const legD = (l?: string) => String(l || '').replace(/\D/g, '').padStart(6, '0');

function Nodo({ nodo, nivel, exp, toggle, q }: { nodo: PNode; nivel: number; exp: Set<number>; toggle: (k: number) => void; q: string }) {
  const abierto = exp.has(nodo.id);
  const tieneHijos = nodo.hijos.length > 0 || nodo.ocupantes.length > 0;
  const color = nivel === 0 ? 'var(--accent2)' : nivel === 1 ? 'rgb(168,85,247)' : 'var(--green)';
  const match = (s: string) => q && s.toLowerCase().includes(q.toLowerCase());

  return (
    <div style={{ marginLeft: nivel ? 18 : 0, marginBottom: 6 }}>
      <div className="card" style={{ padding: '8px 12px', borderLeft: `3px solid ${color}`, cursor: tieneHijos ? 'pointer' : 'default' }}
        onClick={() => tieneHijos && toggle(nodo.id)}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <div>
            <strong style={{ color }}>{tieneHijos ? (abierto ? '▾ ' : '▸ ') : '• '}{nodo.nombre}</strong>
            {nodo.codigo && nodo.codigo !== '—' && <span className="muted" style={{ fontSize: 11, marginLeft: 8, fontFamily: 'monospace' }}>{nodo.codigo}</span>}
            {nodo.goToHr && <span className="badge" style={{ marginLeft: 8, fontSize: 10 }}>RR.HH.</span>}
            {nodo.area && <div style={{ fontSize: 11, color, fontFamily: 'monospace' }}>{nodo.area}</div>}
          </div>
          <span className="badge" style={{ flexShrink: 0 }}>{nodo.totalRecursivo} pers.</span>
        </div>
      </div>

      {abierto && nodo.ocupantes.length > 0 && (
        <div style={{ margin: '4px 0 4px 18px' }}>
          <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Ocupantes ({nodo.ocupantes.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {nodo.ocupantes.slice().sort((a, b) => a.nom.localeCompare(b.nom)).map((d) => {
              const tarea = d.tarea || [d.cat, d.tramo].filter(Boolean).join(' ');
              return (
                <div key={d.id}
                  style={{ background: 'var(--bg2)', border: `1px solid ${match(d.nom) ? 'rgba(234,179,8,.6)' : 'var(--border)'}`, borderRadius: 'var(--r)', padding: '5px 9px', fontSize: 12, minWidth: 180, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Avatar nombre={d.nom} foto={d.foto} size={24} />
                  <div>
                    <div>{d.nom} <span className="muted" style={{ fontFamily: 'monospace' }}>({legD(d.legNum)})</span></div>
                    <div className="muted" style={{ fontSize: 10, fontFamily: 'monospace' }}>
                      🏢 {d.empresa || '—'}{tarea ? ` · 💼 ${tarea}` : ''}{d.lugar ? ` · 📍 ${d.lugar}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {abierto && nodo.hijos.map((h) => <Nodo key={h.id} nodo={h} nivel={nivel + 1} exp={exp} toggle={toggle} q={q} />)}
    </div>
  );
}

export default function Organigrama() {
  const { user } = useAuth();
  const [data, setData] = useState<OrgResp>({ raices: [], empresas: [], totalEmpleados: 0, totalPuestos: 0 });
  const [empresa, setEmpresa] = useState('');
  const [q, setQ] = useState('');
  const [expandido, setExpandido] = useState<Set<number>>(new Set());
  const [autoHecho, setAutoHecho] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(); if (empresa) p.set('empresa', empresa);
    api.get<OrgResp>(`/puestos/organigrama?${p}`).then(setData).catch((e: any) => setErr(e.message));
  }, [empresa]);

  // Auto-expandir la rama del usuario logueado la primera vez.
  useEffect(() => {
    if (autoHecho || !user?.nom || !data.raices.length) return;
    const mi = String(user.nom).toUpperCase().trim();
    const ids: number[] = [];
    const buscar = (n: PNode, camino: number[]): boolean => {
      const acá = n.ocupantes.some((o) => o.nom.toUpperCase().trim() === mi);
      let hijo = false;
      for (const h of n.hijos) if (buscar(h, [...camino, n.id])) hijo = true;
      if (acá || hijo) { ids.push(n.id, ...camino); return true; }
      return false;
    };
    data.raices.forEach((r) => buscar(r, []));
    if (ids.length) { setExpandido(new Set(ids)); setAutoHecho(true); }
  }, [data, user, autoHecho]);

  const todosIds = useMemo(() => { const s: number[] = []; const w = (n: PNode) => { s.push(n.id); n.hijos.forEach(w); }; data.raices.forEach(w); return s; }, [data]);

  const { visibles, autoExpand } = useMemo(() => {
    if (!q.trim()) return { visibles: data.raices, autoExpand: null as Set<number> | null };
    const ql = q.toLowerCase();
    const matchNodo = (n: PNode): boolean =>
      n.nombre.toLowerCase().includes(ql) || (n.area || '').toLowerCase().includes(ql) ||
      n.ocupantes.some((o) => o.nom.toLowerCase().includes(ql) || legD(o.legNum).includes(ql.replace(/\D/g, ''))) ||
      n.hijos.some(matchNodo);
    const exp = new Set<number>();
    const marcar = (n: PNode) => { if (matchNodo(n)) { exp.add(n.id); n.hijos.forEach(marcar); } };
    data.raices.forEach(marcar);
    return { visibles: data.raices.filter(matchNodo), autoExpand: exp };
  }, [q, data]);

  const exp = autoExpand || expandido;
  const toggle = (k: number) => { if (autoExpand) return; setExpandido((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; }); };

  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 220 }} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="">Todas las empresas</option>
          {data.empresas.map((em) => <option key={em} value={em}>{em}</option>)}
        </select>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Buscar puesto, persona o legajo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn ghost" onClick={() => setExpandido(new Set(todosIds))} disabled={!!autoExpand}>Expandir todo</button>
        <button className="btn ghost" onClick={() => setExpandido(new Set())} disabled={!!autoExpand}>Colapsar</button>
        <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>{data.totalEmpleados} empleados · {data.totalPuestos} puestos</span>
      </div>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {!visibles.length && <div className="muted">Sin datos de organigrama para los filtros aplicados.</div>}
      {visibles.map((r) => <Nodo key={r.id} nodo={r} nivel={0} exp={exp} toggle={toggle} q={q} />)}
    </>
  );
}
