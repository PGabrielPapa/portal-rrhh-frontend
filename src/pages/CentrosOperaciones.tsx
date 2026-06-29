import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Centro {
  id: number; codigo: string; denominacion: string;
  calle?: string; numero?: string; localidad?: string; provincia?: string; cp?: string;
  empresas?: number;
}
const CAMPOS: [keyof Centro, string][] = [
  ['calle', 'Calle'], ['numero', 'Número'], ['localidad', 'Localidad'], ['provincia', 'Provincia'], ['cp', 'Código postal'],
];

export default function CentrosOperaciones() {
  const [items, setItems] = useState<Centro[]>([]);
  const [edit, setEdit] = useState<Centro | null>(null);
  const [creando, setCreando] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  async function load() { try { setItems(await api.get<Centro[]>('/admin/centros')); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); }, []);

  async function eliminar(c: Centro) {
    if (!confirm(`¿Eliminar el centro "${c.denominacion}" (${c.codigo})? Se desvincula de las empresas asociadas.`)) return;
    try { await api.del(`/admin/centros/${c.id}`); setMsg({ t: 'Centro eliminado', ok: true }); load(); }
    catch (err: any) { setMsg({ t: err.message, ok: false }); }
  }

  const dom = (c: Centro) => [c.calle, c.numero, c.localidad, c.provincia, c.cp].filter(Boolean).join(' ') || '—';

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => setCreando(true)}>+ Nuevo centro</button>
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Código</th><th>Denominación</th><th>Domicilio</th><th style={{ textAlign: 'right' }}>Empresas</th><th></th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{c.codigo}</td>
                <td>{c.denominacion}</td>
                <td className="muted">{dom(c)}</td>
                <td style={{ textAlign: 'right' }}>{c.empresas ?? 0}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => setEdit(c)}>Editar</button>
                  <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(c)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin centros de operaciones.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>Los centros de operaciones son las locaciones donde funcionan las empresas. Se vinculan a una o varias empresas desde «Empresas»; un mismo centro puede ser compartido.</p>
      {(edit || creando) && <CentroModal centro={edit} onClose={() => { setEdit(null); setCreando(false); }} onSaved={(m) => { setEdit(null); setCreando(false); setMsg({ t: m, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
    </>
  );
}

function CentroModal({ centro, onClose, onSaved, onError }: { centro: Centro | null; onClose: () => void; onSaved: (m: string) => void; onError: (t: string) => void; }) {
  const [f, setF] = useState<Centro>({ id: 0, codigo: '', denominacion: '', ...(centro || {}) } as Centro);
  const [busy, setBusy] = useState(false);
  const esNuevo = !centro;
  const set = (k: keyof Centro, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!String(f.codigo).trim()) { onError('El código es obligatorio'); return; }
    if (!String(f.denominacion).trim()) { onError('La denominación es obligatoria'); return; }
    setBusy(true);
    try {
      const body = { codigo: f.codigo, denominacion: f.denominacion, calle: f.calle, numero: f.numero, localidad: f.localidad, provincia: f.provincia, cp: f.cp };
      if (esNuevo) await api.post('/admin/centros', body);
      else await api.patch(`/admin/centros/${centro!.id}`, body);
      onSaved(esNuevo ? 'Centro creado' : 'Centro actualizado');
    } catch (e: any) { onError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{esNuevo ? 'Nuevo centro de operaciones' : f.denominacion}</h3>
        <div className="grid2">
          <div className="field"><label>Código *</label><input className="input" value={f.codigo} onChange={(e) => set('codigo', e.target.value)} /></div>
          <div className="field"><label>Denominación *</label><input className="input" value={f.denominacion} onChange={(e) => set('denominacion', e.target.value)} /></div>
        </div>
        <div className="grid2" style={{ marginTop: 8 }}>
          {CAMPOS.map(([k, l]) => <div className="field" key={k}><label>{l}</label><input className="input" value={(f[k] as string) || ''} onChange={(e) => set(k, e.target.value)} /></div>)}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : (esNuevo ? 'Crear' : 'Guardar')}</button>
        </div>
      </div>
    </div>
  );
}
