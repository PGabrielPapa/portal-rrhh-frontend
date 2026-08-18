import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';
import { useAuth } from '../lib/auth';

// Mínimo vigente en el backend (config.password.minSimple). La política estricta de
// la auditoría 08/2026 (10+ caracteres, mezcla de familias, sin DNI/nombre) quedó
// implementada pero APAGADA por decisión de negocio: se activa con
// PWD_POLITICA_ESTRICTA=true, y entonces el backend rechaza con su propio mensaje.
const PWD_MIN = 6;

export default function ChangePassword() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [conf, setConf] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (nw.length < PWD_MIN) return setErr(`La nueva contraseña debe tener al menos ${PWD_MIN} caracteres`);
    if (nw !== conf) return setErr('Las contraseñas no coinciden');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: cur, newPassword: nw });
      // El servidor invalida todas las sesiones al cambiar la contraseña (para
      // expulsar a quien tuviera el token viejo), así que hay que volver a entrar.
      setToken(null);
      logout();
      nav('/login', { replace: true });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="center">
      <form className="card" style={{ width: 360 }} onSubmit={submit}>
        <h3 style={{ marginTop: 0 }}>Cambiar contraseña</h3>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Contraseña actual (tu DNI)</label>
          <input className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Nueva contraseña</label>
          <input className="input" type="password" autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Repetir nueva contraseña</label>
          <input className="input" type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} />
        </div>
        {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </div>
  );
}
