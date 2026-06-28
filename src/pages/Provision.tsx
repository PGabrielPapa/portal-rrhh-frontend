import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';

interface Fila { empleadoId: number; legNum: string; nom: string; empresa: string; bruto: number; antiguedad: number; diasVac: number; sacMes: number; vacMes: number; sacSobreVac: number; subtotal: number; conCargas: number }
interface Resp { periodo: { anio: number; mes: number }; contribPct: number; filas: Fila[]; totales: Record<string, number> }
const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const $ = (n: number) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Provision() {
  const d = new Date();
  const [anio, setAnio] = useState(d.getFullYear());
  const [mes, setMes] = useState(d.getMonth() + 1);
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState('');

  async function cargar() { setErr(''); try { setData(await api.get<Resp>(`/provision?anio=${anio}&mes=${mes}`)); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [anio, mes]);

  function exportar() {
    if (!data) return;
    const rows = data.filas.map((f) => ({ Legajo: f.legNum, Empleado: f.nom, Empresa: f.empresa, Bruto: f.bruto, 'Días vac.': f.diasVac, 'Prov. SAC': f.sacMes, 'Prov. Vacaciones': f.vacMes, 'SAC s/Vac': f.sacSobreVac, Subtotal: f.subtotal, 'Con cargas': f.conCargas }));
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Provisiones');
    XLSX.writeFile(wb, `provisiones_${anio}_${String(mes).padStart(2, '0')}.xlsx`);
  }
  const t = data?.totales;
  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
        <div className="field"><label>Año</label><input className="input" style={{ width: 100 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
        <div style={{ flex: 1 }} />
        {data && <button className="btn ghost" onClick={exportar}>⬇ Exportar Excel</button>}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Provisión mensual devengada de SAC (1/12) y vacaciones (días por antigüedad, LCT art. 150/155), con SAC sobre vacaciones y cargas patronales. Base para el asiento contable.</p>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {data && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
            <thead><tr style={{ background: 'var(--bg2)' }}>
              {['Leg.', 'Empleado', 'Bruto', 'Días vac.', 'Prov. SAC', 'Prov. Vac.', 'SAC s/Vac', 'Subtotal', 'Con cargas'].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: i < 2 ? 'left' : 'right', borderBottom: '2px solid var(--border)' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.filas.map((f) => (
                <tr key={f.empleadoId}>
                  <td style={{ padding: '4px 8px' }}>{f.legNum}</td><td style={{ padding: '4px 8px' }}>{f.nom}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.bruto)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>{f.diasVac}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.sacMes)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.vacMes)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.sacSobreVac)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.subtotal)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.conCargas)}</td>
                </tr>
              ))}
              {!data.filas.length && <tr><td colSpan={9} className="muted" style={{ padding: 10 }}>Sin empleados activos.</td></tr>}
            </tbody>
            {t && data.filas.length > 0 && (
              <tfoot><tr style={{ fontWeight: 700, background: 'var(--bg2)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={4} style={{ padding: '6px 8px' }}>Totales ({data.filas.length})</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.sacMes)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.vacMes)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.sacSobreVac)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.subtotal)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.conCargas)}</td>
              </tr></tfoot>
            )}
          </table>
        </div>
      )}
    </>
  );
}
