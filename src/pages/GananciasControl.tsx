import { Fragment, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';

interface FilaCtrl {
  empleadoId: number; legNum: string; nom: string; empresa: string; cuil: string;
  gravado: number; dedGenerales: number; dedPersonales: number; dedSiradig: number; siradigSinClasificar: number; siradigDetalle?: { label: string; computable: number }[];
  remSujeta: number; impuesto: number; retenidoAnterior: number; aRetener: number; devolucion: number;
}
interface Resp { periodo: { anio: number; mes: number; anual: boolean }; filas: FilaCtrl[]; totales: Record<string, number>; }

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const $ = (n: number) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GananciasControl() {
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [anual, setAnual] = useState(false);
  const [data, setData] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [exp, setExp] = useState<Set<number>>(new Set());

  async function cargar() {
    setErr(''); setBusy(true); setData(null);
    try { setData(await api.get<Resp>(`/ganancias/control?anio=${anio}&mes=${mes}${anual ? '&anual=1' : ''}`)); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  function exportar() {
    if (!data) return;
    const rows = data.filas.map((f) => ({
      Legajo: f.legNum, Empleado: f.nom, CUIL: f.cuil, Empresa: f.empresa,
      'Rem. gravada': f.gravado, 'Ded. generales': f.dedGenerales, 'Ded. personales': f.dedPersonales,
      'SiRADIG (computable)': f.dedSiradig, 'Rem. sujeta': f.remSujeta, 'Impuesto determinado': f.impuesto,
      'Retenido anterior': f.retenidoAnterior, 'A retener': f.aRetener, 'Devolución': f.devolucion,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Control Ganancias');
    XLSX.writeFile(wb, `control_ganancias_${anio}_${anual ? 'anual' : String(mes).padStart(2, '0')}.xlsx`);
  }

  const t = data?.totales;
  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Mes</label><select className="input" value={mes} disabled={anual} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
        <div className="field"><label>Año</label><input className="input" style={{ width: 100 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
        <label className="row muted" style={{ gap: 6 }}><input type="checkbox" checked={anual} onChange={(e) => setAnual(e.target.checked)} /> Anualizada (liquidación final)</label>
        <button className="btn" onClick={cargar} disabled={busy}>{busy ? 'Calculando…' : 'Actualizar'}</button>
        <div style={{ flex: 1 }} />
        {data && <button className="btn ghost" onClick={exportar}>⬇ Exportar Excel</button>}
      </div>

      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {busy && <div className="muted">Calculando el impuesto de cada empleado…</div>}

      {data && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['Leg.', 'Empleado', 'Rem. gravada', 'Ded. grales.', 'Ded. pers.', 'SiRADIG', 'Rem. sujeta', 'Impuesto', 'Ret. ant.', 'A retener', 'Devol.'].map((h, i) => (
                  <th key={i} style={{ padding: '6px 8px', textAlign: i < 2 ? 'left' : 'right', borderBottom: '2px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.filas.map((f) => {
                const det = f.siradigDetalle || [];
                const abierto = exp.has(f.empleadoId);
                return (
                <Fragment key={f.empleadoId}>
                <tr style={{ cursor: det.length ? 'pointer' : undefined }} onClick={() => det.length && setExp((p) => { const z = new Set(p); if (z.has(f.empleadoId)) z.delete(f.empleadoId); else z.add(f.empleadoId); return z; })}>
                  <td style={{ padding: '4px 8px' }}>{f.legNum}</td>
                  <td style={{ padding: '4px 8px' }}>{det.length ? (abierto ? '▾ ' : '▸ ') : ''}{f.nom}{f.siradigSinClasificar > 0 && <span title="Tiene deducciones SiRADIG sin clasificar" style={{ color: '#92400e' }}> ⚠</span>}</td>
                  {[f.gravado, f.dedGenerales, f.dedPersonales, f.dedSiradig, f.remSujeta, f.impuesto, f.retenidoAnterior, f.aRetener, f.devolucion].map((v, i) => (
                    <td key={i} style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(v)}</td>
                  ))}
                </tr>
                {abierto && det.length > 0 && (
                  <tr><td colSpan={11} style={{ padding: '4px 28px 8px', background: 'var(--bg2)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Deducciones SiRADIG por concepto (computable)</div>
                    {det.map((d, i) => <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 12, maxWidth: 460 }}><span>{d.label}</span><span style={{ fontFamily: 'monospace' }}>$ {$(d.computable)}</span></div>)}
                  </td></tr>
                )}
                </Fragment>
                );
              })}
              {!data.filas.length && <tr><td colSpan={11} className="muted" style={{ padding: 10 }}>Sin empleados activos para el período.</td></tr>}
            </tbody>
            {t && data.filas.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700, background: 'var(--bg2)', borderTop: '2px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px' }} colSpan={2}>Totales ({data.filas.length})</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.gravado)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.dedGenerales)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.dedPersonales)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.dedSiradig)}</td>
                  <td />
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.impuesto)}</td>
                  <td />
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.aRetener)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(t.devolucion)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </>
  );
}
