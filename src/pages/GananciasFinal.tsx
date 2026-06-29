import { Fragment, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';

interface Fila { empleadoId: number; legNum: string; nom: string; empresa: string; cuil: string; gravado: number; dedGenerales: number; dedPersonales: number; dedSiradig: number; impuesto: number; retenido: number; aRetener: number; aDevolver: number; siradigSinClasificar: number; siradigDetalle?: { label: string; computable: number }[] }
interface Resp { anio: number; filas: Fila[]; totales: Record<string, number> }
const $ = (n: number) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GananciasFinal() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [data, setData] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [exp, setExp] = useState<Set<number>>(new Set());

  async function cargar() {
    setErr(''); setBusy(true); setData(null);
    try { setData(await api.get<Resp>(`/ganancias/final-anual?anio=${anio}`)); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  function exportar() {
    if (!data) return;
    const conceptos = Array.from(new Set(data.filas.flatMap((f) => (f.siradigDetalle || []).map((d) => d.label)))).sort();
    const rows = data.filas.map((f) => {
      const m: Record<string, number> = {}; for (const d of (f.siradigDetalle || [])) m[d.label] = d.computable;
      const o: Record<string, any> = { Legajo: f.legNum, Empleado: f.nom, CUIL: f.cuil, 'Rem. gravada': f.gravado, 'SiRADIG (computable)': f.dedSiradig };
      for (const c of conceptos) o[`SiRADIG: ${c}`] = m[c] || 0;
      o['Impuesto anual'] = f.impuesto; o['Retenido en el año'] = f.retenido; o['A retener (saldo)'] = f.aRetener; o['A devolver'] = f.aDevolver;
      return o;
    });
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
              {data.filas.map((f) => {
                const det = f.siradigDetalle || [];
                const abierto = exp.has(f.empleadoId);
                return (
                <Fragment key={f.empleadoId}>
                <tr style={{ cursor: det.length ? 'pointer' : undefined }} onClick={() => det.length && setExp((p) => { const z = new Set(p); if (z.has(f.empleadoId)) z.delete(f.empleadoId); else z.add(f.empleadoId); return z; })}>
                  <td style={{ padding: '4px 8px' }}>{f.legNum}</td>
                  <td style={{ padding: '4px 8px' }}>{det.length ? (abierto ? '▾ ' : '▸ ') : ''}{f.nom}{f.siradigSinClasificar > 0 && <span title="SiRADIG sin clasificar" style={{ color: '#92400e' }}> ⚠</span>}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.gravado)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.impuesto)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.retenido)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: f.aRetener > 0 ? '#b91c1c' : undefined }}>{$(f.aRetener)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: f.aDevolver > 0 ? '#15803d' : undefined }}>{$(f.aDevolver)}</td>
                </tr>
                {abierto && det.length > 0 && (
                  <tr><td colSpan={7} style={{ padding: '4px 28px 8px', background: 'var(--bg2)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Deducciones SiRADIG por concepto (computable)</div>
                    {det.map((d, i) => <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 12, maxWidth: 460 }}><span>{d.label}</span><span style={{ fontFamily: 'monospace' }}>$ {$(d.computable)}</span></div>)}
                  </td></tr>
                )}
                </Fragment>
                );
              })}
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
