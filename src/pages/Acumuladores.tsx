import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';

interface Regla { seccion: string; tipoLinea: string; patron: string; signo: number }
interface Acum { id: number; codigo: string; nombre: string; tipo: string; afectaGanancias: boolean; activo: boolean; orden: number; reglas: Regla[] }
interface Catalogos { tiposVentana: [string, string][]; tiposLinea: [string, string][]; secciones: [string, string][] }
interface ConsultaResp {
  anio: number;
  meses: number[];
  acumuladores: { codigo: string; nombre: string; tipo: string; afectaGanancias: boolean }[];
  porEmpleado: { empleadoId: number; legNum: string; nom: string; empresa: string; mes: number; valores: Record<string, number> }[];
  porLiquidacion: { mes: number; empleados: number; valores: Record<string, number> }[];
  totales: Record<string, number>;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const $ = (n: number) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const reglaVacia = (): Regla => ({ seccion: 'haberes', tipoLinea: '*', patron: '', signo: 1 });

export default function Acumuladores() {
  const [tab, setTab] = useState<'consulta' | 'def'>('consulta');
  const [cat, setCat] = useState<Catalogos | null>(null);
  useEffect(() => { api.get<Catalogos>('/acumuladores/catalogos').then(setCat).catch(() => {}); }, []);
  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button className={tab === 'consulta' ? 'btn' : 'btn ghost'} onClick={() => setTab('consulta')}>Consulta</button>
        <button className={tab === 'def' ? 'btn' : 'btn ghost'} onClick={() => setTab('def')}>Definición</button>
      </div>
      {tab === 'consulta' ? <Consulta /> : <Definicion cat={cat} />}
    </>
  );
}

// ───────────────────────── Consulta (matriz empleado × acumulador) ─────────────────────────
function Consulta() {
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [meses, setMeses] = useState<Set<number>>(new Set([ahora.getMonth() + 1]));
  const [vista, setVista] = useState<'empleado' | 'liquidacion'>('liquidacion');
  const [data, setData] = useState<ConsultaResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggleMes = (m: number) => setMeses((s) => { const n = new Set(s); if (n.has(m)) n.delete(m); else n.add(m); return n; });
  const setRango = (a: number, b: number) => setMeses(new Set(Array.from({ length: b - a + 1 }, (_, i) => a + i)));

  async function cargar() {
    if (!meses.size) { setErr('Elegí al menos un mes.'); return; }
    setErr(''); setBusy(true); setData(null);
    const lista = [...meses].sort((a, b) => a - b).join(',');
    try { setData(await api.get<ConsultaResp>(`/acumuladores/consulta?anio=${anio}&meses=${lista}`)); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  function exportar() {
    if (!data) return;
    let rows: Record<string, any>[];
    if (vista === 'empleado') {
      rows = data.porEmpleado.map((f) => { const o: Record<string, any> = { Legajo: f.legNum, Empleado: f.nom, Empresa: f.empresa, Periodo: `${MESES[f.mes - 1]} ${data.anio}` }; for (const a of data.acumuladores) o[a.nombre] = f.valores[a.codigo] || 0; return o; });
    } else {
      rows = data.porLiquidacion.map((f) => { const o: Record<string, any> = { Periodo: `${MESES[f.mes - 1]} ${data.anio}`, Empleados: f.empleados }; for (const a of data.acumuladores) o[a.nombre] = f.valores[a.codigo] || 0; return o; });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Acumuladores');
    XLSX.writeFile(wb, `acumuladores_${data.anio}_${vista}.xlsx`);
  }

  const cols = data?.acumuladores || [];
  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Año</label><input className="input" style={{ width: 100 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
        <div className="field" style={{ flex: 1, minWidth: 280 }}>
          <label>Meses</label>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {MESES.map((m, i) => (
              <label key={i} className="row" style={{ gap: 4, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px' }}>
                <input type="checkbox" checked={meses.has(i + 1)} onChange={() => toggleMes(i + 1)} /> {m.slice(0, 3)}
              </label>))}
          </div>
        </div>
      </div>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn ghost" onClick={() => setRango(1, 6)}>1er semestre</button>
        <button className="btn ghost" onClick={() => setRango(7, 12)}>2º semestre</button>
        <button className="btn ghost" onClick={() => setRango(1, 12)}>Anual</button>
        <button className="btn ghost" onClick={() => setMeses(new Set())}>Limpiar</button>
        <button className="btn" onClick={cargar} disabled={busy}>{busy ? 'Calculando…' : 'Actualizar'}</button>
        <div style={{ flex: 1 }} />
        <div className="row" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <button className={vista === 'liquidacion' ? 'btn' : 'btn ghost'} style={{ borderRadius: 0 }} onClick={() => setVista('liquidacion')}>Por liquidaciones</button>
          <button className={vista === 'empleado' ? 'btn' : 'btn ghost'} style={{ borderRadius: 0 }} onClick={() => setVista('empleado')}>Por empleado</button>
        </div>
        {data && <button className="btn ghost" onClick={exportar}>⬇ Exportar Excel</button>}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Los acumuladores «mensuales» muestran cada mes; los «anuales fiscales», el acumulado de enero a ese mes. «Por liquidaciones» suma todos los empleados en cada período; «por empleado» muestra el detalle por persona y período.</p>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {busy && <div className="muted">Calculando acumuladores…</div>}
      {data && vista === 'liquidacion' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
            <thead><tr style={{ background: 'var(--bg2)' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Período</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '2px solid var(--border)' }}>Empl.</th>
              {cols.map((a) => <th key={a.codigo} title={a.tipo} style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '2px solid var(--border)' }}>{a.nombre}</th>)}
            </tr></thead>
            <tbody>
              {data.porLiquidacion.map((f) => (
                <tr key={f.mes}>
                  <td style={{ padding: '4px 8px' }}>{MESES[f.mes - 1]} {data.anio}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{f.empleados}</td>
                  {cols.map((a) => <td key={a.codigo} style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.valores[a.codigo] || 0)}</td>)}
                </tr>))}
              {!data.porLiquidacion.length && <tr><td colSpan={2 + cols.length} className="muted" style={{ padding: 10 }}>Sin datos para los períodos elegidos.</td></tr>}
            </tbody>
            {data.porLiquidacion.length > 0 && (
              <tfoot><tr style={{ fontWeight: 700, background: 'var(--bg2)', borderTop: '2px solid var(--border)' }}>
                <td style={{ padding: '6px 8px' }} colSpan={2}>Total</td>
                {cols.map((a) => <td key={a.codigo} style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(data.totales[a.codigo] || 0)}</td>)}
              </tr></tfoot>)}
          </table>
        </div>
      )}
      {data && vista === 'empleado' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
            <thead><tr style={{ background: 'var(--bg2)' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Leg.</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Empleado</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Período</th>
              {cols.map((a) => <th key={a.codigo} title={a.tipo} style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '2px solid var(--border)' }}>{a.nombre}</th>)}
            </tr></thead>
            <tbody>
              {data.porEmpleado.map((f) => (
                <tr key={`${f.empleadoId}-${f.mes}`}>
                  <td style={{ padding: '4px 8px' }}>{f.legNum}</td>
                  <td style={{ padding: '4px 8px' }}>{f.nom}</td>
                  <td style={{ padding: '4px 8px' }}>{MESES[f.mes - 1]}</td>
                  {cols.map((a) => <td key={a.codigo} style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.valores[a.codigo] || 0)}</td>)}
                </tr>))}
              {!data.porEmpleado.length && <tr><td colSpan={3 + cols.length} className="muted" style={{ padding: 10 }}>Sin empleados / recibos para los períodos elegidos.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ───────────────────────── Definición (ABM) ─────────────────────────
function Definicion({ cat }: { cat: Catalogos | null }) {
  const [items, setItems] = useState<Acum[]>([]);
  const [edit, setEdit] = useState<Acum | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  async function load() { try { setItems(await api.get<Acum[]>('/acumuladores')); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); }, []);

  const nuevo = (): Acum => ({ id: 0, codigo: '', nombre: '', tipo: 'MENSUAL', afectaGanancias: false, activo: true, orden: (items.length + 1) * 10, reglas: [reglaVacia()] });

  async function guardar() {
    if (!edit) return;
    if (!edit.codigo || !edit.nombre) { setMsg({ t: 'Código y nombre son obligatorios', ok: false }); return; }
    try {
      if (edit.id) await api.put(`/acumuladores/${edit.id}`, edit);
      else await api.post('/acumuladores', edit);
      setEdit(null); setMsg({ t: 'Acumulador guardado', ok: true }); load();
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(a: Acum) {
    if (!confirm(`¿Eliminar el acumulador ${a.nombre}?`)) return;
    try { await api.del(`/acumuladores/${a.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  const setReg = (i: number, k: keyof Regla, v: any) => setEdit((e) => e ? { ...e, reglas: e.reglas.map((r, j) => j === i ? { ...r, [k]: v } : r) } : e);

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => setEdit(nuevo())}>+ Nuevo acumulador</button>
        <div style={{ flex: 1 }} />
      </div>
      {msg && <p className={msg.ok ? 'ok' : 'err'}>{msg.t}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--bg2)' }}>
            {['Código', 'Nombre', 'Ventana', 'Reglas', 'Ganancias', 'Activo', ''].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{a.codigo}</td>
                <td style={{ padding: '4px 8px' }}>{a.nombre}</td>
                <td style={{ padding: '4px 8px' }}>{a.tipo}</td>
                <td style={{ padding: '4px 8px' }} className="muted">{a.reglas.length} regla(s)</td>
                <td style={{ padding: '4px 8px' }}>{a.afectaGanancias ? 'Sí' : '—'}</td>
                <td style={{ padding: '4px 8px' }}>{a.activo ? 'Sí' : 'No'}</td>
                <td style={{ padding: '4px 8px' }}><button className="btn ghost" onClick={() => setEdit({ ...a, reglas: a.reglas.length ? a.reglas : [reglaVacia()] })}>Editar</button> <button className="btn danger" onClick={() => borrar(a)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="modal-bg" onClick={() => setEdit(null)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{edit.id ? 'Editar' : 'Nuevo'} acumulador</h3>
            <div className="grid2">
              <div className="field"><label>Código</label><input className="input" value={edit.codigo} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, codigo: e.target.value })} /></div>
              <div className="field"><label>Nombre</label><input className="input" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></div>
              <div className="field"><label>Ventana</label>
                <select className="input" value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}>
                  {(cat?.tiposVentana || [['MENSUAL', 'Mensual'], ['ANUAL_FISCAL', 'Anual fiscal'], ['RANGO', 'Rango']]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div className="field"><label>Orden</label><input className="input" type="number" value={edit.orden} onChange={(e) => setEdit({ ...edit, orden: Number(e.target.value) })} /></div>
              <label className="row muted" style={{ gap: 6 }}><input type="checkbox" checked={edit.afectaGanancias} onChange={(e) => setEdit({ ...edit, afectaGanancias: e.target.checked })} /> Afecta Ganancias</label>
              <label className="row muted" style={{ gap: 6 }}><input type="checkbox" checked={edit.activo} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} /> Activo</label>
            </div>

            <h4 style={{ margin: '12px 0 6px' }}>Reglas (qué líneas suma/resta)</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr><th style={{ textAlign: 'left', padding: '2px 6px' }}>Sección</th><th style={{ textAlign: 'left' }}>Tipo de línea</th><th style={{ textAlign: 'left' }}>Patrón (texto/regex, opcional)</th><th>Signo</th><th></th></tr></thead>
              <tbody>
                {edit.reglas.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: '2px 6px' }}>
                      <select className="input" value={r.seccion} onChange={(e) => setReg(i, 'seccion', e.target.value)}>
                        {(cat?.secciones || [['haberes', 'Haberes'], ['descuentos', 'Descuentos']]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '2px 6px' }}>
                      <select className="input" value={r.tipoLinea} onChange={(e) => setReg(i, 'tipoLinea', e.target.value)}>
                        {(cat?.tiposLinea || [['*', 'Cualquiera']]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '2px 6px' }}><input className="input" value={r.patron} placeholder="ej: Jubilaci|sindical" onChange={(e) => setReg(i, 'patron', e.target.value)} /></td>
                    <td style={{ padding: '2px 6px', textAlign: 'center' }}>
                      <select className="input" value={r.signo} onChange={(e) => setReg(i, 'signo', Number(e.target.value))}><option value={1}>+</option><option value={-1}>−</option></select>
                    </td>
                    <td style={{ padding: '2px 6px' }}><button className="btn ghost" onClick={() => setEdit({ ...edit, reglas: edit.reglas.filter((_, j) => j !== i) })}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn ghost" style={{ marginTop: 6 }} onClick={() => setEdit({ ...edit, reglas: [...edit.reglas, reglaVacia()] })}>+ Agregar regla</button>

            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn" onClick={guardar}>Guardar</button>
              <button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
