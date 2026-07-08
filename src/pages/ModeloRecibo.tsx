import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Modelo de recibo configurable (encabezado, leyenda al pie y logo).
export default function ModeloRecibo() {
  const [f, setF] = useState<any>({ encabezado: '', leyendaPie: '', logo: '', mostrarLogo: true });
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => { api.get<any>('/modelo-recibo').then((d) => setF({ encabezado: d.encabezado || '', leyendaPie: d.leyenda_pie || '', logo: d.logo || '', mostrarLogo: d.mostrar_logo !== false })).catch(() => {}); }, []);

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 400 * 1024) { setErr('El logo no puede superar los 400 KB.'); return; }
    const r = new FileReader(); r.onload = () => setF((s: any) => ({ ...s, logo: String(r.result) })); r.readAsDataURL(file);
  }
  async function guardar() {
    setErr(''); setMsg(''); setBusy(true);
    try { await api.put('/modelo-recibo', f); setMsg('Modelo de recibo guardado.'); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}
      <p className="muted" style={{ marginTop: 0 }}>Personalizá el encabezado, la leyenda al pie y el logo que aparecen en el recibo de haberes.</p>
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="field" style={{ marginBottom: 10 }}><label>Encabezado (texto libre, arriba del recibo)</label>
          <textarea className="input" rows={2} value={f.encabezado} onChange={(e) => setF({ ...f, encabezado: e.target.value })} placeholder="Ej: Grupo LEITEN — Recibo de sueldo" /></div>
        <div className="field" style={{ marginBottom: 10 }}><label>Leyenda al pie (texto legal / aclaraciones)</label>
          <textarea className="input" rows={3} value={f.leyendaPie} onChange={(e) => setF({ ...f, leyendaPie: e.target.value })} placeholder="Ej: Recibo emitido conforme art. 140 LCT…" /></div>
        <div className="field" style={{ marginBottom: 10 }}>
          <label className="row" style={{ gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={f.mostrarLogo} onChange={(e) => setF({ ...f, mostrarLogo: e.target.checked })} /> Mostrar logo en el recibo</label>
        </div>
        <div className="field" style={{ marginBottom: 10 }}><label>Logo (imagen, máx. 400 KB)</label>
          <input type="file" accept="image/*" onChange={onLogo} />
          {f.logo && <div style={{ marginTop: 8 }}><img src={f.logo} alt="logo" style={{ maxHeight: 60, maxWidth: 200, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 6, padding: 4 }} /> <button className="btn ghost" style={{ marginLeft: 8 }} onClick={() => setF({ ...f, logo: '' })}>Quitar</button></div>}
        </div>
        <button className="btn primary" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Guardar modelo'}</button>
      </div>
    </>
  );
}
