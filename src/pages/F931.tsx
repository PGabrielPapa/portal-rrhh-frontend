import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const $ = (n: any) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Row { empresa: string; legNum: string; nom: string; cuil?: string; remunerativo: number; noRemunerativo: number; aporteJub: number; aporteOS: number; aporteSind: number; contribuciones: number; }
interface Resp { items: Row[]; totales: any; }
interface Diseno { version: number; descripcion?: string; urlArca?: string; actualizadoAt?: string; ultimaVersion: number | null; ultimaFecha?: string | null; primeraVez: boolean; actualizado: boolean; }
const fF = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-AR') : '—';

export default function F931() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [empresa, setEmpresa] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [dis, setDis] = useState<Diseno | null>(null);

  useEffect(() => { api.get<Empleado[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {}); }, []);
  async function cargar() { setErr(''); try { const p = new URLSearchParams({ anio: String(anio), mes: String(mes) }); if (empresa) p.set('empresa', empresa); setData(await api.get<Resp>(`/reportes/f931?${p}`)); } catch (e: any) { setErr(e.message); } }
  async function cargarDis() { try { setDis(await api.get<Diseno>('/reportes/sicoss-diseno')); } catch { /* */ } }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [anio, mes, empresa]);
  useEffect(() => { cargarDis(); }, []);
  async function actualizarDis() {
    const descripcion = window.prompt('Describí la actualización del diseño de registro SICOSS (qué cambió según ARCA):', '');
    if (descripcion === null) return;
    const urlArca = window.prompt('URL del diseño en ARCA (opcional, dejá vacío para mantener):', dis?.urlArca || '') || undefined;
    try { await api.patch('/reportes/sicoss-diseno', { descripcion, urlArca }); setOk('Diseño SICOSS actualizado a una nueva versión.'); cargarDis(); } catch (e: any) { setErr(e.message); }
  }

  function csv() {
    if (!data) return;
    const head = 'Empresa,Legajo,Nombre,CUIL,Remunerativo,No remunerativo,Aporte SIPA,Aporte OS+PAMI,Aporte sindical,Contribuciones';
    const lines = data.items.map((r) => `"${r.empresa}",${r.legNum},"${r.nom}",${r.cuil || ''},${r.remunerativo},${r.noRemunerativo},${r.aporteJub},${r.aporteOS},${r.aporteSind},${r.contribuciones}`);
    const blob = new Blob(['﻿' + [head, ...lines].join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `f931_${anio}_${String(mes).padStart(2, '0')}.csv`; a.click();
    api.post('/reportes/f931-generar', { anio, mes }).then(() => { setOk('F.931 generado con el diseño SICOSS vigente.'); cargarDis(); }).catch(() => {});
  }
  const t = data?.totales;

  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
        <div className="field"><label>Año</label><input className="input" type="number" style={{ width: 100 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
        <div className="field"><label>Empresa</label><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select></div>
        <button className="btn" onClick={csv} disabled={!data?.items.length}>⬇ Verificar diseño y generar (CSV)</button>
      </div>
      {dis && (
        <div className="card" style={{ marginBottom: 12, padding: '8px 12px', fontSize: 13,
          background: dis.actualizado ? 'rgba(234,179,8,.08)' : 'rgba(34,197,94,.06)',
          border: `1px solid ${dis.actualizado ? 'rgba(234,179,8,.35)' : 'rgba(34,197,94,.25)'}` }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span>
              {dis.actualizado
                ? <b style={{ color: 'var(--yellow)' }}>⚠ El diseño de registro SICOSS se actualizó a la versión {dis.version} ({fF(dis.actualizadoAt)}). El F.931 se generará con el diseño actualizado.</b>
                : dis.primeraVez
                  ? <span>Diseño de registro SICOSS vigente <b>v{dis.version}</b>. Primera generación.</span>
                  : <span style={{ color: 'var(--green)' }}>✓ Diseño de registro SICOSS vigente <b>v{dis.version}</b> — sin cambios desde la última generación (v{dis.ultimaVersion}, {fF(dis.ultimaFecha)}).</span>}
            </span>
            <span className="row" style={{ gap: 6 }}>
              {dis.urlArca && <a className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} href={dis.urlArca} target="_blank" rel="noreferrer">🔗 Ver diseño en ARCA</a>}
              <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={actualizarDis}>✎ Registrar actualización</button>
            </span>
          </div>
          {dis.descripcion && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{dis.descripcion}</div>}
        </div>
      )}
      {ok && <div className="muted" style={{ marginBottom: 12, color: 'var(--green)' }}>✓ {ok}</div>}
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {t && <div className="card" style={{ marginBottom: 12, fontSize: 13 }}>
        <strong>{t.cant} empleados</strong> · Remunerativo {$(t.remunerativo)} · Aportes SIPA {$(t.aporteJub)} · OS+PAMI {$(t.aporteOS)} · Sindical {$(t.aporteSind)} · <strong>Contribuciones patronales {$(t.contribuciones)}</strong>
      </div>}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Legajo</th><th>Nombre</th><th>CUIL</th><th style={{ textAlign: 'right' }}>Remun.</th><th style={{ textAlign: 'right' }}>Ap. SIPA</th><th style={{ textAlign: 'right' }}>Ap. OS+PAMI</th><th style={{ textAlign: 'right' }}>Ap. sindical</th><th style={{ textAlign: 'right' }}>Contrib.</th></tr></thead>
          <tbody>
            {data?.items.map((r, i) => (
              <tr key={i}><td>{r.legNum}</td><td>{r.nom}</td><td className="muted">{r.cuil || '—'}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(r.remunerativo)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(r.aporteJub)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(r.aporteOS)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(r.aporteSind)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(r.contribuciones)}</td></tr>
            ))}
            {!data?.items.length && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin datos para ese período.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
