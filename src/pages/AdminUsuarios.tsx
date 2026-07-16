import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { GROUPS } from '../lib/sections';

interface U { id: number; leg_num: string; dni: string; nom: string; role: string; disabled: boolean; must_change_pwd: boolean; empresa: string; comite_hys?: boolean; modulos_ocultos?: string[]; twofa?: boolean; }
const ROLES = [{ v: 'employee', l: 'Empleado' }, { v: 'manager', l: 'Gerente' }, { v: 'rrhh', l: 'RR.HH.' }, { v: 'admin', l: 'Admin' }];

// Plantillas de acceso por área: al aplicarlas, dejan visible SOLO los paneles del
// área elegida (ocultan el resto). Sirven para asignar de una a un usuario de RR.HH.
// las herramientas de su área sin que se pisen con las de otras áreas.
const PLANTILLAS: { label: string; panels: string[] }[] = [
  { label: 'Administración de personal', panels: ['RR.HH. — Personal y legajos', 'RR.HH. — Documentación y comunicación', 'RR.HH. — Tiempos y ausencias', 'RR.HH. — Comunicación'] },
  { label: 'Selección y desarrollo', panels: ['RR.HH. — Organización y puestos', 'RR.HH. — Selección e incorporación', 'RR.HH. — Desarrollo y desempeño'] },
  { label: 'Liquidación e impuestos', panels: ['RR.HH. — Liquidación de haberes', 'RR.HH. — Impuesto a las Ganancias', 'RR.HH. — Cargas sociales y AFIP', 'RR.HH. — Tablas y configuración', 'RR.HH. — Compensaciones'] },
  { label: 'Tablero y control', panels: ['RR.HH. — Tablero y control'] },
  { label: 'Higiene y Seguridad', panels: ['RR.HH. — Higiene y Seguridad', 'Comité de HyS'] },
];

export default function AdminUsuarios() {
  const { user } = useAuth();
  const [items, setItems] = useState<U[]>([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [empresa, setEmpresa] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [perms, setPerms] = useState<U | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());

  async function load() {
    try { const p = new URLSearchParams(); if (q) p.set('q', q); if (role) p.set('role', role); if (empresa) p.set('empresa', empresa); setItems(await api.get<U[]>(`/admin/usuarios?${p}`)); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  useEffect(() => { setEmpresas([...new Set(items.map((i) => i.empresa))].sort()); }, [items.length]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, role, empresa]);

  async function cambiarRol(u: U, nuevo: string) {
    try { await api.patch(`/admin/usuarios/${u.id}`, { role: nuevo }); setMsg({ t: `Rol de ${u.nom} → ${nuevo}`, ok: true }); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function toggle(u: U) { try { await api.patch(`/admin/usuarios/${u.id}`, { disabled: !u.disabled }); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  async function toggleComite(u: U) { try { await api.patch(`/admin/usuarios/${u.id}`, { comiteHys: !u.comite_hys }); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  function abrirPerms(u: U) { setPerms(u); setSel(new Set(u.modulos_ocultos || [])); }
  // Aplica una plantilla de área: oculta todo salvo los paneles indicados (y los "siempre visibles").
  function aplicarPlantilla(panelsKeep: string[]) {
    const keep = new Set(panelsKeep);
    const ocultar = GROUPS
      .filter((g) => g.panel !== 'Mi espacio' && g.panel !== 'Gerencia' && !keep.has(g.panel))
      .flatMap((g) => g.items.map((it) => it.key));
    setSel(new Set(ocultar));
  }
  async function guardarPerms() {
    if (!perms) return;
    try { await api.patch(`/admin/usuarios/${perms.id}`, { modulosOcultos: [...sel] }); setMsg({ t: `Módulos actualizados para ${perms.nom}`, ok: true }); setPerms(null); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function reset2fa(u: U) {
    if (!confirm(`¿Restablecer el 2FA de ${u.nom}? Tendrá que volver a configurarlo.`)) return;
    try { await api.patch(`/admin/usuarios/${u.id}`, { reset2fa: true }); setMsg({ t: `2FA restablecido para ${u.nom}`, ok: true }); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function blanquear(u: U) {
    if (!confirm(`¿Blanquear la contraseña de ${u.nom}? Quedará igual al DNI (${u.dni}) con cambio forzado.`)) return;
    try { await api.post(`/admin/usuarios/${u.id}/blanquear`); setMsg({ t: `Clave de ${u.nom} blanqueada al DNI`, ok: true }); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  return (
    <>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 240 }} placeholder="Buscar nombre, legajo o DNI…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 200 }} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="">Todas las empresas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 160 }} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Todos los roles</option>{ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Empleado</th><th>Empresa</th><th>DNI</th><th>Rol</th><th>Comité HyS</th><th>2FA</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.nom} <span className="muted">({u.leg_num})</span></td>
                <td>{u.empresa}</td><td>{u.dni}</td>
                <td>
                  <select className="input" style={{ padding: '4px 8px', fontSize: 12, width: 130 }} value={u.role} onChange={(e) => cambiarRol(u, e.target.value)} disabled={u.id === user?.id}>
                    {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                  </select>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={!!u.comite_hys} onChange={() => toggleComite(u)} title="Integrante Comité HyS" />
                </td>
                <td style={{ textAlign: 'center', fontSize: 12 }}>{u.twofa ? <span style={{ color: 'var(--green)' }} title="2FA activo">✔</span> : <span className="muted">—</span>}</td>
                <td>
                  <span className="badge" style={{ color: u.disabled ? 'var(--red)' : 'var(--green)' }}>{u.disabled ? 'Desactivado' : 'Activo'}</span>
                  {u.must_change_pwd && <span className="badge" title="Debe cambiar la contraseña" style={{ marginLeft: 4, color: 'var(--yellow)' }}>🔑</span>}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => abrirPerms(u)}>Módulos</button>
                  {u.twofa && <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => reset2fa(u)}>Reset 2FA</button>}
                  <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => blanquear(u)}>Blanquear clave</button>
                  <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggle(u)} disabled={u.id === user?.id}>{u.disabled ? 'Activar' : 'Desactivar'}</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin usuarios.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>{items.length} usuario(s) · No podés cambiar tu propio rol/estado.</p>

      {perms && (
        <div className="modal-bg" onClick={() => setPerms(null)}>
          <div className="modal" style={{ maxWidth: 680, maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Módulos ocultos — {perms.nom}</h3>
            <p className="muted">Tildá los módulos que querés OCULTAR para este usuario (además de lo que ya restringe su rol). Usá el tilde del encabezado para marcar o desmarcar un grupo completo. «Mi espacio» y «Gerencia» no se listan: su acceso está garantizado para todos los empleados y gerentes.</p>
            <div style={{ marginBottom: 12, padding: 10, background: 'var(--bg2)', borderRadius: 8 }}>
              <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Plantillas de acceso por área — dejan visible solo esa área</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {PLANTILLAS.map((p) => <button key={p.label} className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => aplicarPlantilla(p.panels)}>{p.label}</button>)}
                <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setSel(new Set())}>Acceso total</button>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Aplican una selección de base; después podés ajustar módulos puntuales y Guardar.</div>
            </div>
            {GROUPS.filter((g) => g.panel !== 'Mi espacio' && g.panel !== 'Gerencia').map((g) => (
              <div key={g.panel} style={{ marginBottom: 10 }}>
                <label className="row" style={{ gap: 6, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, cursor: 'pointer' }}>
                  <input type="checkbox"
                    checked={g.items.length > 0 && g.items.every((it) => sel.has(it.key))}
                    ref={(el) => { if (el) el.indeterminate = g.items.some((it) => sel.has(it.key)) && !g.items.every((it) => sel.has(it.key)); }}
                    onChange={(e) => { const n = new Set(sel); if (e.target.checked) g.items.forEach((it) => n.add(it.key)); else g.items.forEach((it) => n.delete(it.key)); setSel(n); }} />
                  {g.panel}
                </label>
                <div className="grid2">
                  {g.items.map((it) => (
                    <label key={it.key} className="row muted" style={{ gap: 6, fontSize: 13 }}>
                      <input type="checkbox" checked={sel.has(it.key)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(it.key); else n.delete(it.key); setSel(n); }} /> {it.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={guardarPerms}>Guardar</button><button className="btn ghost" onClick={() => setPerms(null)}>Cancelar</button><button className="btn ghost" onClick={() => setSel(new Set())}>Limpiar todo</button></div>
          </div>
        </div>
      )}
    </>
  );
}
