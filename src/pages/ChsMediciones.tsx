import { useEffect, useMemo, useState } from 'react';
import { api, fetchBlob } from '../lib/api';

interface Med {
  id: number; tipo?: string; empresa?: string; lugar?: string; empresaResponsable?: string;
  fechaRealizacion?: string; fechaVencimiento?: string; resultado?: string; archivoNombre?: string; tieneArchivo?: boolean;
}
const TIPOS = ['Ruido', 'Iluminación', 'Puesta a tierra / Continuidad', 'Carga de fuego', 'Contaminantes ambientales', 'Estrés térmico', 'Ergonomía', 'Vibraciones', 'Radiaciones'];
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };

// Estado por vencimiento.
function venc(fv?: string): { label: string; color: string; dias: number | null } {
  if (!fv) return { label: 'Sin vencimiento', color: 'var(--t3)', dias: null };
  const m = String(fv).match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return { label: '—', color: 'var(--t3)', dias: null };
  const hoy = new Date(); const h0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dias = Math.round((d.getTime() - h0.getTime()) / 86400000);
  if (dias < 0) return { label: `Vencida hace ${-dias} d`, color: 'var(--red)', dias };
  if (dias <= 30) return { label: `Vence en ${dias} d`, color: 'var(--yellow)', dias };
  return { label: `Vigente (${dias} d)`, color: 'var(--green)', dias };
}

function fileToB64(file: File): Promise<{ nombre: string; mime: string; data: string }> {
  return new Promise((resolve) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); resolve({ nombre: file.name, mime: file.type || 'application/octet-stream', data: s.slice(s.indexOf(',') + 1) }); }; r.readAsDataURL(file); });
}
async function descargar(url: string, nombre?: string) { const blob = await fetchBlob(url); const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = nombre || 'informe'; a.click(); URL.revokeObjectURL(u); }

export default function ChsMediciones() {
  const [items, setItems] = useState<Med[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [edit, setEdit] = useState<Med | null>(null);
  const [show, setShow] = useState(false);

  async function load() { try { setItems(await api.get<Med[]>('/chs/mediciones')); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); }, []);

  const alertas = useMemo(() => items.filter((m) => { const v = venc(m.fechaVencimiento); return v.dias !== null && v.dias <= 30; }), [items]);
  async function eliminar(m: Med) { if (!confirm('¿Eliminar esta medición?')) return; try { await api.del(`/chs/mediciones/${m.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => { setEdit(null); setShow(true); }}>+ Nueva medición</button>
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}

      {alertas.length > 0 && (
        <div className="card" style={{ marginBottom: 14, borderLeft: '3px solid var(--yellow)' }}>
          <strong>⏰ {alertas.length} medición(es) vencida(s) o por vencer (≤30 días)</strong>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{alertas.map((m) => `${m.tipo || 'Medición'} (${venc(m.fechaVencimiento).label})`).join(' · ')}</div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Tipo</th><th>Empresa / Lugar</th><th>Responsable</th><th>Realización</th><th>Vencimiento</th><th>Estado</th><th>Informe</th><th></th></tr></thead>
          <tbody>
            {items.map((m) => { const v = venc(m.fechaVencimiento); return (
              <tr key={m.id}>
                <td>{m.tipo || '—'}</td>
                <td className="muted">{[m.empresa, m.lugar].filter(Boolean).join(' · ') || '—'}</td>
                <td className="muted">{m.empresaResponsable || '—'}</td>
                <td>{fmt(m.fechaRealizacion)}</td>
                <td>{fmt(m.fechaVencimiento)}</td>
                <td><span className="badge" style={{ color: v.color }}>{v.label}</span></td>
                <td>{m.tieneArchivo ? <a style={{ cursor: 'pointer', color: 'var(--accent2)' }} onClick={() => descargar(`/chs/mediciones/${m.id}/archivo`, m.archivoNombre)}>📎</a> : '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => { setEdit(m); setShow(true); }}>Editar</button>
                  <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(m)}>Eliminar</button>
                </td>
              </tr>
            ); })}
            {!items.length && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin mediciones cargadas.</td></tr>}
          </tbody>
        </table>
      </div>

      {show && <MedModal med={edit} onClose={() => setShow(false)} onSaved={(t) => { setShow(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

function MedModal({ med, onClose, onSaved, onError }: { med: Med | null; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const m = med || ({} as Med);
  const [f, setF] = useState<any>({
    tipo: m.tipo || '', empresa: m.empresa || '', lugar: m.lugar || '', empresaResponsable: m.empresaResponsable || '',
    fechaRealizacion: (m.fechaRealizacion || '').slice(0, 10), fechaVencimiento: (m.fechaVencimiento || '').slice(0, 10), resultado: m.resultado || '',
  });
  const [archivo, setArchivo] = useState<any>(null);
  const [quitar, setQuitar] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; if (file.size > 4.5 * 1024 * 1024) return onError('Máximo 4,5 MB'); setArchivo(await fileToB64(file)); setQuitar(false); }
  async function save() {
    setBusy(true);
    try {
      const body: any = { ...f };
      if (archivo) body.archivo = archivo; else if (quitar) body.quitarArchivo = true;
      if (med) await api.put(`/chs/mediciones/${med.id}`, body); else await api.post('/chs/mediciones', body);
      onSaved(med ? 'Medición actualizada' : 'Medición registrada');
    } catch (e: any) { onError(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{med ? 'Editar medición' : 'Nueva medición'}</h3>
        <div className="grid2">
          <div className="field"><label>Tipo de medición</label><input className="input" list="med-tipos" value={f.tipo} onChange={set('tipo')} /><datalist id="med-tipos">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist></div>
          <div className="field"><label>Empresa responsable (quién la hizo)</label><input className="input" value={f.empresaResponsable} onChange={set('empresaResponsable')} /></div>
          <div className="field"><label>Empresa (del grupo)</label><input className="input" value={f.empresa} onChange={set('empresa')} /></div>
          <div className="field"><label>Lugar / Sector</label><input className="input" value={f.lugar} onChange={set('lugar')} /></div>
          <div className="field"><label>Fecha de realización</label><input className="input" type="date" value={f.fechaRealizacion} onChange={set('fechaRealizacion')} /></div>
          <div className="field"><label>Fecha de vencimiento</label><input className="input" type="date" value={f.fechaVencimiento} onChange={set('fechaVencimiento')} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>Resultado</label><textarea className="input" rows={2} value={f.resultado} onChange={set('resultado')} /></div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Informe adjunto</label>
          <input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={onFile} />
          {archivo && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nuevo: {archivo.nombre}</div>}
          {!archivo && med?.tieneArchivo && !quitar && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Actual: {med.archivoNombre} · <a style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => setQuitar(true)}>quitar</a></div>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
