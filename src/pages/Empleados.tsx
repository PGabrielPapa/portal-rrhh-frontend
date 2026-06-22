import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { loadCodigos, buscarObrasSociales, CAMPOS_SICOSS, defaultsSicoss, type CodigosArca, type ObraSocial } from '../lib/arca';
import type { Empleado, ImportResult } from '../lib/types';

const PLANTILLA = ['Legajo*','DNI*','CUIL*','Apellido y Nombre*','Empresa*','Fecha Ingreso*',
  'Fecha Nacimiento','Ubicación','Categoría','Tramo','Sueldo Bruto','Sueldo Neto','E-mail',
  'Domicilio Calle','Localidad','Provincia','Código Postal'];

export default function Empleados() {
  const { user } = useAuth();
  const canEdit = user?.role === 'rrhh' || user?.role === 'admin';
  const [items, setItems] = useState<Empleado[]>([]);
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [soloActivos, setSoloActivos] = useState(false);
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
                    <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleActivo(e)}>{e.activo ? 'Dar de baja' : 'Reactivar'}</button>
                  </td>}
                </tr>
              ))}
              {!items.length && <tr><td colSpan={canEdit ? 7 : 6} className="muted" style={{ textAlign: 'center', padding: 24 }}>{loading ? 'Cargando…' : 'Sin resultados'}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>{items.length} empleado(s)</p>

      {(showAlta || editEmp) && <EmpModal emp={editEmp} empresas={empresas} onClose={() => { setShowAlta(false); setEditEmp(null); }} onSaved={(m) => { setShowAlta(false); setEditEmp(null); setMsg({ t: m, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
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
  const F = ({ k, label, type = 'text', ph }: { k: string; label: string; type?: string; ph?: string }) => (
    <div className="field"><label>{label}</label><input className="input" type={type} value={f[k] || ''} onChange={set(k)} placeholder={ph} /></div>
  );

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
          <F k="cuil" label="CUIL" ph="XX-XXXXXXXX-X" />
          <F k="email" label="E-mail" />
          <F k="ingreso" label="Fecha de ingreso" type="date" />
          <F k="fecha_nac" label="Fecha de nacimiento" ph="AAAA-MM-DD o DD/MM/AAAA" />
          <F k="sexo" label="Sexo" />
          <F k="estado_civil" label="Estado civil" />
          <F k="nacionalidad" label="Nacionalidad" />
        </div>

        <div className="sb-group-label" style={{ margin: '12px 0 6px' }}>Datos laborales</div>
        <div className="grid2">
          <F k="lugar" label="Ubicación / Lugar de trabajo" />
          <F k="tarea" label="Tarea / Puesto" />
          <F k="cat" label="Categoría (código)" />
          <F k="tramo" label="Tramo" />
          <F k="desc_categoria" label="Descripción de categoría" />
          <F k="condicion" label="Condición" />
          <F k="cod_convenio" label="Código de convenio" />
          <F k="cod_sindicato" label="Código de sindicato" />
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
            return <F key={c.key} k={c.key} label={c.label} type={c.kind === 'number' ? 'number' : 'text'} />;
          })}
        </div>

        <div className="sb-group-label" style={{ margin: '12px 0 6px' }}>Remuneración</div>
        <div className="grid2">
          <F k="basico" label="Básico" />
          <F k="antiguedad_monto" label="Adicional antigüedad ($)" />
          <F k="complemento" label="Complemento" />
          <F k="norem" label="No remunerativo" />
          <F k="sueldo" label="Sueldo" />
          <F k="bruto" label="Sueldo bruto" />
          <F k="neto" label="Sueldo neto" />
        </div>

        <div className="sb-group-label" style={{ margin: '12px 0 6px' }}>Domicilio</div>
        <div className="grid2">
          <F k="dom_calle" label="Calle" />
          <F k="dom_nro" label="Número" />
          <F k="dom_piso" label="Piso" />
          <F k="dom_depto" label="Depto" />
          <F k="dom_torre" label="Torre" />
          <F k="dom_bloque" label="Bloque" />
          <F k="dom_loc" label="Localidad" />
          <F k="dom_cp" label="C.P." />
          <F k="dom_prov" label="Provincia" />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy || !f.empresa || !f.nom || (!f.dni && !f.cuil)}>{busy ? 'Guardando…' : (esNueva ? 'Crear' : 'Guardar cambios')}</button>
        </div>
      </div>
    </div>
  );
}
