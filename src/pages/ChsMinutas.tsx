import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';

interface Accion { accion: string; responsable: string; vence: string; estado: string }
interface Minuta {
  id: number; comite?: string; fecha?: string; participantes?: string; temas?: string;
  decisiones?: string; observaciones?: string; acciones: Accion[]; archivoNombre?: string; tieneArchivo?: boolean;
}

const COMITES = ['LEITEN · SINIS · BARTON', 'IDEEE'];
const EST_ACC = ['Pendiente', 'En curso', 'Cumplida'];
const estColor = (e: string) => e === 'Cumplida' ? 'var(--green)' : e === 'En curso' ? 'var(--yellow)' : 'var(--red)';
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };

export default function ChsMinutas() {
  const [items, setItems] = useState<Minuta[]>([]);
  const [comite, setComite] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [edit, setEdit] = useState<Minuta | null>(null);
  const [show, setShow] = useState(false);

  async function load() {
    try { const p = comite ? `?comite=${encodeURIComponent(comite)}` : ''; setItems(await api.get<Minuta[]>(`/chs/minutas${p}`)); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [comite]);

  async function eliminar(m: Minuta) {
    if (!confirm(`¿Eliminar la minuta del ${fmt(m.fecha)}?`)) return;
    try { await api.del(`/chs/minutas/${m.id}`); setMsg({ t: 'Minuta eliminada', ok: true }); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function descargar(m: Minuta) {
    try {
      const blob = await fetchBlob(`/chs/minutas/${m.id}/archivo`);
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = m.archivoNombre || 'acta'; a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 240 }} value={comite} onChange={(e) => setComite(e.target.value)}>
          <option value="">Todos los comités</option>
          {COMITES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => { setEdit(null); setShow(true); }}>+ Nueva minuta</button>
      </div>
      {err && <div className="err" style={{ marginBottom: 10 }}>⚠ {err}</div>}
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}

      {!items.length && <div className="muted">Sin minutas cargadas.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((m) => {
          const pend = (m.acciones || []).filter((a) => a.estado !== 'Cumplida').length;
          return (
            <div key={m.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <strong>{fmt(m.fecha)}</strong> <span className="muted">· {m.comite || '—'}</span>
                  {m.temas && <div style={{ marginTop: 4 }}>{m.temas}</div>}
                </div>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  {m.tieneArchivo && <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => descargar(m)}>📎 Acta</button>}
                  <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setEdit(m); setShow(true); }}>Editar</button>
                  <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(m)}>Eliminar</button>
                </div>
              </div>
              {!!(m.acciones || []).length && (
                <table style={{ width: '100%', fontSize: 13, marginTop: 10 }}>
                  <thead><tr><th style={{ textAlign: 'left' }}>Acción</th><th style={{ textAlign: 'left' }}>Responsable</th><th style={{ textAlign: 'left' }}>Vence</th><th style={{ textAlign: 'left' }}>Estado</th></tr></thead>
                  <tbody>
                    {m.acciones.map((a, i) => (
                      <tr key={i}><td>{a.accion}</td><td>{a.responsable || '—'}</td><td>{fmt(a.vence)}</td>
                        <td><span className="badge" style={{ color: estColor(a.estado) }}>{a.estado || 'Pendiente'}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{pend} acción(es) pendiente(s){m.decisiones ? ` · Decisiones: ${m.decisiones}` : ''}</div>
            </div>
          );
        })}
      </div>

      {show && <MinutaModal minuta={edit} onClose={() => setShow(false)} onSaved={(t) => { setShow(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

function MinutaModal({ minuta, onClose, onSaved, onError }: { minuta: Minuta | null; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const m = minuta || ({} as Minuta);
  const [f, setF] = useState<any>({
    comite: m.comite || COMITES[0], fecha: (m.fecha || '').slice(0, 10), participantes: m.participantes || '',
    temas: m.temas || '', decisiones: m.decisiones || '', observaciones: m.observaciones || '',
  });
  const [acciones, setAcciones] = useState<Accion[]>(m.acciones || []);
  const [archivo, setArchivo] = useState<{ nombre: string; mime: string; data: string } | null>(null);
  const [quitar, setQuitar] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  function addAccion() { setAcciones([...acciones, { accion: '', responsable: '', vence: '', estado: 'Pendiente' }]); }
  function setAcc(i: number, k: string, v: string) { const a = [...acciones]; a[i] = { ...a[i], [k]: v }; setAcciones(a); }
  function delAcc(i: number) { setAcciones(acciones.filter((_, j) => j !== i)); }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) { onError('El archivo no debe superar 4,5 MB'); return; }
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); const i = s.indexOf(','); setArchivo({ nombre: file.name, mime: file.type || 'application/octet-stream', data: s.slice(i + 1) }); setQuitar(false); };
    r.readAsDataURL(file);
  }

  async function save() {
    setBusy(true);
    try {
      const body: any = { ...f, acciones: acciones.filter((a) => a.accion.trim()) };
      if (archivo) body.archivo = archivo; else if (quitar) body.quitarArchivo = true;
      if (minuta) await api.put(`/chs/minutas/${minuta.id}`, body); else await api.post('/chs/minutas', body);
      onSaved(minuta ? 'Minuta actualizada' : 'Minuta creada');
    } catch (e: any) { onError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{minuta ? 'Editar minuta' : 'Nueva minuta'}</h3>
        <div className="grid2">
          <div className="field"><label>Comité</label><select className="input" value={f.comite} onChange={set('comite')}>{COMITES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="field"><label>Fecha de reunión</label><input className="input" type="date" value={f.fecha} onChange={set('fecha')} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Participantes</label><textarea className="input" rows={2} value={f.participantes} onChange={set('participantes')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Temas tratados</label><textarea className="input" rows={3} value={f.temas} onChange={set('temas')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Decisiones adoptadas</label><textarea className="input" rows={2} value={f.decisiones} onChange={set('decisiones')} /></div>

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 6px' }}>
          <div className="sb-group-label" style={{ margin: 0 }}>Acciones definidas</div>
          <button type="button" className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={addAccion}>+ Acción</button>
        </div>
        {acciones.map((a, i) => (
          <div key={i} className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: 2, minWidth: 160 }} placeholder="Acción" value={a.accion} onChange={(e) => setAcc(i, 'accion', e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 110 }} placeholder="Responsable" value={a.responsable} onChange={(e) => setAcc(i, 'responsable', e.target.value)} />
            <input className="input" type="date" style={{ width: 150 }} value={a.vence} onChange={(e) => setAcc(i, 'vence', e.target.value)} />
            <select className="input" style={{ width: 120 }} value={a.estado} onChange={(e) => setAcc(i, 'estado', e.target.value)}>{EST_ACC.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            <button type="button" className="btn ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => delAcc(i)}>✕</button>
          </div>
        ))}
        {!acciones.length && <div className="muted" style={{ fontSize: 12 }}>Sin acciones. Agregá con "+ Acción".</div>}

        <div className="field" style={{ marginTop: 14 }}><label>Observaciones</label><textarea className="input" rows={2} value={f.observaciones} onChange={set('observaciones')} /></div>

        <div className="field" style={{ marginTop: 10 }}>
          <label>Acta / archivo adjunto (PDF, imagen, Office)</label>
          <input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={onFile} />
          {archivo && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nuevo: {archivo.nombre}</div>}
          {!archivo && minuta?.tieneArchivo && !quitar && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Actual: {minuta.archivoNombre} · <a style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => setQuitar(true)}>quitar</a></div>}
          {quitar && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Se quitará el archivo al guardar. <a style={{ cursor: 'pointer' }} onClick={() => setQuitar(false)}>deshacer</a></div>}
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
