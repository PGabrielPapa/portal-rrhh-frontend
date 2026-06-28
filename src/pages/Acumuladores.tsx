import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';

interface Regla { seccion: string; tipoLinea: string; patron: string; signo: number }
interface Acum { id: number; codigo: string; nombre: string; tipo: string; afectaGanancias: boolean; activo: boolean; orden: number; reglas: Regla[] }
interface Catalogos { tiposVentana: [string, string][]; tiposLinea: [string, string][]; secciones: [string, string][] }
interface ConsultaResp {
  periodo: { anio: number; mes: number };
  acumuladores: { codigo: string; nombre: string; tipo: string; afectaGanancias: boolean }[];
  filas: { empleadoId: number; legNum: string; nom: string; empresa: string; valores: Record<string, number> }[];
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
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [data, setData] = useState<ConsultaResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function cargar() {
    setErr(''); setBusy(true); setData(null);
    try { setData(await api.get<ConsultaResp>(`/acumuladores/consulta?anio=${anio}&mes=${mes}`)); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  function exportar() {
    if (!data) return;
    const rows = data.filas.map((f) => {
      const o: Record<string, any> = { Legajo: f.legNum, Empleado: f.nom, Empresa: f.empresa };
      for (const a of data.acumuladores) o[a.nombre] = f.valores[a.codigo] || 0;
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Acumuladores');
    XLSX.writeFile(wb, `acumuladores_${anio}_${String(mes).padStart(2, '0')}.xlsx`);
  }

  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
        <div className="field"><label>Año</label><input className="input" style={{ width: 100 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
        <button className="btn" onClick={cargar} disabled={busy}>{busy ? 'Calculando…' : 'Actualizar'}</button>
        <div style={{ flex: 1 }} />
        {data && <button className="btn ghost" onClick={exportar}>⬇ Exportar Excel</button>}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Los acumuladores «mensuales» muestran el mes elegido; los «anuales fiscales», el acumulado de enero a ese mes.</p>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {busy && <div className="muted">Calculando acumuladores…</div>}
      {data && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Leg.</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Empleado</th>
                {data.acumuladores.map((a) => <th key={a.codigo} title={`${a.tipo}${a.afectaGanancias ? ' · afecta Ganancias' : ''}`} style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '2px solid var(--border)' }}>{a.nombre}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.filas.map((f) => (
                <tr key={f.empleadoId}>
                  <td style={{ padding: '4px 8px' }}>{f.legNum}</td>
                  <td style={{ padding: '4px 8px' }}>{f.nom}</td>
                  {data.acumuladores.map((a) => <td key={a.codigo} style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(f.valores[a.codigo] || 0)}</td>)}
                </tr>
              ))}
              {!data.filas.length && <tr><td colSpan={2 + data.acumuladores.length} className="muted" style={{ padding: 10 }}>Sin empleados / recibos para el período.</td></tr>}
            </tbody>
            {data.filas.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700, background: 'var(--bg2)', borderTop: '2px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px' }} colSpan={2}>Totales ({data.filas.length})</td>
                  {data.acumuladores.map((a) => <td key={a.codigo} style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(data.totales[a.codigo] || 0)}</td>)}
                </tr>
              </tfoot>
            )}
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
