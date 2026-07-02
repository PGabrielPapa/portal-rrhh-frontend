import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

// ── Tipos de la presentación SiRADIG (fiel al XML de ARCA) ──
interface Periodo { mesDesde: number; mesHasta: number; montoMensual: number }
interface Detalle { nombre: string; valor: string }
interface Deduccion {
  tipo: string; tipoLabel?: string; tipoDoc?: string; nroDoc?: string;
  denominacion?: string; descBasica?: string; descAdicional?: string;
  montoTotal: number; periodos: Periodo[]; detalles?: Detalle[];
}
interface Carga {
  tipoDoc?: string; nroDoc?: string; apellido?: string; nombre?: string; fechaNac?: string;
  mesDesde?: number; mesHasta?: number; parentesco?: string; vigenteProximosPeriodos?: string; porcentajeDeduccion?: string;
}
interface Presentacion {
  cuil: string; anio: number; nroPresentacion: number; fechaPresentacion?: string; version?: string;
  empleado?: any; cargasFamilia: Carga[]; deducciones: Deduccion[]; archivoNombre?: string;
}
interface Cfg { mapaTipos: Record<string, string>; topes: Record<string, number | string>; conceptos: Record<string, { label: string; regla: string }>; tabla4Default: Record<string, number | string>; }
const TOPE_LABELS: [string, string][] = [['gni', 'Ganancia No Imponible (personal doméstico y alquiler inquilino 40%)'], ['gni40', '40% GNI (educación)'], ['seguroMuerte', 'Seguros muerte/mixtos + FCI'], ['seguroRetiro', 'Seguros de retiro'], ['hipotecario', 'Intereses hipotecarios'], ['sepelio', 'Gastos de sepelio'], ['pctNeta', '% sobre ganancia neta (médicos/donac.)']];
interface Fila {
  id: number; cuil: string; empleadoId: number | null; empleadoNom: string | null; legNum: string | null;
  nom: string; anio: number; nroPresentacion: number; fechaPresentacion?: string; version?: string;
  empleadoData: any; cargasFamilia: Carga[]; deducciones: Deduccion[]; total: number;
  totalPorMes: Record<string, number>; archivoNombre?: string; updatedAt?: string;
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PARENTESCO: Record<string, string> = { '1': 'Cónyuge', '3': 'Hijo/a', '30': 'Hijastro/a', '31': 'Hijo/a incapacitado', '32': 'Hijastro/a incapacitado', '33': 'Padre', '34': 'Madre', '35': 'Nieto/a', '39': 'Abuelo/a', '41': 'Padrastro/Madrastra', '42': 'Hermano/a', '43': 'Hermano/a incapacitado', '44': 'Suegro/a', '51': 'Unión convivencial', '103': 'Hijo/a 18-24 (educación)' };
const peso = (n: number) => '$ ' + (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };

// ── Mini-unzip nativo (sin dependencias): lee el directorio central y descomprime con DecompressionStream ──
async function inflateRaw(u8: Uint8Array): Promise<Uint8Array> {
  const ds = new (window as any).DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter(); w.write(u8); w.close();
  const r = ds.readable.getReader(); const chunks: Uint8Array[] = [];
  for (; ;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
  const len = chunks.reduce((a, c) => a + c.length, 0); const out = new Uint8Array(len); let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; } return out;
}
async function unzip(buf: ArrayBuffer): Promise<{ name: string; text: string }[]> {
  const u8 = new Uint8Array(buf); const dv = new DataView(buf);
  let eo = -1;
  for (let i = u8.length - 22; i >= 0; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; } }
  if (eo < 0) throw new Error('ZIP inválido');
  const count = dv.getUint16(eo + 10, true); let p = dv.getUint32(eo + 16, true);
  const dec = new TextDecoder('utf-8'); const res: { name: string; text: string }[] = [];
  for (let i = 0; i < count; i++) {
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const fnl = dv.getUint16(p + 28, true), exl = dv.getUint16(p + 30, true), cml = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + fnl));
    const lfnl = dv.getUint16(lho + 26, true), lexl = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lfnl + lexl;
    const comp = u8.subarray(start, start + csize);
    const raw = method === 8 ? await inflateRaw(comp) : comp;
    if (/\.xml$/i.test(name)) res.push({ name, text: dec.decode(raw) });
    p += 46 + fnl + exl + cml;
  }
  return res;
}

// ── Parseo del XML de presentación SiRADIG ──
function parseXml(name: string, text: string): Presentacion | null {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const root = doc.querySelector('presentacion'); if (!root) return null;
  const t = (el: Element | null, sel: string) => el?.querySelector(sel)?.textContent?.trim() || '';
  const emp = root.querySelector(':scope > empleado');
  const dir = emp?.querySelector(':scope > direccion');
  const empleado = {
    cuit: t(emp, 'cuit'), tipoDoc: t(emp, 'tipoDoc'), apellido: t(emp, 'apellido'), nombre: t(emp, 'nombre'),
    direccion: dir ? {
      provincia: t(dir, 'provincia'), cp: t(dir, 'cp'), localidad: t(dir, 'localidad'),
      calle: t(dir, 'calle'), nro: t(dir, 'nro'), piso: t(dir, 'piso'), dpto: t(dir, 'dpto'),
    } : null,
  };
  const cargasFamilia: Carga[] = Array.from(root.querySelectorAll(':scope > cargasFamilia > cargaFamilia')).map((c) => ({
    tipoDoc: t(c, 'tipoDoc'), nroDoc: t(c, 'nroDoc'), apellido: t(c, 'apellido'), nombre: t(c, 'nombre'),
    fechaNac: t(c, 'fechaNac'), mesDesde: Number(t(c, 'mesDesde')) || undefined, mesHasta: Number(t(c, 'mesHasta')) || undefined,
    parentesco: t(c, 'parentesco'), vigenteProximosPeriodos: t(c, 'vigenteProximosPeriodos'), porcentajeDeduccion: t(c, 'porcentajeDeduccion'),
  }));
  const deducciones: Deduccion[] = Array.from(root.querySelectorAll(':scope > deducciones > deduccion')).map((d) => ({
    tipo: d.getAttribute('tipo') || '', tipoDoc: t(d, 'tipoDoc'), nroDoc: t(d, 'nroDoc'),
    denominacion: t(d, 'denominacion'), descBasica: t(d, 'descBasica'), descAdicional: t(d, 'descAdicional'),
    montoTotal: num(t(d, 'montoTotal')),
    periodos: Array.from(d.querySelectorAll(':scope > periodos > periodo')).map((pe) => ({
      mesDesde: Number(pe.getAttribute('mesDesde')) || 0, mesHasta: Number(pe.getAttribute('mesHasta')) || 0,
      montoMensual: num(pe.getAttribute('montoMensual')),
    })),
    detalles: Array.from(d.querySelectorAll(':scope > detalles > detalle')).map((de) => ({
      nombre: de.getAttribute('nombre') || '', valor: de.getAttribute('valor') || '',
    })),
  }));
  return {
    cuil: empleado.cuit, anio: Number(t(root, 'periodo')) || 0, nroPresentacion: Number(t(root, 'nroPresentacion')) || 0,
    fechaPresentacion: t(root, 'fechaPresentacion'), version: root.getAttribute('version') || '',
    empleado, cargasFamilia, deducciones, archivoNombre: name,
  };
}

export default function Siradig() {
  const [items, setItems] = useState<Fila[]>([]);
  const [anios, setAnios] = useState<number[]>([]);
  const [anio, setAnio] = useState('');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [exp, setExp] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [showCfg, setShowCfg] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const p = new URLSearchParams(); if (anio) p.set('anio', anio); if (q) p.set('q', q);
      setItems(await api.get<Fila[]>(`/siradig?${p}`));
      setAnios(await api.get<number[]>('/siradig/_anios'));
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [anio, q]);
  useEffect(() => { api.get<Cfg>('/siradig/_config').then(setCfg).catch(() => {}); }, []);

  // Tipos a mapear: los que aparecen en las presentaciones importadas + los ya mapeados.
  const tiposDetectados = (): string[] => {
    const set = new Set<string>();
    for (const f of items) for (const d of f.deducciones) if (d.tipo) set.add(String(d.tipo));
    if (cfg) for (const k of Object.keys(cfg.mapaTipos)) set.add(String(k));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  };
  async function guardarCfg() {
    if (!cfg) return;
    try { await api.put('/siradig/_config', { mapaTipos: cfg.mapaTipos, topes: cfg.topes }); setMsg({ t: 'Configuración guardada. Se aplica en el F.1357.', ok: true }); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    e.target.value = ''; setBusy(true); setMsg(null);
    try {
      const xmls: { name: string; text: string }[] = [];
      for (const f of files) {
        const buf = await f.arrayBuffer();
        if (/\.zip$/i.test(f.name)) xmls.push(...await unzip(buf));
        else if (/\.xml$/i.test(f.name)) xmls.push({ name: f.name, text: new TextDecoder('utf-8').decode(buf) });
      }
      if (!xmls.length) { setMsg({ t: 'No se encontraron presentaciones .xml. Subí los .xml (o el .zip que los agrupa) que se descargan de ARCA → SiRADIG–Empleador. Ojo: el paquete «SiRADIG_Empleador_v1» (esquema .xsd + manual PDF) no contiene presentaciones.', ok: false }); setBusy(false); return; }
      const pres: Presentacion[] = [];
      for (const x of xmls) { const p = parseXml(x.name, x.text); if (p && p.cuil) pres.push(p); }
      if (!pres.length) { setMsg({ t: 'Los XML no tienen el formato de presentación SiRADIG esperado.', ok: false }); setBusy(false); return; }
      const res = await api.post<any>('/siradig/import', { presentaciones: pres });
      const partes = [`${res.importadas} nuevas`, `${res.actualizadas} actualizadas`, `${res.omitidas} omitidas (ya estaba una más reciente)`, `${res.sinEmpleado} sin empleado vinculado`];
      setMsg({ t: `Importación lista: ${partes.join(' · ')}.`, ok: true });
      load();
    } catch (err: any) { setMsg({ t: 'No se pudo procesar: ' + err.message, ok: false }); }
    setBusy(false);
  }

  async function borrar(id: number) {
    if (!confirm('¿Eliminar esta presentación?')) return;
    try { await api.del(`/siradig/${id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  const toggle = (id: number) => setExp((s) => ({ ...s, [id]: !s[id] }));

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Importar SiRADIG (F.572 web)</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Subí los archivos <b>.xml</b> que descargás de ARCA (SiRADIG–Empleador) o directamente el <b>.zip</b> con todos.
          Se toma siempre la <b>última presentación</b> de cada empleado (mayor N° de presentación) y se vincula por CUIL.
          Acá ves lo <b>declarado</b>; los <b>topes de RG 4003</b> (alquiler, 5% médicos, etc.) se aplican sobre el acumulado del período fiscal en el <b>F.1357</b> de cada empleado (declarado vs. computable).
        </p>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".xml,.zip" multiple style={{ display: 'none' }} onChange={onFile} />
          <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Procesando…' : 'Subir XML / ZIP'}</button>
        </div>
        {msg && <p className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 0 }}>{msg.t}</p>}
      </div>

      {cfg && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowCfg((v) => !v)}>
            <b style={{ flex: 1 }}>⚙ Configuración: mapeo de códigos y topes (RG 4003)</b>
            <span className="muted">{showCfg ? '▲' : '▼'}</span>
          </div>
          {showCfg && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <p className="muted" style={{ marginTop: 0 }}>
                El XML del SiRADIG identifica cada deducción con un <b>código «tipo»</b>. Mapeá cada código a su concepto para que el F.1357 aplique el tope correcto.
                Los no mapeados <b>no se deducen</b>. (La tabla oficial está en el ZIP «Manual del Desarrollador» de ARCA.)
              </p>
              <h4 style={{ margin: '8px 0 4px' }}>Mapeo código «tipo» → concepto</h4>
              <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr><th style={{ textAlign: 'left', padding: '2px 10px' }}>Tipo</th><th style={{ textAlign: 'left', padding: '2px 10px' }}>Concepto</th></tr></thead>
                <tbody>
                  {tiposDetectados().map((tp) => (
                    <tr key={tp}>
                      <td style={{ padding: '2px 10px', fontFamily: 'monospace' }}>{tp}</td>
                      <td style={{ padding: '2px 10px' }}>
                        <select className="input" value={cfg.mapaTipos[tp] || ''} onChange={(e) => setCfg({ ...cfg, mapaTipos: { ...cfg.mapaTipos, [tp]: e.target.value } })}>
                          <option value="">(sin clasificar — no se deduce)</option>
                          {Object.entries(cfg.conceptos).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {!tiposDetectados().length && <tr><td colSpan={2} className="muted" style={{ padding: 8 }}>Importá presentaciones para ver los códigos a mapear.</td></tr>}
                </tbody>
              </table>
              <h4 style={{ margin: '14px 0 4px' }}>Topes (valores anuales)</h4>
              <div className="grid2">
                {TOPE_LABELS.map(([k, lbl]) => (
                  <div className="field" key={k}><label>{lbl}</label>
                    <input className="input" type="number" step="0.01" value={Number(cfg.topes[k] ?? 0)} onChange={(e) => setCfg({ ...cfg, topes: { ...cfg.topes, [k]: Number(e.target.value) } })} />
                  </div>
                ))}
                <div className="field"><label>Modo de tope</label>
                  <select className="input" value={String(cfg.topes.modo || 'MENSUAL_PRORRATEADO')} onChange={(e) => setCfg({ ...cfg, topes: { ...cfg.topes, modo: e.target.value } })}>
                    <option value="MENSUAL_PRORRATEADO">Prorrateado mes a mes (tope anual ÷ 12 × meses)</option>
                    <option value="FIJO_PERIODO">Fijo durante todo el período fiscal</option>
                  </select>
                </div>
              </div>
              <div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={guardarCfg}>Guardar configuración</button></div>
            </div>
          )}
        </div>
      )}

      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 14, gap: 10 }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Buscar nombre o CUIL…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 160 }} value={anio} onChange={(e) => setAnio(e.target.value)}>
          <option value="">Todos los años</option>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <span className="muted">{items.length} presentaciones</span>
      </div>

      {!items.length && <p className="muted">Todavía no hay presentaciones importadas.</p>}

      {items.map((f) => (
        <div key={f.id} className="card" style={{ marginBottom: 10 }}>
          <div className="row" style={{ alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle(f.id)}>
            <div style={{ flex: 1 }}>
              <b>{f.empleadoNom || f.nom || '(sin nombre)'}</b>
              {!f.empleadoId && <span className="badge" style={{ marginLeft: 8, background: '#fde68a', color: '#92400e' }}>sin empleado</span>}
              <div className="muted" style={{ fontSize: 13 }}>
                CUIL {f.cuil} · Año {f.anio} · Presentación N° {f.nroPresentacion} ({fmtFecha(f.fechaPresentacion)})
                {f.legNum ? ` · Legajo ${f.legNum}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div><b>{peso(f.total)}</b></div>
              <div className="muted" style={{ fontSize: 12 }}>{f.deducciones.length} deducc. · {f.cargasFamilia.length} cargas</div>
            </div>
            <span className="muted" style={{ marginLeft: 12 }}>{exp[f.id] ? '▲' : '▼'}</span>
          </div>

          {exp[f.id] && (
            <div style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
              {/* Deducción total por mes */}
              <h4 style={{ margin: '4px 0' }}>Deducción total por mes</h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="card costo-tbl" style={{ width: '100%', fontSize: 13 }}>
                  <thead><tr>{MESES.map((m) => <th key={m} style={{ textAlign: 'right', padding: '4px 8px' }}>{m}</th>)}</tr></thead>
                  <tbody><tr>{MESES.map((_, i) => <td key={i} style={{ textAlign: 'right', padding: '4px 8px' }}>{f.totalPorMes[i + 1] ? peso(f.totalPorMes[i + 1]) : '—'}</td>)}</tr></tbody>
                </table>
              </div>

              {/* Cargas de familia */}
              {f.cargasFamilia.length > 0 && <>
                <h4 style={{ margin: '14px 0 4px' }}>Cargas de familia</h4>
                <table className="card costo-tbl" style={{ width: '100%', fontSize: 13 }}>
                  <thead><tr><th style={{ textAlign: 'left', padding: '4px 8px' }}>Familiar</th><th style={{ textAlign: 'left' }}>CUIL/DNI</th><th>Parentesco</th><th>Meses</th><th>%</th></tr></thead>
                  <tbody>{f.cargasFamilia.map((c, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 8px' }}>{[c.apellido, c.nombre].filter(Boolean).join(', ')}</td>
                      <td>{c.nroDoc}</td>
                      <td style={{ textAlign: 'center' }}>{PARENTESCO[c.parentesco || ''] || c.parentesco || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{c.mesDesde}–{c.mesHasta}</td>
                      <td style={{ textAlign: 'center' }}>{c.porcentajeDeduccion}%</td>
                    </tr>
                  ))}</tbody>
                </table>
              </>}

              {/* Deducciones */}
              {f.deducciones.length > 0 && <>
                <h4 style={{ margin: '14px 0 4px' }}>Deducciones declaradas</h4>
                {f.deducciones.map((d, i) => (
                  <div key={i} className="card" style={{ padding: 10, marginBottom: 8, background: '#fafafa' }}>
                    <div className="row" style={{ alignItems: 'baseline' }}>
                      <div style={{ flex: 1 }}>
                        <span className="badge" style={{ marginRight: 8 }}>tipo {d.tipo}</span>
                        <b>{d.tipoLabel}</b>
                        <div className="muted" style={{ fontSize: 13 }}>{d.denominacion}{d.nroDoc ? ` · ${d.nroDoc}` : ''}</div>
                        {d.descAdicional && <div className="muted" style={{ fontSize: 12 }}>{d.descAdicional}</div>}
                      </div>
                      <div><b>{peso(d.montoTotal)}</b></div>
                    </div>
                    {d.periodos.length > 0 && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        {d.periodos.map((pe, j) => (
                          <span key={j} style={{ marginRight: 12 }}>
                            {pe.mesDesde === pe.mesHasta ? MESES[pe.mesDesde - 1] : `${MESES[pe.mesDesde - 1]}–${MESES[pe.mesHasta - 1]}`}: {peso(pe.montoMensual)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>}

              <div className="row" style={{ marginTop: 10 }}>
                <span className="muted" style={{ flex: 1, fontSize: 12 }}>Archivo: {f.archivoNombre || '—'} · versión {f.version || '—'}</span>
                <button className="btn danger" onClick={() => borrar(f.id)}>Eliminar</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
