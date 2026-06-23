import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';
import type { Empleado } from '../lib/types';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const $ = (n: any) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Row { empresa: string; legNum: string; nom: string; cuil?: string; tipo: string; remunerativo: number; noRemunerativo: number; descuentos: number; neto: number; }
interface Resp { items: Row[]; totales: { remunerativo: number; noRemunerativo: number; descuentos: number; neto: number; cant: number }; }

export default function LibroSueldos() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [empresa, setEmpresa] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [dis, setDis] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get<Empleado[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {}); }, []);
  useEffect(() => { api.get('/reportes/lsd-diseno').then(setDis).catch(() => {}); }, []);
  async function cargar() { setErr(''); try { const p = new URLSearchParams({ anio: String(anio), mes: String(mes) }); if (empresa) p.set('empresa', empresa); setData(await api.get<Resp>(`/reportes/libro-sueldos?${p}`)); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [anio, mes, empresa]);

  async function archivoLsd() {
    setErr(''); setOk(''); setBusy(true);
    try {
      const p = new URLSearchParams({ anio: String(anio), mes: String(mes) });
      if (empresa) p.set('empresa', empresa);
      const blob = await fetchBlob(`/reportes/lsd-archivo?${p}`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `LSD_${anio}${String(mes).padStart(2, '0')}.txt`;
      a.click(); URL.revokeObjectURL(a.href);
      setOk('Archivo del Libro de Sueldos Digital generado. Importalo en el servicio LSD de ARCA; el período y el N° de liquidación del .txt deben coincidir con los del servicio.');
      api.get('/reportes/lsd-diseno').then(setDis).catch(() => {});
    } catch (e: any) { setErr(e.message || 'No se pudo generar el archivo'); }
    finally { setBusy(false); }
  }
  async function actualizarDis() {
    const descripcion = window.prompt('Describí la actualización del diseño LSD según ARCA (qué cambió):', '');
    if (descripcion === null) return;
    const urlArca = window.prompt('URL del diseño en ARCA (opcional):', dis?.urlArca || '') || undefined;
    try { await api.patch('/reportes/lsd-diseno', { descripcion, urlArca }); setOk('Diseño LSD registrado en una nueva versión.'); api.get('/reportes/lsd-diseno').then(setDis).catch(() => {}); } catch (e: any) { setErr(e.message); }
  }
  function csv() {
    if (!data) return;
    const head = 'Empresa,Legajo,Nombre,CUIL,Tipo,Remunerativo,No remunerativo,Descuentos,Neto';
    const lines = data.items.map((r) => `"${r.empresa}",${r.legNum},"${r.nom}",${r.cuil || ''},${r.tipo},${r.remunerativo},${r.noRemunerativo},${r.descuentos},${r.neto}`);
    const blob = new Blob(['﻿' + [head, ...lines].join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `libro_sueldos_${anio}_${String(mes).padStart(2, '0')}.csv`; a.click();
  }

  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
        <div className="field"><label>Año</label><input className="input" type="number" style={{ width: 100 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
        <div className="field"><label>Empresa</label><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select></div>
        <button className="btn" onClick={archivoLsd} disabled={!data?.items.length || busy}>{busy ? 'Generando…' : '⬇ Generar Libro de Sueldos Digital (.txt)'}</button>
        <button className="btn ghost" onClick={csv} disabled={!data?.items.length}>⬇ CSV</button>
      </div>
      {dis && (
        <div className="card" style={{ marginBottom: 12, padding: '8px 12px', fontSize: 13 }}>
          {dis.actualizado
            ? <b style={{ color: 'var(--yellow)' }}>⚠ El diseño de registro LSD se actualizó a la versión {dis.version}. El archivo se generará con el diseño actualizado.</b>
            : dis.primeraVez
              ? <span>Diseño LSD vigente <b>v{dis.version}</b> ({dis.disenoLib}). Verificá en ARCA que sea el último antes de presentar.</span>
              : <span>Diseño LSD <b>v{dis.version}</b> ({dis.disenoLib}). Última generación con v{dis.ultimaVersion}.</span>}
          {' '}<a href={dis.urlArca} target="_blank" rel="noreferrer">Ver diseños en ARCA</a>
          {' · '}<button className="btn ghost" style={{ padding: '1px 8px', fontSize: 12 }} onClick={actualizarDis}>Registrar actualización</button>
        </div>
      )}
      {ok && <div className="card" style={{ marginBottom: 12, padding: '8px 12px', fontSize: 13, color: 'var(--green)' }}>✓ {ok}</div>}
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Empresa</th><th>Legajo</th><th>Nombre</th><th>CUIL</th><th className="n" style={{ textAlign: 'right' }}>Remun.</th><th style={{ textAlign: 'right' }}>No rem.</th><th style={{ textAlign: 'right' }}>Descuentos</th><th style={{ textAlign: 'right' }}>Neto</th></tr></thead>
          <tbody>
            {data?.items.map((r, i) => (
              <tr key={i}><td>{r.empresa}</td><td>{r.legNum}</td><td>{r.nom}</td><td className="muted">{r.cuil || '—'}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(r.remunerativo)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(r.noRemunerativo)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{$(r.descuentos)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{$(r.neto)}</td></tr>
            ))}
            {!data?.items.length && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 20 }}>No hay recibos liquidados para ese período.</td></tr>}
          </tbody>
          {data?.items.length ? <tfoot><tr style={{ borderTop: '2px solid var(--border)' }}><td colSpan={4} style={{ fontWeight: 700 }}>Totales ({data.totales.cant})</td>
            <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{$(data.totales.remunerativo)}</td>
            <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{$(data.totales.noRemunerativo)}</td>
            <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{$(data.totales.descuentos)}</td>
            <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{$(data.totales.neto)}</td></tr></tfoot> : null}
        </table>
      </div>
    </>
  );
}
