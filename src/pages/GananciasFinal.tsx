import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';

interface Fila { empleadoId: number; legNum: string; nom: string; empresa: string; cuil: string; gravado: number; dedGenerales: number; dedPersonales: number; dedSiradig: number; impuesto: number; retenido: number; aRetener: number; aDevolver: number; siradigSinClasificar: number }
interface Resp { anio: number; filas: Fila[]; totales: Record<string, number> }
const $ = (n: number) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GananciasFinal() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [data, setData] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function cargar() {
    setErr(''); setBusy(true); setData(null);
    try { setData(await api.get<Resp>(`/ganancias/final-anual?anio=${anio}`)); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  function exportar() {
    if (!data) return;
    const rows = data.filas.map((f) => ({ Legajo: f.legNum, Empleado: f.nom, CUIL: f.cuil, 'Rem. gravada': f.gravado, 'Impuesto anual': f.impuesto, 'Retenido en el año': f.retenido, 'A retener (saldo)': f.aRetener, 'A devolver': f.aDevolver }));
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Liq. final Ganancias');
    XLSX.writeFile(wb, `liquidacion_final_ganancias_${anio}.xlsx`);
  }
  const t = data?.totales;
  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Año fiscal</label><input className="input" style={{ width: 110 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
        <button className="btn" onClick={cargar} disabled={busy}>{busy ? 'Calculando…' : 'Calcular'}</button>
        <div style={{ flex: 1 }} />
        {data && <button className="btn ghost" onClick={exportar}>⬇ Exportar Excel</button>}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Liquidación anual del Impuesto a las Ganancias (RG 4003): impuesto anual determinado contra lo retenido en el año, incluyendo deducciones del SiRADIG y carga inicial. Saldo a retener o a devolver.</p>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {busy && <div className="muted">Calculando la liquidación anual de cada empleado…</div>}
      {data && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
            <thead><tr style={{ background: 'var(--bg2)' }}>
              {['Leg.', 'Empleado', 'Rem. gravada', 'Impuesto anual', 'Retenido', 'A retener', 'A devolver'].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: i < 2 ? 'left' : 'right', borderBottom: '2px solid var(--border)' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.filas.map((f) => (
                <tr key={f.empleadoId}>
                  <td style={{ padding: '4px 8px' }}>{f.legNum}</td>
                  <td style={{ padding: '4px 8px' }}>{f.nom}{f.siradigSinClasificar > 0 && <span title="SiRADIG sin clasificar" style={{ color: '#92400e' }}> ⚠</span>}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.gravado)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.impuesto)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.retenido)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: f.aRetener > 0 ? '#b91c1c' : undefined }}>{$(f.aRetener)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: f.aDevolver > 0 ? '#15803d' : undefined }}>{$(f.aDevolver)}</td>
                </tr>
              ))}
              {!data.filas.length && <tr><td colSpan={7} className="muted" style={{ padding: 10 }}>Sin empleados alcanzados por Ganancias en {anio}.</td></tr>}
            </tbody>
            {t && data.filas.length > 0 && (
              <tfoot><tr style={{ fontWeight: 700, background: 'var(--bg2)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={3} style={{ padding: '6px 8px' }}>Totales ({data.filas.length})</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.impuesto)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.retenido)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.aRetener)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.aDevolver)}</td>
              </tr></tfoot>
            )}
          </table>
        </div>
      )}
    </>
  );
}
