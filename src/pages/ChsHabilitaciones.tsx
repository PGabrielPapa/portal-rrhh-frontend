import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api, fetchBlob } from '../lib/api';

// Habilitaciones por establecimiento (Comité de HyS).
// El estado Vigente / Por vencer / Vencida lo calcula el backend a partir de la
// fecha de vencimiento y los días de alerta: acá solo se muestra. Los estados
// "En trámite" y "No aplica" son decisiones manuales y viajan en `estadoManual`.

interface Hab {
  id: number;
  establecimiento: string; empresa?: string; tipo: string; organismo?: string;
  nroExpediente?: string; nroHabilitacion?: string;
  fechaOtorgamiento?: string; fechaVencimiento?: string;
  diasAlerta?: number; estado: string; estadoManual?: string; diasRestantes?: number | null;
  responsable?: string; tramitadoPor?: string;
  costo?: number | null; superficie?: number | null; capacidad?: number | null;
  rubro?: string; condiciones?: string; observaciones?: string;
  cantDocs: number; cantRenovaciones: number;
}
interface Doc { id: number; descripcion?: string; nombre?: string; mime?: string; bytes: number; createdBy?: string; createdAt?: string }
interface Hist {
  id: number; fechaRegistro?: string; otorgAnterior?: string; otorgNuevo?: string;
  vencAnterior?: string; vencNuevo?: string; nroExpediente?: string; nroHabilitacion?: string;
  costo?: number | null; observaciones?: string; createdBy?: string;
}

const TIPOS = ['Habilitación Municipal', 'Habilitación Provincial', 'Certificado de Bomberos', 'Certificado de Higiene y Seguridad', 'Habilitación ART (establecimiento)', 'Certificado Ambiental', 'Habilitación Sanitaria (SENASA / ANMAT)', 'Certificado de Instalación Eléctrica', 'Certificado de Instalación de Gas', 'Certificado de Matafuegos', 'Plan de Emergencia aprobado', 'Certificado de Calderas y Recipientes a Presión', 'Habilitación de Elevadores / Grúas', 'Certificado de Residuos Peligrosos', 'Permiso de Uso de Suelo', 'Certificado IRAM', 'Otro'];
const ORGANISMOS = ['Municipalidad', 'Provincia', 'Ministerio de Trabajo', 'SRT', 'SENASA', 'ANMAT', 'Bomberos', 'EDESUR', 'EDENOR', 'Empresa distribuidora de gas', 'IRAM', 'Organismo municipal', 'Ente regulador provincial', 'Otro'];
const EMPRESAS = ['LEITEN S.A.', 'SINIS S.A.', 'LEITEN SALTA S. A.', 'BARTON REBAR SA'];
const ESTADOS_MANUALES = ['Automático', 'En trámite', 'No aplica'];
const ESTADOS_FILTRO = ['Vigente', 'Por vencer', 'Vencida', 'En trámite', 'No aplica'];
const MAX_MB = 4.5;

const eColor = (e?: string) => (e === 'Vigente' ? 'var(--green)' : e === 'Por vencer' ? 'var(--yellow)' : e === 'Vencida' ? 'var(--red)' : e === 'En trámite' || e === 'En tramite' ? 'var(--accent)' : 'var(--t3)');
const fmt = (s?: string | null) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
const pesos = (n?: number | null) => (n === null || n === undefined || !n ? '—' : n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }));
const kb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const vigLbl = (h: Hab) => {
  if (h.estado === 'No aplica') return 'No aplica';
  if (h.diasRestantes === null || h.diasRestantes === undefined) return 'Sin vencimiento';
  if (h.diasRestantes < 0) return `Vencida hace ${Math.abs(h.diasRestantes)} d`;
  if (h.diasRestantes === 0) return 'Vence hoy';
  return `Faltan ${h.diasRestantes} d`;
};

function fileToB64(file: File): Promise<{ nombre: string; mime: string; data: string }> {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); res({ nombre: file.name, mime: file.type || 'application/octet-stream', data: s.slice(s.indexOf(',') + 1) }); };
    r.readAsDataURL(file);
  });
}
// Los adjuntos se suben de a uno: el body JSON del backend admite 5 MB y un lote
// de varios PDF en base64 lo pasaría de largo.
async function subirDocs(habId: number, docs: { nombre: string; mime: string; data: string }[]) {
  for (const d of docs) await api.post(`/chs/habilitaciones/${habId}/docs`, { docs: [d] });
}
async function descargar(url: string, nombre?: string) {
  const b = await fetchBlob(url);
  const u = URL.createObjectURL(b);
  const a = document.createElement('a'); a.href = u; a.download = nombre || 'documento'; a.click();
  URL.revokeObjectURL(u);
}

const EMPTY = {
  establecimiento: '', empresa: '', tipo: '', organismo: '', nroExpediente: '', nroHabilitacion: '',
  fechaOtorgamiento: '', fechaVencimiento: '', diasAlerta: 60, estadoManual: 'Automático',
  responsable: '', tramitadoPor: '', costo: '', superficie: '', capacidad: '',
  rubro: '', condiciones: '', observaciones: '',
};

export default function ChsHabilitaciones() {
  const [items, setItems] = useState<Hab[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [edit, setEdit] = useState<Hab | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [renovar, setRenovar] = useState<Hab | null>(null);
  const [ficha, setFicha] = useState<Hab | null>(null);
  const [fe, setFe] = useState(''); const [fs, setFs] = useState(''); const [ft, setFt] = useState(''); const [q, setQ] = useState('');

  async function load() {
    try { setItems(await api.get<Hab[]>('/chs/habilitaciones')); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  useEffect(() => { load(); }, []);

  async function eliminar(h: Hab) {
    if (!confirm(`¿Eliminar la habilitación "${h.tipo}" de ${h.establecimiento}? Se borran también sus documentos e historial.`)) return;
    try { await api.del(`/chs/habilitaciones/${h.id}`); setMsg({ t: 'Habilitación eliminada', ok: true }); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  const estabs = [...new Set(items.map((h) => h.establecimiento).filter(Boolean))].sort();
  const filtrados = items.filter((h) => {
    if (fe && h.establecimiento !== fe) return false;
    if (fs && h.estado !== fs) return false;
    if (ft && h.tipo !== ft) return false;
    if (q && !`${h.tipo} ${h.establecimiento} ${h.empresa || ''} ${h.organismo || ''} ${h.nroExpediente || ''} ${h.nroHabilitacion || ''} ${h.responsable || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const cuenta = (e: string) => items.filter((h) => h.estado === e).length;
  const kpis = [
    { l: 'Total', n: items.length, c: 'var(--t1)' },
    { l: 'Vigentes', n: cuenta('Vigente'), c: 'var(--green)' },
    { l: 'Por vencer', n: cuenta('Por vencer'), c: 'var(--yellow)' },
    { l: 'Vencidas', n: cuenta('Vencida'), c: 'var(--red)' },
    { l: 'En trámite', n: cuenta('En trámite'), c: 'var(--accent)' },
  ];

  function exportar() {
    if (!filtrados.length) { setMsg({ t: 'No hay filas para exportar con los filtros actuales', ok: false }); return; }
    const rows = filtrados.map((h) => ({
      Estado: h.estado, Vigencia: vigLbl(h), Establecimiento: h.establecimiento, Empresa: h.empresa || '',
      Tipo: h.tipo, Organismo: h.organismo || '', 'Nº Expediente': h.nroExpediente || '', 'Nº Habilitación': h.nroHabilitacion || '',
      Otorgamiento: fmt(h.fechaOtorgamiento), Vencimiento: h.fechaVencimiento ? fmt(h.fechaVencimiento) : '',
      'Alerta (días)': h.diasAlerta ?? '', Responsable: h.responsable || '', 'Tramitado por': h.tramitadoPor || '',
      Costo: h.costo ?? '', 'Superficie (m2)': h.superficie ?? '', 'Capacidad (pers.)': h.capacidad ?? '',
      Rubro: h.rubro || '', Condiciones: h.condiciones || '', Observaciones: h.observaciones || '',
      Documentos: h.cantDocs, Renovaciones: h.cantRenovaciones,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Habilitaciones');
    XLSX.writeFile(wb, `habilitaciones_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const TH = { padding: '8px 10px', textAlign: 'left' as const, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const, fontSize: 11, textTransform: 'uppercase' as const, color: 'var(--t3)' };
  const TD = { padding: '8px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' as const };

  return (
    <>
      <div className="row" style={{ marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }} />
        <button className="btn ghost" onClick={exportar}>⇩ Exportar a Excel</button>
        <button className="btn" onClick={() => { setEdit(null); setShowForm(true); }}>+ Nueva habilitación</button>
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
        {kpis.map((k) => (
          <div key={k.l} className="card" style={{ textAlign: 'center', padding: '12px 10px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.c }}>{k.n}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '10px 12px', marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="input" value={fe} onChange={(e) => setFe(e.target.value)} style={{ flex: 1, minWidth: 170 }}>
          <option value="">Todos los establecimientos</option>
          {estabs.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="input" value={fs} onChange={(e) => setFs(e.target.value)} style={{ minWidth: 140 }}>
          <option value="">Todos los estados</option>
          {ESTADOS_FILTRO.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="input" value={ft} onChange={(e) => setFt(e.target.value)} style={{ minWidth: 190 }}>
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input" placeholder="Buscar establecimiento, expediente, responsable…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 200, flex: 1 }} />
      </div>

      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--bg2)' }}>
            {['Estado', 'Establecimiento', 'Tipo', 'Organismo', 'Nº Expediente', 'Vigencia', 'Responsable', 'Docs', ''].map((h, i) => <th key={i} style={TH}>{h}</th>)}
          </tr></thead>
          <tbody>
            {!filtrados.length && <tr><td colSpan={9} className="muted" style={{ padding: 32, textAlign: 'center' }}>{items.length ? 'Ninguna habilitación coincide con los filtros.' : 'Sin habilitaciones cargadas.'}</td></tr>}
            {filtrados.map((h) => (
              <tr key={h.id}>
                <td style={TD}>
                  <span className="badge" style={{ background: `${eColor(h.estado)}22`, color: eColor(h.estado), fontWeight: 600 }}>{h.estado}</span>
                  {h.estadoManual && h.estadoManual !== 'Automático' && h.estadoManual !== 'Automatico' && <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>manual</div>}
                </td>
                <td style={{ ...TD, fontWeight: 500 }}>{h.establecimiento}{h.empresa && <div className="muted" style={{ fontSize: 11 }}>{h.empresa}</div>}</td>
                <td style={TD}>{h.tipo}</td>
                <td style={{ ...TD, color: 'var(--t3)' }}>{h.organismo || '—'}</td>
                <td style={{ ...TD, color: 'var(--t3)', fontFamily: 'monospace', fontSize: 12 }}>{h.nroExpediente || '—'}</td>
                <td style={TD}>
                  <div style={{ fontSize: 12 }}>{fmt(h.fechaOtorgamiento)} → {h.fechaVencimiento ? fmt(h.fechaVencimiento) : '∞'}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{vigLbl(h)}</div>
                </td>
                <td style={{ ...TD, color: 'var(--t3)' }}>{h.responsable || '—'}</td>
                <td style={{ ...TD, textAlign: 'center' }}>
                  <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 12 }} title="Documentos e historial" onClick={() => setFicha(h)}>
                    📎 {h.cantDocs || 0}{h.cantRenovaciones ? ` · ♻ ${h.cantRenovaciones}` : ''}
                  </button>
                </td>
                <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 12 }} title="Registrar renovación" onClick={() => setRenovar(h)}>♻</button>{' '}
                  <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => { setEdit(h); setShowForm(true); }}>Editar</button>{' '}
                  <button className="btn danger" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => eliminar(h)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
        El estado se calcula solo, según la fecha de vencimiento y los días de alerta de cada habilitación. “En trámite” y “No aplica” se fijan a mano en la ficha.
      </p>

      {showForm && <HabModal hab={edit} onClose={() => setShowForm(false)} onSaved={(t) => { setShowForm(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
      {renovar && <RenovarModal hab={renovar} onClose={() => setRenovar(null)} onSaved={(t) => { setRenovar(null); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
      {ficha && <FichaModal hab={ficha} onClose={() => setFicha(null)} onChanged={load} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

// ───────────────────────── Alta / edición ─────────────────────────
function HabModal({ hab, onClose, onSaved, onError }: { hab: Hab | null; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const h = hab || ({} as Hab);
  const [f, setF] = useState<any>({
    ...EMPTY,
    establecimiento: h.establecimiento || '', empresa: h.empresa || '', tipo: h.tipo || '', organismo: h.organismo || '',
    nroExpediente: h.nroExpediente || '', nroHabilitacion: h.nroHabilitacion || '',
    fechaOtorgamiento: (h.fechaOtorgamiento || '').slice(0, 10), fechaVencimiento: (h.fechaVencimiento || '').slice(0, 10),
    diasAlerta: h.diasAlerta ?? 60,
    estadoManual: !h.estadoManual || h.estadoManual === 'Automatico' ? 'Automático' : h.estadoManual,
    responsable: h.responsable || '', tramitadoPor: h.tramitadoPor || '',
    costo: h.costo ?? '', superficie: h.superficie ?? '', capacidad: h.capacidad ?? '',
    rubro: h.rubro || '', condiciones: h.condiciones || '', observaciones: h.observaciones || '',
  });
  const [docs, setDocs] = useState<{ nombre: string; mime: string; data: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const grandes = files.filter((x) => x.size > MAX_MB * 1024 * 1024);
    if (grandes.length) { onError(`Cada archivo puede pesar hasta ${MAX_MB} MB: ${grandes.map((x) => x.name).join(', ')}`); return; }
    setDocs(await Promise.all(files.map(fileToB64)));
  }
  async function save() {
    if (!String(f.establecimiento).trim() || !String(f.tipo).trim()) { onError('Completá establecimiento y tipo.'); return; }
    setBusy(true);
    try {
      let id = hab?.id;
      if (hab) await api.put(`/chs/habilitaciones/${hab.id}`, f);
      else id = (await api.post<{ id: number }>('/chs/habilitaciones', f)).id;
      if (id && docs.length) await subirDocs(id, docs);
      onSaved(hab ? 'Habilitación actualizada' : 'Habilitación registrada');
    } catch (e: any) { onError(e.message); } finally { setBusy(false); }
  }

  const Sel = (k: string, label: string, opts: string[]) => (
    <div className="field"><label>{label}</label>
      <select className="input" value={f[k]} onChange={set(k)}><option value="">— Seleccionar —</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>
    </div>
  );
  const Inp = (k: string, label: string, type = 'text') => (
    <div className="field"><label>{label}</label><input className="input" type={type} value={f[k]} onChange={set(k)} /></div>
  );

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{hab ? 'Editar habilitación' : 'Nueva habilitación'}</h3>
        <div className="field"><label>Establecimiento *</label><input className="input" value={f.establecimiento} onChange={set('establecimiento')} placeholder="Ej.: Planta Pilar — Ruta 8 km 60" /></div>
        <div className="grid2" style={{ marginTop: 10 }}>
          {Sel('empresa', 'Empresa', EMPRESAS)}
          {Sel('tipo', 'Tipo *', TIPOS)}
          {Sel('organismo', 'Organismo emisor', ORGANISMOS)}
          {Inp('nroExpediente', 'Nº Expediente')}
          {Inp('nroHabilitacion', 'Nº Habilitación')}
          {Inp('rubro', 'Rubro / actividad')}
          {Inp('fechaOtorgamiento', 'Fecha de otorgamiento', 'date')}
          {Inp('fechaVencimiento', 'Fecha de vencimiento', 'date')}
          {Inp('diasAlerta', 'Avisar con (días de anticipación)', 'number')}
          <div className="field"><label>Estado</label>
            <select className="input" value={f.estadoManual} onChange={set('estadoManual')}>
              {ESTADOS_MANUALES.map((o) => <option key={o} value={o}>{o === 'Automático' ? 'Automático (por fecha)' : o}</option>)}
            </select>
          </div>
          {Inp('responsable', 'Responsable interno')}
          {Inp('tramitadoPor', 'Tramitado por')}
          {Inp('costo', 'Costo ($)', 'number')}
          {Inp('superficie', 'Superficie (m2)', 'number')}
          {Inp('capacidad', 'Capacidad (personas)', 'number')}
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Condiciones / exigencias del organismo</label><textarea className="input" rows={2} value={f.condiciones} onChange={set('condiciones')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Observaciones</label><textarea className="input" rows={2} value={f.observaciones} onChange={set('observaciones')} /></div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Documentos a adjuntar (hasta {MAX_MB} MB cada uno)</label>
          <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip" onChange={onFiles} />
          {!!docs.length && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{docs.length} archivo(s) por subir: {docs.map((d) => d.nombre).join(', ')}</div>}
          {hab && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Los documentos ya cargados se administran desde el botón 📎 del listado.</div>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Renovación ─────────────────────────
function RenovarModal({ hab, onClose, onSaved, onError }: { hab: Hab; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const [f, setF] = useState<any>({ fechaOtorgamiento: '', fechaVencimiento: '', nroExpediente: '', nroHabilitacion: '', costo: '', observaciones: '' });
  const [docs, setDocs] = useState<{ nombre: string; mime: string; data: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const grandes = files.filter((x) => x.size > MAX_MB * 1024 * 1024);
    if (grandes.length) { onError(`Cada archivo puede pesar hasta ${MAX_MB} MB`); return; }
    setDocs(await Promise.all(files.map(fileToB64)));
  }
  async function save() {
    if (!f.fechaVencimiento) { onError('Indicá la nueva fecha de vencimiento.'); return; }
    setBusy(true);
    try {
      await api.post(`/chs/habilitaciones/${hab.id}/renovar`, f);
      if (docs.length) await subirDocs(hab.id, docs);
      onSaved('Renovación registrada');
    } catch (e: any) { onError(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Registrar renovación</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          {hab.tipo} · {hab.establecimiento}<br />Vigencia actual: {fmt(hab.fechaOtorgamiento)} → {hab.fechaVencimiento ? fmt(hab.fechaVencimiento) : '∞'}
        </p>
        <div className="grid2">
          <div className="field"><label>Nuevo otorgamiento</label><input className="input" type="date" value={f.fechaOtorgamiento} onChange={set('fechaOtorgamiento')} /></div>
          <div className="field"><label>Nuevo vencimiento *</label><input className="input" type="date" value={f.fechaVencimiento} onChange={set('fechaVencimiento')} /></div>
          <div className="field"><label>Nº Expediente</label><input className="input" value={f.nroExpediente} onChange={set('nroExpediente')} /></div>
          <div className="field"><label>Nº Habilitación</label><input className="input" value={f.nroHabilitacion} onChange={set('nroHabilitacion')} /></div>
          <div className="field"><label>Costo del trámite ($)</label><input className="input" type="number" value={f.costo} onChange={set('costo')} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Observaciones</label><textarea className="input" rows={2} value={f.observaciones} onChange={set('observaciones')} /></div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Certificado renovado (adjunto)</label>
          <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip" onChange={onFiles} />
          {!!docs.length && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{docs.length} archivo(s): {docs.map((d) => d.nombre).join(', ')}</div>}
        </div>
        <p className="muted" style={{ fontSize: 12 }}>La vigencia anterior queda asentada en el historial del registro.</p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Registrar renovación'}</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Ficha: documentos + historial ─────────────────────────
function FichaModal({ hab, onClose, onChanged, onError }: { hab: Hab; onClose: () => void; onChanged: () => void; onError: (t: string) => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [hist, setHist] = useState<Hist[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [d, h] = await Promise.all([
        api.get<Doc[]>(`/chs/habilitaciones/${hab.id}/docs`),
        api.get<Hist[]>(`/chs/habilitaciones/${hab.id}/historial`),
      ]);
      setDocs(d); setHist(h);
    } catch (e: any) { onError(e.message); }
  }
  useEffect(() => { load(); }, [hab.id]);

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const grandes = files.filter((x) => x.size > MAX_MB * 1024 * 1024);
    if (grandes.length) { onError(`Cada archivo puede pesar hasta ${MAX_MB} MB`); return; }
    setBusy(true);
    try {
      await subirDocs(hab.id, await Promise.all(files.map(fileToB64)));
      e.target.value = '';
      await load(); onChanged();
    } catch (err: any) { onError(err.message); } finally { setBusy(false); }
  }
  async function borrarDoc(d: Doc) {
    if (!confirm(`¿Eliminar el documento "${d.nombre}"?`)) return;
    try { await api.del(`/chs/habilitaciones/${hab.id}/docs/${d.id}`); await load(); onChanged(); }
    catch (e: any) { onError(e.message); }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{hab.tipo}</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          {hab.establecimiento}{hab.empresa ? ` · ${hab.empresa}` : ''} · {hab.organismo || 'sin organismo'}<br />
          Vigencia {fmt(hab.fechaOtorgamiento)} → {hab.fechaVencimiento ? fmt(hab.fechaVencimiento) : '∞'} · {vigLbl(hab)}
          {hab.costo ? ` · último costo ${pesos(hab.costo)}` : ''}
        </p>

        <h4 style={{ marginBottom: 6 }}>Documentos ({docs.length})</h4>
        {!docs.length && <div className="muted" style={{ fontSize: 13 }}>Sin documentos adjuntos.</div>}
        {docs.map((d) => (
          <div key={d.id} className="row" style={{ gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <div style={{ flex: 1, fontSize: 13, minWidth: 0 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</div>
              <div className="muted" style={{ fontSize: 11 }}>{kb(d.bytes)}{d.createdAt ? ` · ${fmt(d.createdAt)}` : ''}{d.createdBy ? ` · ${d.createdBy}` : ''}</div>
            </div>
            <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => descargar(`/chs/habilitaciones/${hab.id}/docs/${d.id}/archivo`, d.nombre)}>Descargar</button>
            <button className="btn danger" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => borrarDoc(d)}>Eliminar</button>
          </div>
        ))}
        <div className="field" style={{ marginTop: 10 }}>
          <label>Agregar documentos (hasta {MAX_MB} MB cada uno)</label>
          <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip" onChange={subir} disabled={busy} />
        </div>

        <h4 style={{ marginBottom: 6, marginTop: 18 }}>Historial de renovaciones ({hist.length})</h4>
        {!hist.length && <div className="muted" style={{ fontSize: 13 }}>Sin renovaciones registradas.</div>}
        {hist.map((r) => (
          <div key={r.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <div><strong>{fmt(r.fechaRegistro)}</strong> · vencimiento {fmt(r.vencAnterior)} → <span style={{ color: 'var(--green)' }}>{fmt(r.vencNuevo)}</span></div>
            <div className="muted" style={{ fontSize: 11 }}>
              {r.otorgNuevo ? `otorgamiento ${fmt(r.otorgAnterior)} → ${fmt(r.otorgNuevo)} · ` : ''}
              {r.nroExpediente ? `exp. ${r.nroExpediente} · ` : ''}
              {r.costo ? `${pesos(r.costo)} · ` : ''}
              {r.observaciones || ''}{r.createdBy ? ` · ${r.createdBy}` : ''}
            </div>
          </div>
        ))}

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
