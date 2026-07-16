import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Banda {
  puestoId: number; puesto: string; ocupantes: number;
  id: number | null; minimo: number | null; medio: number | null; maximo: number | null;
  moneda: string; nota?: string; activo: boolean; updatedBy?: string; updatedAt?: string;
}
interface AnalItem {
  legNum: string; nom: string; empresa: string; puesto: string;
  bruto: number; minimo: number; medio: number; maximo: number;
  compaRatio: number | null; estado: 'dentro' | 'debajo' | 'encima';
}
interface Anal { resumen: { dentro: number; debajo: number; encima: number; total: number }; items: AnalItem[]; }

const $ = (n: number | null) => n == null ? '—' : '$ ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
const COLOR = { dentro: 'var(--green)', debajo: 'var(--yellow)', encima: 'var(--red)' } as const;
const ESTADO_LBL = { dentro: 'Dentro de banda', debajo: 'Por debajo', encima: 'Por encima' } as const;

export default function Compensaciones() {
  const [tab, setTab] = useState<'bandas' | 'analisis'>('bandas');
  const [bandas, setBandas] = useState<Banda[]>([]);
  const [anal, setAnal] = useState<Anal | null>(null);
  const [empresa, setEmpresa] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [edit, setEdit] = useState<Record<number, { minimo: string; medio: string; maximo: string }>>({});
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [err, setErr] = useState('');

  async function cargarBandas() {
    setErr('');
    try { const b = await api.get<Banda[]>('/compensaciones/bandas'); setBandas(b); }
    catch (e: any) { setErr(e.message); }
  }
  async function cargarAnalisis() {
    setErr('');
    try { const a = await api.get<Anal>(`/compensaciones/analisis${empresa ? `?empresa=${encodeURIComponent(empresa)}` : ''}`); setAnal(a); setEmpresas([...new Set(a.items.map((i) => i.empresa))].sort()); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { cargarBandas(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (tab === 'analisis') cargarAnalisis(); /* eslint-disable-next-line */ }, [tab, empresa]);

  function campo(pid: number, k: 'minimo' | 'medio' | 'maximo', v: string) {
    setEdit((e) => ({ ...e, [pid]: { ...(e[pid] || { minimo: '', medio: '', maximo: '' }), [k]: v } }));
  }
  function valor(b: Banda, k: 'minimo' | 'medio' | 'maximo'): string {
    const e = edit[b.puestoId];
    if (e && e[k] !== undefined && e[k] !== '') return e[k];
    if (e && e[k] === '') return '';
    return b[k] != null ? String(b[k]) : '';
  }
  async function guardar(b: Banda) {
    const e = edit[b.puestoId] || {};
    const minimo = Number(e.minimo ?? b.minimo ?? 0) || 0;
    const medio = Number(e.medio ?? b.medio ?? 0) || 0;
    const maximo = Number(e.maximo ?? b.maximo ?? 0) || 0;
    try {
      await api.put(`/compensaciones/bandas/${b.puestoId}`, { minimo, medio, maximo });
      setMsg({ t: `Banda de "${b.puesto}" guardada`, ok: true });
      setEdit((prev) => { const n = { ...prev }; delete n[b.puestoId]; return n; });
      cargarBandas();
    } catch (e2: any) { setMsg({ t: e2.message, ok: false }); }
  }
  async function borrar(b: Banda) {
    if (!confirm(`¿Borrar la banda de "${b.puesto}"?`)) return;
    try { await api.del(`/compensaciones/bandas/${b.puestoId}`); setMsg({ t: 'Banda borrada', ok: true }); cargarBandas(); }
    catch (e2: any) { setMsg({ t: e2.message, ok: false }); }
  }

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button className={`btn ${tab === 'bandas' ? '' : 'ghost'}`} onClick={() => setTab('bandas')}>Bandas por puesto</button>
        <button className={`btn ${tab === 'analisis' ? '' : 'ghost'}`} onClick={() => setTab('analisis')}>Análisis (compa-ratio)</button>
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}

      {tab === 'bandas' && (
        <>
          <p className="muted" style={{ marginTop: -6, marginBottom: 10, fontSize: 13 }}>
            Definí el mínimo, el punto medio y el máximo de cada puesto. El punto medio es la referencia del compa-ratio (1,00 = en el medio de la banda).
          </p>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead><tr><th>Puesto</th><th style={{ textAlign: 'right' }}>Ocupantes</th><th>Mínimo</th><th>Punto medio</th><th>Máximo</th><th></th></tr></thead>
              <tbody>
                {bandas.map((b) => {
                  const tocado = !!edit[b.puestoId];
                  return (
                    <tr key={b.puestoId}>
                      <td>{b.puesto}</td>
                      <td style={{ textAlign: 'right' }}>{b.ocupantes}</td>
                      {(['minimo', 'medio', 'maximo'] as const).map((k) => (
                        <td key={k}><input className="input" style={{ width: 120 }} type="number" step="1000" value={valor(b, k)} onChange={(e) => campo(b.puestoId, k, e.target.value)} placeholder="—" /></td>
                      ))}
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <button className="btn" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} disabled={!tocado && b.id == null} onClick={() => guardar(b)}>Guardar</button>
                        {b.id != null && <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => borrar(b)}>Borrar</button>}
                      </td>
                    </tr>
                  );
                })}
                {!bandas.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>No hay puestos cargados. Definí puestos en «Puestos y estructura».</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'analisis' && (
        <>
          <div className="row" style={{ marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
            <select className="input" style={{ maxWidth: 220 }} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
              <option value="">Todas las empresas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}
            </select>
          </div>
          {anal && <>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <div className="card" style={{ flex: '1 1 140px' }}><div className="muted" style={{ fontSize: 12 }}>Analizados</div><div style={{ fontSize: 24, fontWeight: 700 }}>{anal.resumen.total}</div><div className="muted" style={{ fontSize: 11 }}>activos con banda</div></div>
              <div className="card" style={{ flex: '1 1 140px' }}><div className="muted" style={{ fontSize: 12 }}>Dentro de banda</div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>{anal.resumen.dentro}</div></div>
              <div className="card" style={{ flex: '1 1 140px' }}><div className="muted" style={{ fontSize: 12 }}>Por debajo</div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--yellow)' }}>{anal.resumen.debajo}</div></div>
              <div className="card" style={{ flex: '1 1 140px' }}><div className="muted" style={{ fontSize: 12 }}>Por encima</div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>{anal.resumen.encima}</div></div>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              <table>
                <thead><tr><th>Empleado</th><th>Empresa</th><th>Puesto</th><th style={{ textAlign: 'right' }}>Sueldo</th><th style={{ textAlign: 'right' }}>Mín</th><th style={{ textAlign: 'right' }}>Medio</th><th style={{ textAlign: 'right' }}>Máx</th><th style={{ textAlign: 'right' }}>Compa-ratio</th><th>Posición</th></tr></thead>
                <tbody>
                  {anal.items.map((it, i) => (
                    <tr key={i}>
                      <td>{it.nom} <span className="muted">({it.legNum})</span></td>
                      <td>{it.empresa}</td><td>{it.puesto}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(it.bruto)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }} className="muted">{$(it.minimo)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }} className="muted">{$(it.medio)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }} className="muted">{$(it.maximo)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{it.compaRatio != null ? it.compaRatio.toFixed(2) : '—'}</td>
                      <td><span className="badge" style={{ color: COLOR[it.estado] }}>{ESTADO_LBL[it.estado]}</span></td>
                    </tr>
                  ))}
                  {!anal.items.length && <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 20 }}>No hay empleados con puesto y banda definida. Cargá bandas en la pestaña anterior.</td></tr>}
                </tbody>
              </table>
            </div>
          </>}
        </>
      )}
    </>
  );
}
