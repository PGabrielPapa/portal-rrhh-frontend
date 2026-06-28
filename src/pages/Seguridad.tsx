import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Seguridad() {
  const [enabled, setEnabled] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  async function estado() { try { const r = await api.get<{ enabled: boolean }>('/auth/2fa/estado'); setEnabled(r.enabled); } catch { /* */ } }
  useEffect(() => { estado(); }, []);

  async function generar() {
    setMsg(null);
    try { setSetup(await api.post<{ secret: string; otpauth: string }>('/auth/2fa/setup')); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function activar() {
    try { await api.post('/auth/2fa/activate', { token: token.trim() }); setMsg({ t: '2FA activado. La próxima vez te pedirá el código al ingresar.', ok: true }); setSetup(null); setToken(''); estado(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function desactivar() {
    const t = prompt('Para desactivar el 2FA, ingresá un código actual de tu app:');
    if (t == null) return;
    try { await api.post('/auth/2fa/disable', { token: String(t).trim() }); setMsg({ t: '2FA desactivado.', ok: true }); estado(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h3 style={{ marginTop: 0 }}>Verificación en dos pasos (2FA)</h3>
      <p className="muted">Agrega una segunda capa de seguridad: además de la contraseña, al ingresar te pedirá un código de 6 dígitos de una app como Google Authenticator, Microsoft Authenticator o Authy.</p>
      <p>Estado actual: <b style={{ color: enabled ? '#15803d' : '#b45309' }}>{enabled ? 'Activado ✔' : 'Desactivado'}</b></p>

      {!enabled && !setup && <button className="btn" onClick={generar}>Activar 2FA</button>}
      {!enabled && setup && (
        <div style={{ marginTop: 8 }}>
          <p>1) En tu app de autenticación, agregá una cuenta nueva y cargá esta clave (o el enlace):</p>
          <div className="card" style={{ background: 'var(--bg2)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            <div><b>Clave:</b> {setup.secret}</div>
            <div style={{ marginTop: 6, fontSize: 12 }}>{setup.otpauth}</div>
          </div>
          <p style={{ marginTop: 10 }}>2) Ingresá el código de 6 dígitos que muestra la app:</p>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" style={{ maxWidth: 160 }} inputMode="numeric" maxLength={6} value={token} onChange={(e) => setToken(e.target.value)} placeholder="6 dígitos" />
            <button className="btn" onClick={activar}>Confirmar y activar</button>
            <button className="btn ghost" onClick={() => { setSetup(null); setToken(''); }}>Cancelar</button>
          </div>
        </div>
      )}
      {enabled && <button className="btn danger" onClick={desactivar}>Desactivar 2FA</button>}
      {msg && <p className={msg.ok ? 'ok' : 'err'} style={{ marginTop: 12 }}>{msg.t}</p>}
    </div>
  );
}
