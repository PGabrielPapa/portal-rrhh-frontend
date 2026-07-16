import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';

interface Item { cuil: string; nom: string; legNum: string; empresa: string; fecha: string; retencion: number; devolucion: number; neto: number; }
interface Resumen { registros: number; retenciones: number; devoluciones: number; totalRetenido: number; totalDevuelto: number; }
interface Diseno { version: number; modo: string; descripcion: string; urlArca?: string; autoActualizada?: boolean; ultimaVersion?: number | null; actualizado?: boolean; mesGenerado?: { version: number; alDia: boolean; fecha: string } | null; }
const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const $ = (n: number) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SicoreGanancias() {
  const d = new Date();
  const [anio, setAnio] = useState(d.getFullYear());
  const [mes, setMes] = useState(d.getMonth() + 1);
  const [empresa, setEmpresa] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [diseno, setDiseno] = useState<Diseno | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.get<any[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {}); }, []);
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [anio, mes, empresa]);

  async function cargar() {
    setErr('');
    try {
      const qs = new URLSearchParams({ anio: String(anio), mes: String(mes) }); if (empresa) qs.set('empresa', empresa);
      const r = await api.get<{ items: Item[]; resumen: Resumen }>(`/sicore/ganancias/preview?${qs}`);
      setItems(r.items); setResumen(r.resumen);
      api.get<Diseno>(`/sicore/diseno?${qs}`).then(setDiseno).catch(() => {});
    } catch (e: any) { setErr(e.message); }
  }
  async function descargar(fmt: 'txt' | 'csv') {
    try {
      const qs = new URLSearchParams({ anio: String(anio), mes: String(mes) }); if (empresa) qs.set('empresa', empresa);
      const blob = await fetchBlob(`/sicore/ganancias/${fmt}?${qs}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `SICORE_GANANCIAS_${anio}${String(mes).padStart(2, '0')}.${fmt}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>
        Informe a ARCA de las retenciones y devoluciones de Impuesto a las Ganancias 4ª (relación de dependencia). Régimen 602, impuesto 217 (RG 2233 / SICORE).
      </p>
      <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
        <div className="field"><label>Año</label><input className="input" style={{ width: 100 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
        <div className="field"><label>Empresa</label><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select></div>
        <button className="btn" onClick={() => descargar('txt')} disabled={!items.length}>Descargar SICORE (.txt)</button>
        <button className="btn ghost" onClick={() => descargar('csv')} disabled={!items.length}>Descargar CSV</button>
      </div>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}

      {diseno && (
        <div className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${diseno.actualizado ? 'var(--yellow)' : 'var(--green)'}` }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13 }}>
              <b>Diseño de registro: {diseno.modo} v{diseno.version}</b>
              {diseno.actualizado ? <span className="badge" style={{ marginLeft: 6, color: 'var(--yellow)' }}>hay una versión nueva del diseño</span>
                : <span className="badge" style={{ marginLeft: 6, color: 'var(--green)' }}>al día</span>}
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{diseno.descripcion}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {diseno.mesGenerado
                  ? `Este período ya se generó con el diseño v${diseno.mesGenerado.version}${diseno.mesGenerado.alDia ? ' (al día)' : ' (desactualizado: regeneralo)'}.`
                  : 'Este período todavía no se generó.'}
              </div>
            </div>
            {diseno.urlArca && <a href={diseno.urlArca} target="_blank" rel="noreferrer" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Diseño en ARCA ↗</a>}
          </div>
        </div>
      )}
      {resumen && (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div className="card" style={{ flex: '1 1 150px' }}><div className="muted" style={{ fontSize: 12 }}>Registros</div><div style={{ fontSize: 22, fontWeight: 700 }}>{resumen.registros}</div></div>
          <div className="card" style={{ flex: '1 1 150px' }}><div className="muted" style={{ fontSize: 12 }}>Retenido</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>$ {$(resumen.totalRetenido)}</div><div className="muted" style={{ fontSize: 11 }}>{resumen.retenciones} empleados</div></div>
          <div className="card" style={{ flex: '1 1 150px' }}><div className="muted" style={{ fontSize: 12 }}>Devuelto</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--yellow)' }}>$ {$(resumen.totalDevuelto)}</div><div className="muted" style={{ fontSize: 11 }}>{resumen.devoluciones} empleados</div></div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>CUIL</th><th>Empleado</th><th>Empresa</th><th style={{ textAlign: 'right' }}>Retención</th><th style={{ textAlign: 'right' }}>Devolución</th><th style={{ textAlign: 'right' }}>Neto</th></tr></thead>
          <tbody>
            {items.map((x, i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'monospace' }}>{x.cuil || '—'}</td>
                <td>{x.nom} <span className="muted">({x.legNum})</span></td>
                <td>{x.empresa}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>$ {$(x.retencion)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }} className="muted">{x.devolucion ? '$ ' + $(x.devolucion) : '—'}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>$ {$(x.neto)}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin retenciones de Ganancias en el período.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
        El .txt usa el diseño de registro de comprobantes de SICORE. Ante la migración de ARCA al SIRE, verificá el diseño vigente antes de la primera importación (los datos del detalle y el CSV son exactos).
      </p>
    </>
  );
}
