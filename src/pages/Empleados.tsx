import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { loadCodigos, buscarObrasSociales, CAMPOS_SICOSS, defaultsSicoss, type CodigosArca, type ObraSocial } from '../lib/arca';
import type { Empleado, ImportResult } from '../lib/types';
import { useNavigate } from 'react-router-dom';

const PLANTILLA = ['Legajo*','DNI*','CUIL*','Apellido y Nombre*','Empresa*','Fecha Ingreso*',
  'Fecha Nacimiento','Ubicación','Categoría','Tramo','Sueldo Bruto','Sueldo Neto','E-mail',
  'Domicilio Calle','Localidad','Provincia','Código Postal'];

// Campo de formulario (a nivel de módulo para conservar identidad estable y no perder el foco al tipear).
function F({ k, label, type = 'text', ph, f, set }: { k: string; label: string; type?: string; ph?: string; f: any; set: (k: string) => any }) {
  return <div className="field"><label>{label}</label><input className="input" type={type} value={f[k] || ''} onChange={set(k)} placeholder={ph} /></div>;
}

export default function Empleados() {
  const { user } = useAuth();
  const canEdit = user?.role === 'rrhh' || user?.role === 'admin';
  const [items, setItems] = useState<Empleado[]>([]);
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [soloActivos, setSoloActivos] = useState(false);
  const navE = useNavigate();
  const [bajaEmp, setBajaEmp] = useState<Empleado | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [showAlta, setShowAlta] = useState(false);
  const [editEmp, setEditEmp] = useState<Empleado | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (empresa) params.set('empresa', empresa);
      if (soloActivos) params.set('activos', 'true');
      const data = await api.get<Empleado[]>(`/empleados?${params.toString()}`);
      setItems(data);
      if (!empresas.length) setEmpresas([...new Set(data.map((e) => e.empresa))].sort());
    } catch (e: any) { setMsg({ t: e.message, ok: false }); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, empresa, soloActivos]);

  async function toggleActivo(emp: Empleado) {
    try { await api.patch(`/empleados/${emp.id}/activo`, { activo: !emp.activo }); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function liquidarFinal(e: Empleado) {
    const p = new URLSearchParams({ reLeg: e.legNum, reEmp: e.empresa, tipo: 'final' });
    try {
      const b: any = await api.get(`/empleados/${(e as any).id}/baja`);
      if (b) { p.set('fechaEgreso', String(b.fecha_baja).slice(0, 10)); p.set('motivo', b.causa); if (b.fecha_notificacion) p.set('fechaNotif', String(b.fecha_notificacion).slice(0, 10)); if (b.preaviso_override) p.set('preaviso', b.preaviso_override); if (Number(b.gratificacion)) p.set('grat', String(Number(b.gratificacion))); }
    } catch { /* sin baja registrada: igual abro la final */ }
    navE(`/m/liquidacion?${p.toString()}`);
  }

  function descargarPlantilla() {
    const ws = XLSX.utils.aoa_to_sheet([PLANTILLA]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Altas');
    XLSX.writeFile(wb, 'plantilla_altas.xlsx');
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false, blankrows: false });
      if (!aoa.length) return setMsg({ t: 'El archivo no contiene datos', ok: false });
      const hdr = (aoa[0] || []).map((h) => String(h).trim().replace(/[*]/g, '').trim());
      const rows = aoa.slice(1).filter((r) => String(r[0] ?? '').trim())
        .map((r) => Object.fromEntries(hdr.map((h, j) => [h, String(r[j] ?? '').trim()])));
      const res = await api.post<ImportResult>('/empleados/import', { rows });
      setMsg({ t: res.mensaje, ok: res.ok > 0 });
      if (res.errores?.length) console.warn('Import avisos:', res.errores);
      load();
    } catch (err: any) { setMsg({ t: 'No se pudo procesar el archivo: ' + err.message, ok: false }); }
  }

  return (
    <>
        <div className="row" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
          <input className="input" style={{ maxWidth: 260 }} placeholder="Buscar nombre, legajo o DNI…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" style={{ maxWidth: 220 }} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
            <option value="">Todas las empresas</option>
            {empresas.map((em) => <option key={em} value={em}>{em}</option>)}
          </select>
          <label className="row muted" style={{ gap: 6 }}>
            <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} /> Solo activos
          </label>
          <div style={{ flex: 1 }} />
          {canEdit && <>
            <button className="btn ghost" onClick={descargarPlantilla}>📋 Plantilla</button>
            <button className="btn ghost" onClick={() => fileRef.current?.click()}>↑ Importar Excel</button>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={onFile} />
            <button className="btn" onClick={() => setShowAlta(true)}>+ Nueva alta</button>
          </>}
        </div>

        {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}

        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table>
            <thead><tr>
              <th>Legajo</th><th>Nombre</th><th>Empresa</th><th>DNI</th><th>Cat.</th><th>Estado</th>{canEdit && <th></th>}
            </tr></thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontFamily: 'monospace' }}>{e.legNum}</td>
                  <td>{e.nom}</td>
                  <td>{e.empresa}</td>
                  <td>{e.dni}</td>
                  <td>{e.cat || '—'}</td>
                  <td><span className="badge" style={{ color: e.activo ? 'var(--green)' : 'var(--t3)' }}>{e.activo ? 'Activo' : 'Baja'}</span></td>
                  {canEdit && <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => setEditEmp(e)}>Editar</button>
                    {e.activo
                      ? <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setBajaEmp(e)}>Dar de baja</button>
                      : <><button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => toggleActivo(e)}>Reactivar</button><button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => liquidarFinal(e)}>⚖️ Liquidar final</button></>}
                  </td>}
                </tr>
              ))}
              {!items.length && <tr><td colSpan={canEdit ? 7 : 6} className="muted" style={{ textAlign: 'center', padding: 24 }}>{loading ? 'Cargando…' : 'Sin resultados'}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>{items.length} empleado(s)</p>

      {(showAlta || editEmp) && <EmpModal emp={editEmp} empresas={empresas} onClose={() => { setShowAlta(false); setEditEmp(null); }} onSaved={(m) => { setShowAlta(false); setEditEmp(null); setMsg({ t: m, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
      {bajaEmp && <BajaModal emp={bajaEmp} onClose={() => setBajaEmp(null)} onDone={(navTo) => { setBajaEmp(null); load(); navE(navTo); }} />}
    </>
  );
}

const CAUSAS_BAJA: [string, string][] = [
  ['renuncia', 'Renuncia (Art. 240)'],
  ['sin_causa', 'Despido sin causa (Art. 245)'],
  ['fuerza_mayor', 'Fuerza mayor / falta de trabajo (Art. 247)'],
  ['con_causa', 'Despido con justa causa (Art. 242)'],
  ['despido_indirecto', 'Despido indirecto (Art. 246)'],
  ['mutuo', 'Mutuo acuerdo / retiro voluntario (Art. 241)'],
  ['jubilacion', 'Jubilación / Retiro (Art. 252)'],
  ['fallecimiento', 'Fallecimiento (Art. 248)'],
  ['incapacidad', 'Incapacidad (Art. 212)'],
  ['abandono', 'Abandono de trabajo (Art. 244)'],
  ['fin_contrato', 'Vencimiento de plazo / fin de obra'],
  ['prueba', 'Período de prueba (Art. 92 bis)'],
];

function BajaModal({ emp, onClose, onDone }: { emp: Empleado; onClose: () => void; onDone: (navTo: string) => void }) {
  const [f, setF] = useState<any>({ causa: 'sin_causa', fechaBaja: new Date().toISOString().slice(0, 10), preavisoOverride: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const esDespido = ['sin_causa', 'fuerza_mayor', 'despido_indirecto'].includes(f.causa);
  const esMutuo = f.causa === 'mutuo';
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  function genCuotas() {
    const n = Number(f.cantCuotas) || 0; const grat = Number(f.gratificacion) || 0;
    if (n <= 0) { setF({ ...f, cuotas: [] }); return; }
    const base = Math.round((grat / n) * 100) / 100;
    setF({ ...f, cuotas: Array.from({ length: n }, (_, i) => ({ nro: i + 1, monto: base, vence: '' })) });
  }
  function setCuota(i: number, k: string, v: any) { const c = [...(f.cuotas || [])]; c[i] = { ...c[i], [k]: k === 'monto' ? Number(v) : v }; setF({ ...f, cuotas: c }); }
  async function guardar() {
    if (!f.fechaBaja || !f.causa) { setErr('Fecha de baja y causa son obligatorias.'); return; }
    setBusy(true); setErr('');
    try {
      await api.post(`/empleados/${(emp as any).id}/baja`, {
        fechaBaja: f.fechaBaja, causa: f.causa, fechaNotificacion: f.fechaNotificacion || undefined,
        preavisoOverride: esDespido ? (f.preavisoOverride || undefined) : undefined,
        gratificacion: esMutuo ? (Number(f.gratificacion) || 0) : 0,
        gratifCuotas: esMutuo ? (f.cuotas || []) : [],
        observaciones: f.observaciones || undefined,
      });
      const p = new URLSearchParams({ reLeg: emp.legNum, reEmp: emp.empresa, tipo: 'final', fechaEgreso: f.fechaBaja, motivo: f.causa });
      if (f.fechaNotificacion) p.set('fechaNotif', f.fechaNotificacion);
      if (esDespido && f.preavisoOverride) p.set('preaviso', f.preavisoOverride);
      if (esMutuo && Number(f.gratificacion)) p.set('grat', String(Number(f.gratificacion)));
      onDone(`/m/liquidacion?${p.toString()}`);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 50, overflow: 'auto' }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 580, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Dar de baja — {emp.nom} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({emp.legNum} · {emp.empresa})</span></h3>
        <div className="grid2" style={{ marginBottom: 10 }}>
          <div className="field"><label>Fecha de baja *</label><input className="input" type="date" value={f.fechaBaja} onChange={set('fechaBaja')} /></div>
          <div className="field"><label>Causa de baja *</label><select className="input" value={f.causa} onChange={set('causa')}>{CAUSAS_BAJA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </div>
        {esDespido && (
          <div className="grid2" style={{ marginBottom: 10 }}>
            <div className="field"><label>Fecha de notificación</label><input className="input" type="date" value={f.fechaNotificacion || ''} onChange={set('fechaNotificacion')} /></div>
            <div className="field"><label>Preaviso</label><select className="input" value={f.preavisoOverride} onChange={set('preavisoOverride')}><option value="">Automático (por fechas/antigüedad)</option><option value="pagar">Pagar (no se otorgó preaviso)</option><option value="no">No pagar (preaviso trabajado)</option></select></div>
          </div>
        )}
        {esMutuo && (
          <div style={{ marginBottom: 10 }}>
            <div className="grid2">
              <div className="field"><label>Gratificación ($)</label><input className="input" type="number" value={f.gratificacion || ''} onChange={set('gratificacion')} /></div>
              <div className="field"><label>Cantidad de cuotas</label><div className="row" style={{ gap: 6 }}><input className="input" type="number" style={{ width: 90 }} value={f.cantCuotas || ''} onChange={set('cantCuotas')} /><button type="button" className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={genCuotas}>Generar</button></div></div>
            </div>
            {(f.cuotas || []).length > 0 && (
              <table style={{ width: '100%', fontSize: 13, marginTop: 6 }}>
                <thead><tr><th style={{ textAlign: 'left' }}>Cuota</th><th style={{ textAlign: 'left' }}>Monto</th><th style={{ textAlign: 'left' }}>Vence</th></tr></thead>
                <tbody>{f.cuotas.map((c: any, i: number) => (
                  <tr key={i}><td>#{c.nro}</td>
                    <td><input className="input" type="number" style={{ width: 130 }} value={c.monto} onChange={(e) => setCuota(i, 'monto', e.target.value)} /></td>
                    <td><input className="input" type="date" value={c.vence || ''} onChange={(e) => setCuota(i, 'vence', e.target.value)} /></td></tr>
                ))}</tbody>
              </table>
            )}
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Las cuotas se registran con su monto. Si el acuerdo prevé actualización, editás el monto de cada cuota cuando corresponda.</div>
          </div>
        )}
        <div className="field" style={{ marginBottom: 12 }}><label>Observaciones</label><textarea className="input" rows={2} value={f.observaciones || ''} onChange={set('observaciones')} /></div>
        {err && <div className="err" style={{ marginBottom: 8 }}>⚠ {err}</div>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Registrar baja y liquidar final →'}</button>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function EmpModal({ emp, empresas, onClose, onSaved, onError }: { emp: Empleado | null; empresas: string[]; onClose: () => void; onSaved: (m: string) => void; onError: (t: string) => void; }) {
  const esNueva = !emp;
  const e = (emp || {}) as any;
  const ini: Record<string, string> = (() => {
    const base: Record<string, string> = {
      ...defaultsSicoss(),
      empresa: e.empresa || empresas[0] || '', legNum: e.legNum || '', dni: e.dni || '', cuil: e.cuil || '', nom: e.nom || '',
      email: e.email || '', ingreso: e.ingreso || '', fecha_nac: e.fecha_nac || '', sexo: e.sexo || '', estado_civil: e.estado_civil || '', nacionalidad: e.nacionalidad || '',
      lugar: e.lugar || '', tarea: e.tarea || '', cat: e.cat || '', tramo: e.tramo || '', desc_categoria: e.desc_categoria || '', condicion: e.condicion || '',
      cod_convenio: e.cod_convenio || '', cod_sindicato: e.cod_sindicato || '',
      basico: e.basico ?? '', antiguedad_monto: e.antiguedad_monto ?? '', complemento: e.complemento ?? '', norem: e.norem ?? '', sueldo: e.sueldo ?? '',
      bruto: e.bruto != null ? String(e.bruto) : '', neto: e.neto != null ? String(e.neto) : '',
      dom_calle: e.dom_calle || '', dom_nro: e.dom_nro || '', dom_piso: e.dom_piso || '', dom_depto: e.dom_depto || '', dom_torre: e.dom_torre || '', dom_bloque: e.dom_bloque || '', dom_loc: e.dom_loc || '', dom_cp: e.dom_cp || '', dom_prov: e.dom_prov || '',
    };
    for (const c of CAMPOS_SICOSS) { const val = e[c.key]; if (val !== undefined && val !== null && val !== '') base[c.key] = String(val); }
    return base;
  })();
  const [f, setF] = useState<Record<string, string>>(ini);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: ev.target.value });
  // Codigos ARCA (desplegables) + obra social (buscador) + historico de OS.
  const [codigos, setCodigos] = useState<CodigosArca>({});
  const [osQ, setOsQ] = useState('');
  const [osRes, setOsRes] = useState<ObraSocial[]>([]);
  const [osSel, setOsSel] = useState<ObraSocial | null>(() => {
    const cod = e.os_codigo || e.cod_os; const nom = e.os_nombre || e.desc_os;
    return cod ? { codigo: String(cod), codigo_sicoss: '', nombre: String(nom || '') } : null;
  });
  const [osHist, setOsHist] = useState<any[]>([]);
  const [osBusca, setOsBusca] = useState(false);
  useEffect(() => { loadCodigos().then(setCodigos).catch(() => {}); }, []);
  useEffect(() => { if (!esNueva && e.id) api.get<any[]>(`/cambios-obra-social/empleado/${e.id}`).then(setOsHist).catch(() => {}); }, []);
  useEffect(() => { if (!osBusca) return; const t = setTimeout(() => { buscarObrasSociales(osQ).then(setOsRes).catch(() => setOsRes([])); }, 250); return () => clearTimeout(t); }, [osQ, osBusca]);
  // En alta, el legajo lo asigna el sistema: traemos el próximo de la empresa elegida.
  useEffect(() => {
    if (!esNueva || !f.empresa) return;
    api.get<{ legNum: string }>(`/empleados/proximo-legajo?empresa=${encodeURIComponent(f.empresa)}`)
      .then((r) => setF((prev) => ({ ...prev, legNum: r.legNum }))).catch(() => {});
  }, [esNueva, f.empresa]);

  const osSicoss = (o: ObraSocial) => o.codigo_sicoss || String(o.codigo).replace(/\D/g, '').slice(-6);

  async function save() {
    setBusy(true);
    try {
      const body: any = { ...f, bruto: parseFloat(f.bruto) || 0, neto: parseFloat(f.neto) || 0 };
      delete body.cod_os; delete body.desc_os;
      if (esNueva) {
        if (osSel) { body.os_codigo = osSel.codigo; body.os_nombre = osSel.nombre; body.codigoObraSocial = osSicoss(osSel); }
        await api.post('/empleados', body);
      } else {
        const id = (emp as any).id;
        await api.put(`/empleados/${id}`, body);          // datos + codigos SICOSS
        const curr = e.os_codigo || e.cod_os || '';
        if (osSel && String(osSel.codigo) !== String(curr)) {
          await api.post(`/cambios-obra-social/aplicar/${id}`, { os_codigo: osSel.codigo, os_nombre: osSel.nombre }); // genera historico
        }
      }
      onSaved(esNueva ? 'Empleado dado de alta' : 'Empleado actualizado');
    } catch (err: any) { onError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 760, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{esNueva ? 'Nueva alta de empleado' : `Editar — ${e.nom}`}</h3>

        <div className="sb-group-label" style={{ margin: '4px 0 6px' }}>Identificación</div>
        <div className="grid2">
          <div className="field"><label>Empresa *</label><select className="input" value={f.empresa} onChange={set('empresa')} disabled={!esNueva}>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select></div>
          <div className="field"><label>Apellido y Nombre *</label><input className="input" value={f.nom || ''} onChange={set('nom')} /></div>
          <div className="field"><label>Legajo {esNueva ? '(automático)' : '*'}</label><input className="input" value={f.legNum || (esNueva ? '…' : '')} disabled readOnly title={esNueva ? 'Lo asigna el sistema según el último legajo de la empresa' : ''} /></div>
          <div className="field"><label>DNI *</label><input className="input" value={f.dni || ''} onChange={set('dni')} disabled={!esNueva} /></div>
          <F k="cuil" label="CUIL" ph="XX-XXXXXXXX-X" f={f} set={set} />
          <F k="email" label="E-mail" f={f} set={set} />
          <F k="ingreso" label="Fecha de ingreso" type="date" f={f} set={set} />
          <F k="fecha_nac" label="Fecha de nacimiento" ph="AAAA-MM-DD o DD/MM/AAAA" f={f} set={set} />
          <F k="sexo" label="Sexo" f={f} set={set} />
          <F k="estado_civil" label="Estado civil" f={f} set={set} />
          <F k="nacionalidad" label="Nacionalidad" f={f} set={set} />
        </div>

        <div className="sb-group-label" style={{ margin: '12px 0 6px' }}>Datos laborales</div>
        <div className="grid2">
          <F k="lugar" label="Ubicación / Lugar de trabajo" f={f} set={set} />
          <F k="tarea" label="Tarea / Puesto" f={f} set={set} />
          <F k="cat" label="Categoría (código)" f={f} set={set} />
          <F k="tramo" label="Tramo" f={f} set={set} />
          <F k="desc_categoria" label="Descripción de categoría" f={f} set={set} />
          <F k="condicion" label="Condición" f={f} set={set} />
          <F k="cod_convenio" label="Código de convenio" f={f} set={set} />
          <F k="cod_sindicato" label="Código de sindicato" f={f} set={set} />
        </div>

        <div className="sb-group-label" style={{ margin: '12px 0 6px' }}>Obra social</div>
        <div className="field">
          <label>Obra social (RNOS)</label>
          {osSel && !osBusca
            ? <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span className="input" style={{ flex: 1 }}><b style={{ fontFamily: 'monospace' }}>{osSel.codigo}</b> — {osSel.nombre}</span>
                <button type="button" className="btn ghost" onClick={() => { setOsBusca(true); setOsQ(''); }}>Cambiar</button>
              </div>
            : <>
                <input className="input" value={osQ} onChange={(ev) => setOsQ(ev.target.value)} placeholder="Buscar por nombre o código (OSDE, gráfico, 1-0900-4…)" />
                {osQ && (
                  <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4 }}>
                    {osRes.map((o) => (
                      <div key={o.codigo} onClick={() => { setOsSel(o); setOsBusca(false); setOsQ(''); }} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                        <span style={{ fontFamily: 'monospace' }}>{o.codigo}</span> — {o.nombre}
                      </div>
                    ))}
                    {!osRes.length && <div className="muted" style={{ padding: '6px 10px', fontSize: 13 }}>Sin coincidencias.</div>}
                  </div>
                )}
              </>}
        </div>
        {osHist.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Histórico de obra social</div>
            {osHist.map((c) => (
              <div key={c.id} style={{ fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'monospace' }}>{c.os_codigo}</span> — {c.os_nombre}
                <span className="muted"> · {c.estado}{c.origen === 'rrhh' ? ' (RR.HH.)' : ''} · {new Date(c.resuelto_at || c.created_at).toLocaleDateString('es-AR')}</span>
              </div>
            ))}
          </div>
        )}

        <div className="sb-group-label" style={{ margin: '12px 0 6px' }}>Datos SICOSS / AFIP</div>
        <div className="grid2">
          {CAMPOS_SICOSS.map((c) => {
            if (c.kind === 'codigo') {
              const opts = codigos[c.tipoCodigo as string] || [];
              return (
                <div className="field" key={c.key}>
                  <label>{c.label}</label>
                  <select className="input" value={f[c.key] ?? ''} onChange={set(c.key)}>
                    {!opts.some((o) => String(o.codigo) === String(f[c.key])) && <option value={f[c.key]}>{f[c.key] || '—'}</option>}
                    {opts.map((o) => <option key={o.codigo} value={o.codigo}>{o.codigo} — {o.nombre}</option>)}
                  </select>
                </div>
              );
            }
            if (c.kind === 'siNo') {
              return (
                <div className="field" key={c.key}>
                  <label>{c.label}</label>
                  <select className="input" value={f[c.key] ?? ''} onChange={set(c.key)}>
                    <option value="1">Sí</option><option value="0">No</option>
                  </select>
                </div>
              );
            }
            return <F key={c.key} k={c.key} label={c.label} type={c.kind === 'number' ? 'number' : 'text'} f={f} set={set} />;
          })}
        </div>

        <div className="sb-group-label" style={{ margin: '12px 0 6px' }}>Remuneración</div>
        <div className="grid2">
          <F k="basico" label="Básico" f={f} set={set} />
          <F k="antiguedad_monto" label="Adicional antigüedad ($)" f={f} set={set} />
          <F k="complemento" label="Complemento" f={f} set={set} />
          <F k="norem" label="No remunerativo" f={f} set={set} />
          <F k="sueldo" label="Sueldo" f={f} set={set} />
          <F k="bruto" label="Sueldo bruto" f={f} set={set} />
          <F k="neto" label="Sueldo neto" f={f} set={set} />
        </div>

        <div className="sb-group-label" style={{ margin: '12px 0 6px' }}>Domicilio</div>
        <div className="grid2">
          <F k="dom_calle" label="Calle" f={f} set={set} />
          <F k="dom_nro" label="Número" f={f} set={set} />
          <F k="dom_piso" label="Piso" f={f} set={set} />
          <F k="dom_depto" label="Depto" f={f} set={set} />
          <F k="dom_torre" label="Torre" f={f} set={set} />
          <F k="dom_bloque" label="Bloque" f={f} set={set} />
          <F k="dom_loc" label="Localidad" f={f} set={set} />
          <F k="dom_cp" label="C.P." f={f} set={set} />
          <F k="dom_prov" label="Provincia" f={f} set={set} />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy || !f.empresa || !f.nom || (!f.dni && !f.cuil)}>{busy ? 'Guardando…' : (esNueva ? 'Crear' : 'Guardar cambios')}</button>
        </div>
      </div>
    </div>
  );
}
