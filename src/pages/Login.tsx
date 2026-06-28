import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [dni, setDni] = useState('');
  const [pwd, setPwd] = useState('');
  const [token, setTokenInput] = useState('');
  const [need2fa, setNeed2fa] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await login(dni.trim(), pwd, token.trim() || undefined);
      nav(r.mustChangePassword ? '/cambiar-clave' : '/', { replace: true });
    } catch (e: any) { const m = String(e.message || ''); if (/autenticaci|verificaci|c[óo]digo/i.test(m)) setNeed2fa(true); setErr(m); } finally { setBusy(false); }
  }

  return (
    <div className="center">
      <form className="card" style={{ width: 360 }} onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>Portal RR.HH.</h2>
        <p className="muted" style={{ marginTop: -8 }}>Grupo LEITEN</p>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>DNI</label>
          <input className="input" value={dni} onChange={(e) => setDni(e.target.value)} autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Contraseña</label>
          <input className="input" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </div>
        {need2fa && (
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Código de verificación (2FA)</label>
            <input className="input" inputMode="numeric" maxLength={6} value={token} onChange={(e) => setTokenInput(e.target.value)} placeholder="6 dígitos de tu app" autoFocus />
          </div>
        )}
        {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        <p className="muted" style={{ marginTop: 14 }}>La contraseña inicial es tu DNI; te pediremos cambiarla.</p>
      </form>
    </div>
  );
}
