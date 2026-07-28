import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { groupsForRole } from '../lib/sections';
import ErrorBoundary from './ErrorBoundary';

// Tarea delegada → item de menú (misma pantalla que usa el gerente).
const DELEG_ITEM: Record<string, { key: string; label: string }> = {
  fichadas: { key: 'fichadas-equipo', label: 'Fichadas del equipo (delegado)' },
  licencias: { key: 'licencias-equipo', label: 'Licencias del equipo (delegado)' },
  adelantos: { key: 'aprobaciones', label: 'Adelantos del equipo (delegado)' },
  evaluaciones: { key: 'evaluaciones-equipo', label: 'Evaluaciones del equipo (delegado)' },
};

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false); // sidebar off-canvas en celular
  const groups = groupsForRole(user?.role || 'employee', { comiteHys: !!user?.comiteHys, comiteAcceso: user?.acceso, modulosOcultos: user?.modulosOcultos });

  // Paneles colapsables: se recuerda qué grupos quedan abiertos (localStorage) y por
  // defecto se abre el del módulo que estás viendo.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('prh_menu_groups') || '{}'); } catch { return {}; }
  });
  const currentKey = loc.pathname.startsWith('/m/') ? loc.pathname.slice(3) : '';
  const activePanel = groups.find((g) => g.items.some((it) => it.key === currentKey))?.panel || '';
  const activeEsRRHH = groups.some((g) => g.area === 'rrhh' && g.panel === activePanel);
  const isGroupOpen = (panel: string, def = false) => (panel in openGroups ? openGroups[panel] : def);
  const toggleGroup = (panel: string, def = false) => setOpenGroups((prev) => {
    const cur = panel in prev ? prev[panel] : def;
    const next = { ...prev, [panel]: !cur };
    try { localStorage.setItem('prh_menu_groups', JSON.stringify(next)); } catch { /* noop */ }
    return next;
  });

  // Delegaciones recibidas → grupo dinámico "Delegado a mí" (solo para no-gerentes;
  // los gerentes ya ven esas pantallas y el equipo delegado aparece dentro).
  const [delegItems, setDelegItems] = useState<{ key: string; label: string; ready?: boolean }[]>([]);
  useEffect(() => {
    if (!user || user.role === 'manager' || user.role === 'admin') { setDelegItems([]); return; }
    api.get<{ tarea: string }[]>('/delegaciones/recibidas').then((rows) => {
      const seen = new Set<string>(); const items: { key: string; label: string; ready?: boolean }[] = [];
      for (const r of rows) { const it = DELEG_ITEM[r.tarea]; if (it && !seen.has(it.key)) { seen.add(it.key); items.push({ ...it, ready: true }); } }
      setDelegItems(items);
    }).catch(() => setDelegItems([]));
  }, [user]);

  // Contador de aprobaciones pendientes (badge del menú) para quienes aprueban.
  const [pendAprob, setPendAprob] = useState(0);
  useEffect(() => {
    if (!user || !['manager', 'rrhh', 'admin'].includes(user.role)) { setPendAprob(0); return; }
    let vivo = true;
    const traer = () => api.get<{ total: number }>('/aprobaciones/pendientes').then((r) => { if (vivo) setPendAprob(r.total || 0); }).catch(() => {});
    traer();
    const t = setInterval(traer, 60000);
    return () => { vivo = false; clearInterval(t); };
  }, [user]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {menuOpen && <div className="sb-overlay" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <Link to="/" className="sb-brand" style={{ display: 'block', textDecoration: 'none' }} onClick={() => setMenuOpen(false)}>
          <strong>Portal RR.HH.</strong>
          <div className="muted">Grupo LEITEN</div>
        </Link>
        <nav style={{ padding: '10px' }} onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end className="sb-item" style={({ isActive }) => isActive ? { background: 'var(--accent-glow)', color: 'var(--accent2)' } : {}}>🏠 Inicio</NavLink>
          {delegItems.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="sb-group-label">⇄ Delegado a mí</div>
              {delegItems.map((it) => (
                <NavLink key={it.key} to={`/m/${it.key}`} className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
                  <span>{it.label}</span>
                </NavLink>
              ))}
            </div>
          )}
          {(() => {
            // Ítems de un panel (nivel más profundo).
            const itemsDe = (g: typeof groups[number]) => g.items.slice().sort((a, b) => a.label.localeCompare(b.label, 'es')).map((it) => (
              <NavLink key={it.key} to={`/m/${it.key}`} className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
                <span>{it.label}</span>
                {it.key === 'aprobaciones-pendientes' && pendAprob > 0 && (
                  <span title="Pendientes de tu aprobación" style={{ marginLeft: 'auto', background: 'var(--accent2)', color: '#fff', borderRadius: 10, padding: '0 7px', fontSize: 11, fontWeight: 700 }}>{pendAprob}</span>
                )}
                {!it.ready && <span title="En migración" style={{ fontSize: 10, opacity: .6 }}>🚧</span>}
              </NavLink>
            ));
            // Un panel colapsable (título + ítems). indent = anidado dentro de RR.HH.
            const panel = (g: typeof groups[number], indent = false) => {
              const abierto = isGroupOpen(g.panel, g.panel === activePanel);
              return (
                <div key={g.panel} style={{ marginTop: indent ? 4 : 12 }}>
                  <div className="sb-group-label" onClick={(e) => { e.stopPropagation(); toggleGroup(g.panel, g.panel === activePanel); }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }} title={abierto ? 'Ocultar' : 'Mostrar'}>
                    <span>{g.panel}</span><span style={{ fontSize: 10, opacity: .7 }}>{abierto ? '▾' : '▸'}</span>
                  </div>
                  {abierto && itemsDe(g)}
                </div>
              );
            };
            const rrhhGroups = groups.filter((g) => g.area === 'rrhh');
            const out: JSX.Element[] = [];
            let rrhhListo = false;
            for (const g of groups) {
              if (g.area === 'rrhh') {
                if (rrhhListo) continue;
                rrhhListo = true;
                const abierto = isGroupOpen('__RRHH__', activeEsRRHH);
                out.push(
                  <div key="__rrhh__" style={{ marginTop: 12 }}>
                    <div className="sb-group-label" onClick={(e) => { e.stopPropagation(); toggleGroup('__RRHH__', activeEsRRHH); }}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none', fontWeight: 700 }} title={abierto ? 'Ocultar' : 'Mostrar'}>
                      <span>RR.HH.</span><span style={{ fontSize: 10, opacity: .7 }}>{abierto ? '▾' : '▸'}</span>
                    </div>
                    {abierto && (
                      <div style={{ marginLeft: 8, borderLeft: '1px solid var(--border, rgba(120,130,160,.25))', paddingLeft: 6 }}>
                        {rrhhGroups.map((rg) => panel(rg, true))}
                      </div>
                    )}
                  </div>
                );
                continue;
              }
              out.push(panel(g));
            }
            return out;
          })()}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="topbar">
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <button className="hamburger" onClick={() => setMenuOpen((v) => !v)} aria-label="Abrir menú">☰</button>
            <span className="nav-logo" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent2)', letterSpacing: '.05em' }}>LEITEN · RR.HH.</span>
          </div>
          <div className="row">
            <span className="muted">{user?.nom} · {user?.role}</span>
            <button className="btn ghost" onClick={() => { logout(); nav('/login'); }}>Salir</button>
          </div>
        </div>
        <div className="container">
          <ErrorBoundary key={loc.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
