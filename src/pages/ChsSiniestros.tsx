import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';
import EmpleadoPicker from '../components/EmpleadoPicker';

interface Seg { fecha: string; detalle: string }
interface Sin {
  id: number; tipo?: string; empleadoId?: number; empleadoNom?: string; empleadoLeg?: string; empresa?: string;
  fecha?: string; lugar?: string; descripcion?: string; causas?: string; acciones?: string; estado?: string;
  artNro?: string; diasBaja?: number; seguimientos: Seg[]; archivoNombre?: string; tieneArchivo?: boolean;
}

const TIPOS = ['Accidente de trabajo', 'Accidente in itinere', 'Enfermedad profesional', 'Incidente'];
const ESTADOS = ['Abierto', 'En tratamiento', 'Cerrado'];
const tipoColor = (t?: string) => t === 'Incidente' ? 'var(--yellow)' : t === 'Enfermedad profesional' ? 'rgb(168,85,247)' : 'var(--red)';
const estColor = (e?: string) => e === 'Cerrado' ? 'var(--green)' : e === 'En tratamiento' ? 'var(--yellow)' : 'var(--red)';
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };

function fileToB64(file: File): Promise<{ nombre: string; mime: string; data: string }> {
  return new Promise((resolve) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); resolve({ nombre: file.name, mime: file.type || 'application/octet-stream', data: s.slice(s.indexOf(',') + 1) }); }; r.readAsDataURL(file); });
}
async function descargar(url: string, nombre?: string) {
  const blob = await fetchBlob(url); const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = nombre || 'archivo'; a.click(); URL.revokeObjectURL(u);
}

export default function ChsSiniestros() {
  const [items, setItems] = useState<Sin[]>([]);
  const [fTipo, setFTipo] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [edit, setEdit] = useState<Sin | null>(null);
  const [show, setShow] = useState(false);

  async function load() {
    try {
      const p = new URLSearchParams(); if (fTipo) p.set('tipo', fTipo); if (fEstado) p.set('estado', fEstado);
      setItems(await api.get<Sin[]>(`/chs/siniestros?${p}`));
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fTipo, fEstado]);

  async function eliminar(s: Sin) { if (!confirm('¿Eliminar este registro de siniestro?')) return; try { await api.del(`/chs/siniestros/${s.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 220 }} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
          <option value="">Todos los tipos</option>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 180 }} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
          <option value="">Todos los estados</option>{ESTADOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => { setEdit(null); setShow(true); }}>+ Nuevo siniestro</button>
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {!items.length && <div className="muted">Sin registros.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((s) => (
          <div key={s.id} className="card" style={{ borderLeft: `3px solid ${tipoColor(s.tipo)}` }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <span className="badge" style={{ color: tipoColor(s.tipo) }}>{s.tipo || '—'}</span>
                <span className="badge" style={{ color: estColor(s.estado), marginLeft: 6 }}>{s.estado || 'Abierto'}</span>
                <div style={{ marginTop: 6 }}><strong>{s.empleadoNom || '(sin empleado)'}</strong> {s.empleadoLeg && <span className="muted">· {s.empleadoLeg}</span>}</div>
                <div className="muted" style={{ fontSize: 12 }}>{fmt(s.fecha)}{s.lugar ? ` · ${s.lugar}` : ''}{s.artNro ? ` · ART N° ${s.artNro}` : ''}{s.diasBaja ? ` · ${s.diasBaja} días de baja` : ''}</div>
                {s.descripcion && <div style={{ marginTop: 6, fontSize: 13 }}>{s.descripcion}</div>}
              </div>
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                {s.tieneArchivo && <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => descargar(`/chs/siniestros/${s.id}/archivo`, s.archivoNombre)}>📎</button>}
                <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setEdit(s); setShow(true); }}>Editar</button>
                <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(s)}>Eliminar</button>
              </div>
            </div>
            {(s.causas || s.acciones) && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{s.causas ? `Causas: ${s.causas}` : ''}{s.causas && s.acciones ? ' · ' : ''}{s.acciones ? `Acciones: ${s.acciones}` : ''}</div>}
            {!!(s.seguimientos || []).length && (
              <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Seguimiento ART / Medicina Laboral</div>
                {s.seguimientos.map((g, i) => <div key={i} style={{ fontSize: 12 }}><strong>{fmt(g.fecha)}</strong> — {g.detalle}</div>)}
              </div>
            )}
          </div>
        ))}
      </div>

      {show && <SinModal sin={edit} onClose={() => setShow(false)} onSaved={(t) => { setShow(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

function SinModal({ sin, onClose, onSaved, onError }: { sin: Sin | null; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const s = sin || ({} as Sin);
  const [f, setF] = useState<any>({
    tipo: s.tipo || TIPOS[0], empleadoId: s.empleadoId || null, empleadoNom: s.empleadoNom || '',
    fecha: (s.fecha || '').slice(0, 10), lugar: s.lugar || '', descripcion: s.descripcion || '', causas: s.causas || '',
    acciones: s.acciones || '', estado: s.estado || 'Abierto', artNro: s.artNro || '', diasBaja: s.diasBaja || '',
  });
  const [segs, setSegs] = useState<Seg[]>(s.seguimientos || []);
  const [archivo, setArchivo] = useState<any>(null);
  const [quitar, setQuitar] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  function addSeg() { setSegs([...segs, { fecha: new Date().toISOString().slice(0, 10), detalle: '' }]); }
  function setSeg(i: number, k: string, v: string) { const a = [...segs]; a[i] = { ...a[i], [k]: v }; setSegs(a); }
  function delSeg(i: number) { setSegs(segs.filter((_, j) => j !== i)); }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; if (file.size > 4.5 * 1024 * 1024) return onError('Máximo 4,5 MB'); setArchivo(await fileToB64(file)); setQuitar(false); }

  async function save() {
    setBusy(true);
    try {
      const body: any = { ...f, diasBaja: f.diasBaja ? Number(f.diasBaja) : null, seguimientos: segs.filter((g) => g.detalle.trim()) };
      if (archivo) body.archivo = archivo; else if (quitar) body.quitarArchivo = true;
      if (sin) await api.put(`/chs/siniestros/${sin.id}`, body); else await api.post('/chs/siniestros', body);
      onSaved(sin ? 'Siniestro actualizado' : 'Siniestro registrado');
    } catch (e: any) { onError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{sin ? 'Editar siniestro' : 'Nuevo siniestro'}</h3>
        <div className="grid2">
          <div className="field"><label>Clasificación</label><select className="input" value={f.tipo} onChange={set('tipo')}>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="field"><label>Estado</label><select className="input" value={f.estado} onChange={set('estado')}>{ESTADOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Trabajador involucrado</label>
          {f.empleadoId ? (
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="input" style={{ flex: 1 }}>{f.empleadoNom}</span>
              <button type="button" className="btn ghost" onClick={() => setF({ ...f, empleadoId: null, empleadoNom: '' })}>Cambiar</button>
            </div>
          ) : <EmpleadoPicker onSelect={(e) => e && setF({ ...f, empleadoId: e.id, empleadoNom: `${e.nom} (${e.legNum})` })} />}
        </div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div className="field"><label>Fecha del evento</label><input className="input" type="date" value={f.fecha} onChange={set('fecha')} /></div>
          <div className="field"><label>Lugar</label><input className="input" value={f.lugar} onChange={set('lugar')} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Descripción de lo ocurrido</label><textarea className="input" rows={3} value={f.descripcion} onChange={set('descripcion')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Causas identificadas</label><textarea className="input" rows={2} value={f.causas} onChange={set('causas')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Acciones correctivas / preventivas</label><textarea className="input" rows={2} value={f.acciones} onChange={set('acciones')} /></div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div className="field"><label>N° de siniestro ART</label><input className="input" value={f.artNro} onChange={set('artNro')} /></div>
          <div className="field"><label>Días de baja</label><input className="input" type="number" value={f.diasBaja} onChange={set('diasBaja')} /></div>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 6px' }}>
          <div className="sb-group-label" style={{ margin: 0 }}>Seguimiento ART / Medicina Laboral</div>
          <button type="button" className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={addSeg}>+ Seguimiento</button>
        </div>
        {segs.map((g, i) => (
          <div key={i} className="row" style={{ gap: 6, marginBottom: 6 }}>
            <input className="input" type="date" style={{ width: 150 }} value={g.fecha} onChange={(e) => setSeg(i, 'fecha', e.target.value)} />
            <input className="input" style={{ flex: 1 }} placeholder="Detalle del seguimiento" value={g.detalle} onChange={(e) => setSeg(i, 'detalle', e.target.value)} />
            <button type="button" className="btn ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => delSeg(i)}>✕</button>
          </div>
        ))}

        <div className="field" style={{ marginTop: 12 }}>
          <label>Denuncia / documentación adjunta</label>
          <input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={onFile} />
          {archivo && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nuevo: {archivo.nombre}</div>}
          {!archivo && sin?.tieneArchivo && !quitar && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Actual: {sin.archivoNombre} · <a style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => setQuitar(true)}>quitar</a></div>}
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
