import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { groupsForRole } from '../lib/sections';

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
  const groups = groupsForRole(user?.role || 'employee', { comiteHys: !!user?.comiteHys, comiteAcceso: user?.acceso, modulosOcultos: user?.modulosOcultos });

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside className="sidebar">
        <Link to="/" className="sb-brand" style={{ display: 'block', textDecoration: 'none' }}>
          <strong>Portal RR.HH.</strong>
          <div className="muted">Grupo LEITEN</div>
        </Link>
        <nav style={{ padding: '10px' }}>
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
          {groups.map((g) => (
            <div key={g.panel} style={{ marginTop: 12 }}>
              <div className="sb-group-label">{g.panel}</div>
              {g.items.slice().sort((a, b) => a.label.localeCompare(b.label, 'es')).map((it) => (
                <NavLink key={it.key} to={`/m/${it.key}`} className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
                  <span>{it.label}</span>
                  {!it.ready && <span title="En migración" style={{ fontSize: 10, opacity: .6 }}>🚧</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="topbar">
          <span className="nav-logo" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent2)', letterSpacing: '.05em' }}>LEITEN · RR.HH.</span>
          <div className="row">
            <span className="muted">{user?.nom} · {user?.role}</span>
            <button className="btn ghost" onClick={() => { logout(); nav('/login'); }}>Salir</button>
          </div>
        </div>
        <div className="container">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
