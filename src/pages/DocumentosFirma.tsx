import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Doc { id: number; titulo: string; descripcion: string; url?: string; total: number; firmados: number; createdAt: string; }
interface Acuse { nom: string; leg_num: string; empresa: string; firmado_at?: string | null; firma_nombre?: string; }
const fecha = (s?: string | null) => s ? new Date(s).toLocaleString('es-AR') : '';

export default function DocumentosFirma() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [url, setUrl] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [acuses, setAcuses] = useState<{ id: number; rows: Acuse[] } | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  function cargar() { api.get<Doc[]>('/firmas').then(setDocs).catch(() => {}); }
  useEffect(() => { cargar(); api.get<any[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {}); }, []);

  async function publicar() {
    if (!titulo.trim()) return;
    try {
      const r = await api.post<{ destinatarios: number }>('/firmas', { titulo: titulo.trim(), descripcion, url: url.trim() || null, empresa: empresa || null });
      setTitulo(''); setDescripcion(''); setUrl(''); setEmpresa('');
      setMsg({ t: `Documento publicado para ${r.destinatarios} empleado(s)`, ok: true }); cargar();
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function verAcuses(d: Doc) { try { setAcuses({ id: d.id, rows: await api.get<Acuse[]>(`/firmas/${d.id}/acuses`) }); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  async function borrar(d: Doc) { if (!confirm('¿Borrar el documento y sus firmas?')) return; try { await api.del(`/firmas/${d.id}`); setAcuses(null); cargar(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  return (
    <>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 12 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      <div className="card" style={{ marginBottom: 14 }}>
        <h4 style={{ marginTop: 0 }}>Nuevo documento para firma</h4>
        <div className="field" style={{ marginBottom: 8 }}><label>Título</label><input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Política de uso de datos 2026" /></div>
        <div className="field" style={{ marginBottom: 8 }}><label>Texto / descripción</label><textarea className="input" rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 240px' }}><label>URL del documento (opcional)</label><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
          <div className="field"><label>Destinatarios</label><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas las empresas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select></div>
          <button className="btn" onClick={publicar} disabled={!titulo.trim()}>Publicar y asignar</button>
        </div>
      </div>

      {docs.map((d) => (
        <div key={d.id} className="card" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <b>{d.titulo}</b>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Firmados {d.firmados} de {d.total} · {d.total ? Math.round((d.firmados / d.total) * 100) : 0}%</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => verAcuses(d)}>Ver firmas</button>
              <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => borrar(d)}>Borrar</button>
            </div>
          </div>
          {acuses?.id === d.id && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead><tr><th style={{ textAlign: 'left' }}>Empleado</th><th style={{ textAlign: 'left' }}>Empresa</th><th style={{ textAlign: 'left' }}>Estado</th></tr></thead>
                <tbody>
                  {acuses.rows.map((a, i) => (
                    <tr key={i}><td>{a.nom} <span className="muted">({a.leg_num})</span></td><td>{a.empresa}</td>
                      <td>{a.firmado_at ? <span style={{ color: 'var(--green)' }}>✔ {fecha(a.firmado_at)}</span> : <span className="muted">pendiente</span>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      {!docs.length && <div className="muted">No hay documentos para firma.</div>}
    </>
  );
}
