import { useEffect, useState } from 'react';
import { api, fetchBlob } from '../lib/api';

const fmt = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR') : '—';
function vence(fecha: string, meses?: number | null) {
  if (!meses) return null;
  const d = new Date(String(fecha).slice(0, 10) + 'T12:00:00'); d.setMonth(d.getMonth() + meses);
  return d;
}
const EPP_VIG = 12;

export default function MisHys() {
  const [caps, setCaps] = useState<any[]>([]);
  const [epp, setEpp] = useState<any[]>([]);
  const [talles, setTalles] = useState<Record<string, string>>({});
  const [manuales, setManuales] = useState<any[]>([]);
  const [tallesCat, setTallesCat] = useState<{ codigo: string; nombre: string }[]>([]);
  const [te, setTe] = useState<Record<string, string>>({});
  const [tmsg, setTmsg] = useState('');
  const [tallesHist, setTallesHist] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get<{ capacitaciones: any[]; epp: any[]; talles: Record<string, string> }>('/hys/mis')
      .then((d: any) => { setCaps(d.capacitaciones || []); setEpp(d.epp || []); setTalles(d.talles || {}); setTe(d.talles || {}); setTallesHist(d.tallesHistorial || []); })
      .catch((e) => setErr(e.message));
    api.get<any[]>('/hys/manuales').then(setManuales).catch(() => {});
    api.get<{ talles: { codigo: string; nombre: string }[] }>('/hys/catalogos').then((c) => setTallesCat(c.talles || [])).catch(() => {});
  }, []);

  const hoy = new Date();
  const estadoCap = (c: any) => { const v = vence(c.fecha, c.vigencia_meses); if (!v) return null; if (v < hoy) return 'vencida'; if (v.getTime() - hoy.getTime() <= 30 * 86400000) return 'por_vencer'; return 'vigente'; };
  const estadoEpp = (x: any) => { const v = vence(x.fecha, EPP_VIG)!; if (v < hoy) return 'vencida'; if (v.getTime() - hoy.getTime() <= 30 * 86400000) return 'por_vencer'; return 'vigente'; };
  const badge = (st: string | null) => st === 'vencida' ? <span className="badge" style={{ color: 'var(--red)', border: '1px solid rgba(239,68,68,.4)' }}>vencida</span>
    : st === 'por_vencer' ? <span className="badge" style={{ color: 'var(--yellow)', border: '1px solid rgba(234,179,8,.4)' }}>por vencer</span>
    : st === 'vigente' ? <span className="badge" style={{ color: 'var(--green)', border: '1px solid rgba(34,197,94,.4)' }}>vigente</span> : null;

  async function ver(m: any) { try { const b = await fetchBlob(`/hys/manuales/${m.id}/descargar`); window.open(URL.createObjectURL(b), '_blank'); } catch { /* */ } }
  async function descargar(m: any) { try { const b = await fetchBlob(`/hys/manuales/${m.id}/descargar`); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = m.filename || m.titulo; a.click(); } catch { /* */ } }
  async function guardarTalles() {
    setTmsg('');
    try {
      const r = await api.put<{ cambios: number }>('/hys/mis/talles', te);
      const d = await api.get<any>('/hys/mis'); setTalles(d.talles || {}); setTe(d.talles || {}); setTallesHist(d.tallesHistorial || []);
      setTmsg(r.cambios ? 'Talles guardados ✓ — RR.HH. fue notificado.' : 'Sin cambios.');
    } catch (e: any) { setErr(e.message); }
  }
  async function acusar(m: any) { try { await api.post(`/hys/manuales/${m.id}/acuse`); setManuales(await api.get<any[]>('/hys/manuales')); } catch (e: any) { setErr(e.message); } }

  const cats = manuales.filter((m) => (m.tipo || 'manual') === 'catalogo');
  const mans = manuales.filter((m) => (m.tipo || 'manual') === 'manual');

  if (err) return <div className="err">⚠ {err}</div>;
  return (
    <>
      <div className="card" style={{ marginBottom: 14, fontSize: 13, background: 'rgba(234,179,8,.06)', border: '1px solid rgba(234,179,8,.3)' }}>
        🦺 <b>Higiene y Seguridad.</b> Acá ves tus capacitaciones, los elementos de protección personal (EPP) que se te entregaron, tus talles y los manuales/documentos de seguridad de la empresa.
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Mis capacitaciones</h3>
        {caps.map((c) => { const v = vence(c.fecha, c.vigencia_meses); return (
          <div key={c.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <span>{c.nombre} <span className="muted">· {fmt(c.fecha)}{v ? ` · vence ${fmt(v.toISOString())}` : ''}</span></span>
            {badge(estadoCap(c))}
          </div>
        ); })}
        {!caps.length && <div className="muted" style={{ fontSize: 13 }}>Todavía no tenés capacitaciones registradas.</div>}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>EPP entregados</h3>
        {epp.map((x) => { const v = vence(x.fecha, EPP_VIG)!; return (
          <div key={x.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <span>{x.nombre} <span className="muted">· {x.cantidad} u{x.talle ? ` · talle ${x.talle}` : ''} · {fmt(x.fecha)} · renueva {fmt(v.toISOString())}</span></span>
            {badge(estadoEpp(x))}
          </div>
        ); })}
        {!epp.length && <div className="muted" style={{ fontSize: 13 }}>Sin entregas de EPP registradas.</div>}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Mis talles</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>Cargá o actualizá tus talles para la entrega de ropa y EPP. Se guardan al presionar “Guardar talles”.</p>
        <div className="grid2">
          {tallesCat.map((t) => (
            <div className="field" key={t.codigo}><label>{t.nombre}</label><input className="input" value={te[t.codigo] || ''} onChange={(e) => { setTe({ ...te, [t.codigo]: e.target.value }); setTmsg(''); }} placeholder="Ej.: 42, M, L…" /></div>
          ))}
          {!tallesCat.length && <div className="muted" style={{ fontSize: 13 }}>No hay tipos de talles configurados todavía (RR.HH. los define en Catálogos).</div>}
        </div>
        {tallesCat.length > 0 && <div className="row" style={{ marginTop: 10, alignItems: 'center', gap: 12 }}><button className="btn" onClick={guardarTalles}>Guardar talles</button>{tmsg && <span className="ok" style={{ fontSize: 13 }}>{tmsg}</span>}</div>}
        {tallesHist.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Histórico de cambios</div>
            {tallesHist.map((h, i) => (
              <div key={i} className="muted" style={{ fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>{new Date(h.created_at).toLocaleString('es-AR')} · {h.cambios}</div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Catálogos</h3>
        {cats.map(docRow)}
        {!cats.length && <div className="muted" style={{ fontSize: 13 }}>No hay catálogos publicados.</div>}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Manuales y documentos de seguridad</h3>
        {mans.map(docRow)}
        {!mans.length && <div className="muted" style={{ fontSize: 13 }}>No hay manuales publicados por el momento.</div>}
      </div>
    </>
  );

  function docRow(m: any) {
    return (
      <div key={m.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
        <div><b>{m.titulo}</b> {m.categoria && <span className="muted">· {m.categoria}</span>}{m.descripcion && <div className="muted" style={{ fontSize: 11 }}>{m.descripcion}</div>}</div>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          {m.filename && <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => ver(m)}>Ver</button>}
          {m.filename && <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => descargar(m)}>Descargar</button>}
          {m.leido
            ? <span className="badge" style={{ color: 'var(--green)', border: '1px solid rgba(34,197,94,.4)' }}>✓ Leído {fmt(m.leido_at)}</span>
            : <button className="btn" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => acusar(m)}>Confirmar lectura</button>}
        </div>
      </div>
    );
  }
}
