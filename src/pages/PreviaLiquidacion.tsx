import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const $ = (n: any) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Item = {
  empleado: { id: number; nom: string; legNum: string | number; empresa: string; tipo?: 'jornal' | 'mensual' };
  novedades: { id: number; tipo: string; cantidad: number; monto: number; detalle: string }[];
  licencias: { tipo: string; desde: string; hasta: string; dias: number }[];
  anticipos: { nro: number; cuotas: number; monto: number; motivo: string }[];
  embargos: { embargo: number; cuotaAlimentaria: number; embargoAlimentosPct: number } | null;
  fichadas: { extra50: number; extra100: number; injustificados: number; aRevisar: number } | null;
};

export default function PreviaLiquidacion() {
  const d = new Date();
  const [mes, setMes] = useState(d.getMonth() + 1);
  const [anio, setAnio] = useState(d.getFullYear());
  const [empresa, setEmpresa] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [tipoTrab, setTipoTrab] = useState<'' | 'mensual' | 'jornal'>('');
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const [tipos, setTipos] = useState<{ tipo: string; label: string; unidad: string }[]>([]);
  const [nueva, setNueva] = useState<Record<number, { tipo: string; valor: string; detalle: string }>>({});

  useEffect(() => { api.get<Empleado[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {}); api.get<any[]>('/novedades/_tipos').then(setTipos).catch(() => {}); }, []);

  const esMonto = (t: string) => { const u = (tipos.find((x) => x.tipo === t)?.unidad || '').toLowerCase(); return u.includes('$') || u.includes('peso') || u.includes('monto'); };
  async function addNov(empId: number) {
    const nv = nueva[empId]; if (!nv || !nv.tipo || !nv.valor) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const body: any = { empleadoId: empId, anio, mes, tipo: nv.tipo, detalle: nv.detalle || undefined };
      if (esMonto(nv.tipo)) body.monto = Number(nv.valor); else body.cantidad = Number(nv.valor);
      const r = await api.post<{ aviso?: string }>('/novedades', body);
      setNueva((s) => ({ ...s, [empId]: { tipo: '', valor: '', detalle: '' } }));
      if (r.aviso) setMsg(r.aviso);
      await cargar();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function delNov(id: number) {
    setBusy(true); setErr('');
    try { await api.del(`/novedades/${id}`); await cargar(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const tipoLabel = (t: string) => tipos.find((x) => x.tipo === t)?.label || t;

  async function cargar() {
    setBusy(true); setErr('');
    try {
      const qs = new URLSearchParams({ anio: String(anio), mes: String(mes) });
      if (empresa) qs.set('empresa', empresa);
      const r = await api.get<{ items: Item[] }>(`/liquidacion/previa?${qs.toString()}`);
      setItems(r.items);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  return (
    <>
      <div className="row" style={{ marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>Previa de liquidación</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>Todo lo que va a entrar al recibo del período, por empleado, antes de liquidar. Solo aparecen los que tienen algo cargado.</p>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field"><label>Mes</label><select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
          <div className="field"><label>Año</label><input className="input" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 100 }} /></div>
          <div className="field"><label>Empresa</label><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select></div>
          <div className="field"><label>Tipo</label><select className="input" value={tipoTrab} onChange={(e) => setTipoTrab(e.target.value as any)}><option value="">Todos</option><option value="mensual">Mensualizados</option><option value="jornal">Jornaleros (quincena)</option></select></div>
          <button className="btn" disabled={busy} onClick={cargar}>Actualizar</button>
        </div>
        {err && <div className="err" style={{ marginTop: 10 }}>⚠ {err}</div>}
        {msg && <div className="ok" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr>
            <th>Empleado</th><th>Fichadas</th><th>Novedades</th><th>Licencias</th><th>Adelantos</th><th>Embargos</th>
          </tr></thead>
          <tbody>
            {(() => { const vis = items.filter((it) => !tipoTrab || it.empleado.tipo === tipoTrab); return <>
            {vis.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>{busy ? 'Cargando…' : 'Sin novedades para el período.'}</td></tr>}
            {vis.map((it) => (
              <tr key={it.empleado.id}>
                <td><b>{it.empleado.nom}</b> <span className="badge" style={{ fontSize: 10, color: it.empleado.tipo === 'jornal' ? 'var(--accent2)' : 'var(--muted)' }}>{it.empleado.tipo === 'jornal' ? 'jornal' : 'mensual'}</span><div className="muted" style={{ fontSize: 11 }}>{it.empleado.legNum} · {it.empleado.empresa}</div></td>
                <td style={{ fontSize: 12.5 }}>
                  {it.fichadas ? (<>
                    {it.fichadas.extra50 > 0 && <div>Extra 50%: <b>{it.fichadas.extra50} hs</b></div>}
                    {it.fichadas.extra100 > 0 && <div>Extra 100%: <b>{it.fichadas.extra100} hs</b></div>}
                    {it.fichadas.injustificados > 0 && <div style={{ color: 'var(--red)' }}>Injustificados: <b>{it.fichadas.injustificados}</b></div>}
                    {it.fichadas.aRevisar > 0 && <div style={{ color: 'var(--yellow)' }}>A revisar: <b>{it.fichadas.aRevisar}</b></div>}
                  </>) : <span className="muted">—</span>}
                </td>
                <td style={{ fontSize: 12.5, minWidth: 260 }}>
                  {it.novedades.map((n) => (
                    <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button className="btn ghost" style={{ padding: '0 5px', fontSize: 11 }} onClick={() => delNov(n.id)} title="Quitar">✕</button>
                      <span>{tipoLabel(n.tipo)}{n.cantidad ? ` · ${n.cantidad}` : ''}{n.monto ? ` · $${$(n.monto)}` : ''}{n.detalle ? <span className="muted"> ({n.detalle})</span> : ''}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                    <select className="input" style={{ fontSize: 11, padding: '1px 4px', maxWidth: 128 }} value={(nueva[it.empleado.id]?.tipo) || ''} onChange={(e) => setNueva((s) => ({ ...s, [it.empleado.id]: { ...(s[it.empleado.id] || { valor: '', detalle: '' }), tipo: e.target.value } }))}>
                      <option value="">+ novedad…</option>
                      {tipos.map((t) => <option key={t.tipo} value={t.tipo}>{t.label}</option>)}
                    </select>
                    <input className="input" style={{ fontSize: 11, padding: '1px 4px', width: 62 }} type="number" placeholder={esMonto(nueva[it.empleado.id]?.tipo || '') ? '$' : 'cant.'} value={(nueva[it.empleado.id]?.valor) || ''} onChange={(e) => setNueva((s) => ({ ...s, [it.empleado.id]: { ...(s[it.empleado.id] || { tipo: '', detalle: '' }), valor: e.target.value } }))} />
                    <button className="btn" style={{ padding: '1px 8px', fontSize: 11 }} disabled={busy || !(nueva[it.empleado.id]?.tipo && nueva[it.empleado.id]?.valor)} onClick={() => addNov(it.empleado.id)}>✚</button>
                  </div>
                </td>
                <td style={{ fontSize: 12.5 }}>
                  {it.licencias.length ? it.licencias.map((l, i) => (
                    <div key={i}>{l.tipo} · <span className="muted">{l.desde}→{l.hasta} ({l.dias}d)</span></div>
                  )) : <span className="muted">—</span>}
                </td>
                <td style={{ fontSize: 12.5 }}>
                  {it.anticipos.length ? it.anticipos.map((a, i) => (
                    <div key={i}>Cuota {a.nro}/{a.cuotas}: <b>${$(a.monto)}</b>{a.motivo ? <span className="muted"> ({a.motivo})</span> : ''}</div>
                  )) : <span className="muted">—</span>}
                </td>
                <td style={{ fontSize: 12.5 }}>
                  {it.embargos ? (<>
                    {it.embargos.embargo > 0 && <div>Embargo: <b>${$(it.embargos.embargo)}</b></div>}
                    {it.embargos.cuotaAlimentaria > 0 && <div>Cuota alim.: <b>${$(it.embargos.cuotaAlimentaria)}</b></div>}
                    {it.embargos.embargoAlimentosPct > 0 && <div>Alim. <b>{it.embargos.embargoAlimentosPct}%</b></div>}
                  </>) : <span className="muted">—</span>}
                </td>
              </tr>
            ))}
            </>; })()}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Las novedades variables se cargan en “Novedades variables”; las licencias en “Licencias (gestión)”; adelantos y embargos en sus paneles. Esta vista solo los junta para revisar.</p>
    </>
  );
}
