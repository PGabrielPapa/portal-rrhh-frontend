import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fmtF = (s?: string) => s ? new Date(s).toLocaleDateString('es-AR') : '—';

export default function SimplificacionRegistral() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [empresa, setEmpresa] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => { api.get<Empleado[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {}); }, []);
  async function load() {
    setErr(''); setBusy(true); setData(null);
    try { const p = new URLSearchParams({ anio: String(anio), mes: String(mes) }); if (empresa) p.set('empresa', empresa); setData(await api.get<any>(`/reportes/simplificacion?${p}`)); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  function csv() {
    if (!data) return;
    const rows = [['Tipo', 'Empresa', 'CUIT Empleador', 'CUIL', 'Apellido', 'Nombres', 'Fecha', 'Modalidad/Causa', 'Obra Social', 'Remuneración']];
    for (const a of data.altas) rows.push(['ALTA', a.empresa, a.empresaCuit || '', a.cuil || '', a.apellido, a.nombres, fmtF(a.fecha), a.modalidad || '', a.obraSocial || '', String(a.remuneracion || '')]);
    for (const b of data.bajas) rows.push(['BAJA', b.empresa, b.empresaCuit || '', b.cuil || '', b.apellido, b.nombres, fmtF(b.fecha), b.causa || '', '', '']);
    const body = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
    const u = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = u; link.download = `simplificacion_${anio}_${String(mes).padStart(2, '0')}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ marginTop: 0 }}>Altas (ingresos) y bajas (ceses) del período para informar a AFIP/ARCA (Simplificación Registral). El diseño de importación exacto de ARCA debe confirmarse antes de subirlo.</p>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
          <div className="field"><label>Año</label><input className="input" type="number" style={{ width: 100 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
          <div className="field"><label>Empresa</label><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select></div>
          <button className="btn" onClick={load} disabled={busy}>{busy ? 'Buscando…' : 'Consultar'}</button>
          {data && <button className="btn ghost" onClick={csv}>⬇ CSV</button>}
        </div>
        {err && <p className="err" style={{ marginBottom: 0 }}>⚠ {err}</p>}
      </div>

      {data && (<>
        <h3 style={{ margin: '0 0 8px' }}>Altas <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({data.altas.length})</span></h3>
        <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 16 }}>
          <table><thead><tr><th>Empleado</th><th>CUIL</th><th>Empresa</th><th>Fecha ingreso</th><th>Modalidad</th><th>Obra social</th></tr></thead>
            <tbody>
              {data.altas.map((a: any, i: number) => <tr key={i}><td>{a.apellido}, {a.nombres}</td><td style={{ fontFamily: 'monospace' }}>{a.cuil}</td><td>{a.empresa}</td><td>{fmtF(a.fecha)}</td><td className="muted">{a.modalidad || '—'}</td><td className="muted">{a.obraSocial || '—'}</td></tr>)}
              {!data.altas.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 16 }}>Sin altas en el período.</td></tr>}
            </tbody>
          </table>
        </div>
        <h3 style={{ margin: '0 0 8px' }}>Bajas <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({data.bajas.length})</span></h3>
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table><thead><tr><th>Empleado</th><th>CUIL</th><th>Empresa</th><th>Fecha baja</th><th>Causa</th></tr></thead>
            <tbody>
              {data.bajas.map((b: any, i: number) => <tr key={i}><td>{b.apellido}, {b.nombres}</td><td style={{ fontFamily: 'monospace' }}>{b.cuil}</td><td>{b.empresa}</td><td>{fmtF(b.fecha)}</td><td className="muted">{b.causa || '—'}</td></tr>)}
              {!data.bajas.length && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 16 }}>Sin bajas en el período.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}
    </>
  );
}
