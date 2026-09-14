import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';
import type { Empleado } from '../lib/types';

// Libro de asiento de sueldos: réplica de las 14 hojas del Excel mensual que
// Contabilidad arma a mano. Se consulta en pantalla y se baja en .xlsx.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const $ = (n: any) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esNum = (v: any) => typeof v === 'number' || (v !== '' && v !== null && v !== undefined && !isNaN(Number(v)) && String(v).trim() !== '');

interface Hoja {
  key: string; titulo: string; columnas: string[]; filas: any[][];
  nota?: string; resumen?: any[][];
  totales?: { debe: number; haber: number; diferencia: number; balanceado: boolean };
}
interface Falta { nivel: string; dato: string; detalle: string; ejemplos?: string[]; }
interface Libro {
  periodo: { anio: number; mes: number; empresa: string; fecha: string };
  resumen: { legajos: number; debe: number; haber: number; diferencia: number; balanceado: boolean };
  hojas: Hoja[]; faltantes: Falta[];
}
interface Cuenta {
  id: number; columna: string; centro_costo: string | null; cuenta: string;
  descripcion: string; naturaleza: string; orden: number; activo: boolean;
}

const COLOR_NIVEL: Record<string, string> = {
  bloqueante: 'var(--red)', alto: 'var(--red)', medio: 'var(--accent2)', bajo: 'var(--t3)',
};

export default function AsientoSueldos() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [empresa, setEmpresa] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [libro, setLibro] = useState<Libro | null>(null);
  const [hoja, setHoja] = useState('ASTO SUELDO');
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState('');
  const [verCuentas, setVerCuentas] = useState(false);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [edit, setEdit] = useState<Record<number, string>>({});

  useEffect(() => {
    api.get<Empleado[]>('/empleados')
      .then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort()))
      .catch(() => { /* el selector queda en "Todas" */ });
  }, []);

  async function cargar() {
    setErr(''); setCargando(true);
    try {
      const p = new URLSearchParams({ anio: String(anio), mes: String(mes) });
      if (empresa) p.set('empresa', empresa);
      setLibro(await api.get<Libro>(`/asiento-sueldos?${p}`));
    } catch (e: any) { setErr(e.message); setLibro(null); }
    finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [anio, mes, empresa]);

  async function cargarCuentas() {
    try { const r = await api.get<{ cuentas: Cuenta[] }>('/asiento-sueldos/cuentas'); setCuentas(r.cuentas); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { if (verCuentas && !cuentas.length) cargarCuentas(); /* eslint-disable-next-line */ }, [verCuentas]);

  async function guardarCuenta(c: Cuenta) {
    const nueva = edit[c.id];
    if (nueva === undefined || nueva === c.cuenta) return;
    try {
      await api.put(`/asiento-sueldos/cuentas/${c.id}`, { cuenta: nueva });
      setCuentas((cs) => cs.map((x) => (x.id === c.id ? { ...x, cuenta: nueva } : x)));
      setEdit((e) => { const n = { ...e }; delete n[c.id]; return n; });
      cargar();
    } catch (e: any) { setErr(e.message); }
  }

  async function descargar() {
    setErr('');
    try {
      const p = new URLSearchParams({ anio: String(anio), mes: String(mes) });
      if (empresa) p.set('empresa', empresa);
      const blob = await fetchBlob(`/asiento-sueldos/xlsx?${p}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${anio}-${String(mes).padStart(2, '0')} Asiento ${empresa || 'Grupo'}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: any) { setErr(e.message); }
  }

  // Reconstruye el bloque `bases` de los recibos del período que fueron liquidados
  // antes de que el motor empezara a guardarlo. No recalcula el recibo.
  const [rehaciendo, setRehaciendo] = useState(false);
  const [aviso, setAviso] = useState('');
  async function reconstruirBases() {
    if (!window.confirm('Reconstruir las bases imponibles de los recibos de este período?\n\nNo se recalcula ninguna liquidación: sólo se completa el bloque de bases que falta, usando los totales ya guardados y los topes vigentes de ese mes.')) return;
    setErr(''); setAviso(''); setRehaciendo(true);
    try {
      const r = await api.post<{ recibos: number; actualizados: number }>('/asiento-sueldos/backfill-bases',
        { anio, mes, empresa: empresa || undefined });
      setAviso(`${r.actualizados} recibo(s) actualizado(s) de ${r.recibos} sin bases.`);
      await cargar();
    } catch (e: any) { setErr(e.message); }
    finally { setRehaciendo(false); }
  }

  const faltanBases = !!libro?.faltantes?.some((f) => /bases imponibles/i.test(f.dato));
  const actual = libro?.hojas.find((h) => h.key === hoja) || libro?.hojas[0];

  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Mes</label>
          <select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="field"><label>Año</label>
          <input className="input" type="number" style={{ width: 100 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </div>
        <div className="field"><label>Empresa</label>
          <select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
            <option value="">Todas</option>
            {empresas.map((em) => <option key={em} value={em}>{em}</option>)}
          </select>
        </div>
        <button className="btn" onClick={descargar} disabled={!libro}>⬇ Descargar Excel</button>
        <button className="btn ghost" onClick={cargar} disabled={cargando}>{cargando ? 'Generando…' : 'Actualizar'}</button>
        {faltanBases && <button className="btn ghost" onClick={reconstruirBases} disabled={rehaciendo}>
          {rehaciendo ? 'Reconstruyendo…' : '↻ Reconstruir bases del período'}
        </button>}
      </div>

      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {aviso && <div className="ok" style={{ marginBottom: 12 }}>{aviso}</div>}

      {libro && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
            <div><div className="muted" style={{ fontSize: 12 }}>Legajos liquidados</div><strong style={{ fontSize: 18 }}>{libro.resumen.legajos}</strong></div>
            <div><div className="muted" style={{ fontSize: 12 }}>Total débitos</div><strong style={{ fontSize: 18, fontFamily: 'monospace' }}>{$(libro.resumen.debe)}</strong></div>
            <div><div className="muted" style={{ fontSize: 12 }}>Total créditos</div><strong style={{ fontSize: 18, fontFamily: 'monospace' }}>{$(libro.resumen.haber)}</strong></div>
            <div><div className="muted" style={{ fontSize: 12 }}>Diferencia</div><strong style={{ fontSize: 18, fontFamily: 'monospace' }}>{$(libro.resumen.diferencia)}</strong></div>
            <span className="badge" style={{ color: libro.resumen.balanceado ? 'var(--green)' : 'var(--red)' }}>
              {libro.resumen.balanceado ? '✓ Asiento balanceado' : '⚠ El asiento no cuadra'}
            </span>
          </div>
        </div>
      )}

      {!!libro?.faltantes?.length && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>Datos a cargar o generar para emitir el reporte completo</h3>
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Dato</th><th style={{ textAlign: 'left' }}>Situación</th></tr></thead>
            <tbody>
              {libro.faltantes.map((f, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    <span className="badge" style={{ color: COLOR_NIVEL[f.nivel] || 'var(--t3)', marginRight: 6 }}>{f.nivel}</span>
                    {f.dato}
                  </td>
                  <td>
                    {f.detalle}
                    {!!f.ejemplos?.length && <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>Ej.: {f.ejemplos.join(' · ')}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {libro && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {libro.hojas.map((h) => (
            <button key={h.key} className={h.key === actual?.key ? 'btn' : 'btn ghost'}
              style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setHoja(h.key)}>
              {h.titulo} <span className="muted">({h.filas.length})</span>
            </button>
          ))}
        </div>
      )}

      {actual && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <strong>{actual.titulo}</strong>
            {actual.nota && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{actual.nota}</div>}
          </div>
          <div style={{ overflow: 'auto', maxHeight: '60vh' }}>
            <table style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
              <thead><tr>{actual.columnas.map((c, i) => <th key={i} style={{ textAlign: 'left', position: 'sticky', top: 0, background: 'var(--bg1)' }}>{c}</th>)}</tr></thead>
              <tbody>
                {actual.filas.map((f, i) => (
                  <tr key={i}>
                    {f.map((v, j) => (
                      <td key={j} style={{ textAlign: esNum(v) ? 'right' : 'left', fontFamily: esNum(v) ? 'monospace' : undefined }}>
                        {v === '' || v === null || v === undefined ? '' : esNum(v) ? $(v) : String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
                {!actual.filas.length && <tr><td colSpan={actual.columnas.length} className="muted" style={{ textAlign: 'center', padding: 16 }}>Sin datos para este período.</td></tr>}
              </tbody>
              {actual.totales && (
                <tfoot><tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td colSpan={5} style={{ fontWeight: 700 }}>TOTALES</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{$(actual.totales.debe)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{$(actual.totales.haber)}</td>
                  <td colSpan={2} />
                </tr></tfoot>
              )}
            </table>
          </div>
          {!!actual.resumen?.length && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 12 }}>
              {actual.resumen.map((r, i) => <div key={i}><span className="muted">{r[0]}: </span><span style={{ fontFamily: 'monospace' }}>{$(r[1])}</span></div>)}
            </div>
          )}
        </div>
      )}

      <div style={{ margin: '14px 0' }}>
        <button className="btn ghost" onClick={() => setVerCuentas((v) => !v)}>
          {verCuentas ? '▾' : '▸'} Plan de cuentas del asiento ({cuentas.length || '…'})
        </button>
      </div>
      {verCuentas && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <strong>Mapeo concepto de nómina → cuenta contable</strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Editá el número de cuenta y confirmá con Enter. La apertura por centro de costos define a qué cuenta de resultado va cada legajo.
            </div>
          </div>
          <div style={{ overflow: 'auto', maxHeight: '50vh' }}>
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead><tr>
                <th style={{ textAlign: 'left' }}>Columna</th><th style={{ textAlign: 'left' }}>C. costos</th>
                <th style={{ textAlign: 'left' }}>Cuenta</th><th style={{ textAlign: 'left' }}>Descripción</th>
                <th style={{ textAlign: 'left' }}>Naturaleza</th>
              </tr></thead>
              <tbody>
                {cuentas.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'monospace' }}>{c.columna}</td>
                    <td>{c.centro_costo || <span className="muted">todos</span>}</td>
                    <td>
                      <input className="input" style={{ width: 110, fontFamily: 'monospace', padding: '2px 6px' }}
                        value={edit[c.id] ?? c.cuenta}
                        onChange={(e) => setEdit((s) => ({ ...s, [c.id]: e.target.value }))}
                        onBlur={() => guardarCuenta(c)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    </td>
                    <td>{c.descripcion}</td>
                    <td><span className="badge">{c.naturaleza}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
