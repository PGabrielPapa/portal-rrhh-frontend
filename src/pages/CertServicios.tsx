import { useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';
import EmpleadoPicker from '../components/EmpleadoPicker';

const $ = (n: any) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtF = (s?: string | null) => s ? new Date(s).toLocaleDateString('es-AR') : '—';

// Certificación de servicios y remuneraciones (ANSES PS.6.2) — base para el egreso.
export default function CertServicios() {
  const [sel, setSel] = useState<Empleado | null>(null);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  async function generar(e: Empleado | null) {
    setSel(e); setData(null); setErr('');
    if (!e) return;
    try { setBusy(true); setData(await api.get<any>(`/reportes/certificacion-servicios?empleadoId=${e.id}`)); }
    catch (er: any) { setErr(er.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="card no-print" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ marginTop: 0 }}>Generá la base de la Certificación de Servicios y Remuneraciones (ANSES PS.6.2) desde el legajo y las remuneraciones sujetas a aportes registradas.</p>
        <EmpleadoPicker onSelect={generar} />
        {busy && <p className="muted">Generando…</p>}
        {err && <p className="err">⚠ {err}</p>}
      </div>

      {data && (
        <div className="card">
          <div className="row no-print" style={{ justifyContent: 'flex-end', marginBottom: 8 }}><button className="btn" onClick={() => window.print()}>🖨 Imprimir</button></div>
          <h2 style={{ marginTop: 0 }}>Certificación de Servicios y Remuneraciones</h2>
          <div className="grid2" style={{ gap: 6, marginBottom: 12 }}>
            <div><strong>Empleador:</strong> {data.empleador.razonSocial}</div>
            <div><strong>CUIT:</strong> {data.empleador.cuit || '—'}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong>Domicilio:</strong> {data.empleador.domicilio || '—'}</div>
            <div><strong>Trabajador:</strong> {data.trabajador.nom} <span className="muted">(leg. {data.trabajador.legNum})</span></div>
            <div><strong>CUIL:</strong> {data.trabajador.cuil || '—'}</div>
            <div><strong>Ingreso:</strong> {fmtF(data.trabajador.ingreso)}</div>
            <div><strong>Egreso:</strong> {fmtF(data.trabajador.egreso)} {data.trabajador.causaEgreso ? `· ${data.trabajador.causaEgreso}` : ''}</div>
            <div><strong>Categoría:</strong> {data.trabajador.categoria || '—'}</div>
            <div><strong>CCT:</strong> {data.trabajador.cct || '—'}</div>
          </div>
          <h3 style={{ margin: '10px 0 6px' }}>Remuneraciones sujetas a aportes</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg2)' }}><th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid var(--border)' }}>Período</th><th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '2px solid var(--border)' }}>Remuneración</th></tr></thead>
            <tbody>
              {data.remuneraciones.map((r: any) => <tr key={r.periodo}><td style={{ padding: '4px 8px' }}>{r.periodo}</td><td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>$ {$(r.remun)}</td></tr>)}
              {!data.remuneraciones.length && <tr><td colSpan={2} className="muted" style={{ padding: 12, textAlign: 'center' }}>Sin remuneraciones registradas en el sistema.</td></tr>}
            </tbody>
            {data.remuneraciones.length > 0 && <tfoot><tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}><td style={{ padding: '6px 8px' }}>Total</td><td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>$ {$(data.total)}</td></tr></tfoot>}
          </table>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{data.nota}</p>
        </div>
      )}
    </>
  );
}
