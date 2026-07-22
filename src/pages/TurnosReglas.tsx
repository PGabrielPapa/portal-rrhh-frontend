import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Regla { turno: string; jornada_min: number; inicio: string | null; restringido: boolean; }

export default function TurnosReglas() {
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  async function load() {
    try { setReglas(await api.get<Regla[]>('/fichadas/turnos-reglas')); setLoaded(true); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  useEffect(() => { load(); }, []);

  function set(i: number, campo: keyof Regla, valor: any) {
    setReglas((rs) => rs.map((r, j) => (j === i ? { ...r, [campo]: valor } : r)));
  }

  async function guardar() {
    setBusy(true); setMsg(null);
    try {
      await api.put('/fichadas/turnos-reglas', { reglas });
      setMsg({ t: 'Reglas guardadas. Reimportá el período para recalcular con los nuevos horarios.', ok: true });
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
    finally { setBusy(false); }
  }

  async function sincronizar() {
    setBusy(true); setMsg(null);
    try {
      const r = await api.post<{ sincronizados: number }>('/fichadas/turnos-reglas/sync');
      await load();
      setMsg({ t: `${r.sincronizados} turno(s) sincronizados desde Pro-Soft. Revisá y, si hace falta, ajustá y Guardá. Después reimportá el período.`, ok: true });
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
    finally { setBusy(false); }
  }

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 14 }}>
        Reglas por <b>turno</b> (el turno lo trae Pro-Soft; los horarios se cargan acá). La <b>jornada</b> es lo esperado por día.
        Marcá <b>“Restringido”</b> y cargá el <b>horario de ingreso</b> en los turnos donde la <b>entrada anticipada no debe computar</b>:
        en esos turnos el tiempo empieza a contar recién desde ese horario (quedarse después sí cuenta como extra). Los turnos nuevos
        se detectan solos al importar fichadas.
      </p>

      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr>
            <th>Turno</th>
            <th style={{ textAlign: 'right' }}>Jornada (hs)</th>
            <th>Restringido</th>
            <th>Horario de ingreso</th>
          </tr></thead>
          <tbody>
            {reglas.map((r, i) => (
              <tr key={r.turno} style={{ background: r.restringido ? 'rgba(217,119,6,.07)' : undefined }}>
                <td><b>{r.turno}</b></td>
                <td style={{ textAlign: 'right' }}>
                  <input className="input" type="number" step="0.5" min="1" style={{ width: 80, textAlign: 'right' }}
                    value={Math.round((r.jornada_min / 60) * 100) / 100}
                    onChange={(e) => set(i, 'jornada_min', Math.round((Number(e.target.value) || 0) * 60))} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={r.restringido} onChange={(e) => set(i, 'restringido', e.target.checked)} title="La entrada antes del horario no computa" />
                </td>
                <td>
                  <input className="input" placeholder="HH:MM" maxLength={5} style={{ width: 90 }}
                    value={r.inicio || ''} disabled={!r.restringido}
                    onChange={(e) => set(i, 'inicio', e.target.value)} />
                  {r.restringido && !/^\d{1,2}:\d{2}$/.test(r.inicio || '') && <span className="muted" style={{ marginLeft: 8, color: '#d97706', fontSize: 12 }}>cargá el horario (HH:MM)</span>}
                </td>
              </tr>
            ))}
            {loaded && !reglas.length && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>Todavía no hay turnos. Importá un período de fichadas y aparecerán acá.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn" onClick={sincronizar} disabled={busy}>{busy ? '…' : '↻ Sincronizar desde Pro-Soft'}</button>
        <button className="btn gray" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </>
  );
}
