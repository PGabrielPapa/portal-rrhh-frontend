import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';
import ReciboView, { Recibo } from '../components/ReciboView';
import { imprimirRecibo, imprimirVarios } from '../lib/reciboPrint';
import { useAuth } from '../lib/auth';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const money = (n: number) => Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

interface Item { id: number; anio: number; mes: number; tipo: string; neto: number; created_at: string; created_by?: string; nom: string; leg_num: string; empresa: string; }

export default function RecibosGestion() {
  const { user } = useAuth();
  const esAdmin = user?.role === 'admin';
  const [cierres, setCierres] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [empresa, setEmpresa] = useState('');
  const [mes, setMes] = useState(0);
  const [anio, setAnio] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Recibo | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [vistas, setVistas] = useState<{ created_at: string; nom: string; leg_num: string }[] | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [tipo, setTipo] = useState('');
  const [openEmp, setOpenEmp] = useState<Record<string, boolean>>({});
  const [openLeg, setOpenLeg] = useState<Record<string, boolean>>({});
  const [imp, setImp] = useState(false);
  const TIPOS: [string, string][] = [['mensual','Mensual'],['quincenal_1','Quincena 1ª'],['quincenal_2','Quincena 2ª'],['sac1','SAC 1° sem.'],['sac2','SAC 2° sem.'],['vacaciones','Vacaciones'],['anticipo','Anticipo'],['complementaria','Ajuste de sueldo'],['anticipo_ajuste','Anticipo ajuste'],['final','Liquidación final']];
  const tipoLbl = (t: string) => (TIPOS.find(([v]) => v === t)?.[1]) || t;

  async function load() {
    setErr('');
    try {
      const p = new URLSearchParams();
      if (empresa) p.set('empresa', empresa);
      if (mes) p.set('mes', String(mes));
      if (anio) p.set('anio', anio);
      if (q) p.set('q', q);
      setItems(await api.get<Item[]>(`/recibos/gestion?${p.toString()}`));
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => {
    api.get<Empleado[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {});
    api.get<any[]>('/cierres').then(setCierres).catch(() => {});
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [empresa, mes, anio, q]);

  async function ver(it: Item) {
    setErr('');
    setVistas(null); setSelId(it.id);
    try { setSel(await api.get<Recibo>(`/recibos/${it.id}`)); } catch (e: any) { setErr(e.message); }
  }

  async function verVistas() { if (!selId) return; try { setVistas(await api.get(`/recibos/${selId}/vistas`)); } catch (e: any) { setErr(e.message); } }
  async function imprimirLista(lista: Item[]) {
    if (!lista.length) return;
    setImp(true); setErr('');
    try { const recs = await Promise.all(lista.map((it) => api.get<Recibo>(`/recibos/${it.id}`))); imprimirVarios(recs); }
    catch (e: any) { setErr(e.message); } finally { setImp(false); }
  }
  function exportarCsv() {
    const vis = tipo ? items.filter((i) => i.tipo === tipo) : items;
    if (!vis.length) return;
    const head = 'Empresa,Legajo,Empleado,Periodo,Tipo,Neto,Liquidado por';
    const filas = vis.map((it) => `"${it.empresa}",${it.leg_num},"${it.nom}",${MESES[it.mes - 1]} ${it.anio},${tipoLbl(it.tipo)},${it.neto},${it.created_by || ''}`);
    const blob = new Blob(['\ufeff' + [head, ...filas].join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `recibos${anio ? '_' + anio : ''}${mes ? '_' + String(mes).padStart(2, '0') : ''}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const estaCerrado = (em: string) => !!(mes && anio) && cierres.some((c) => c.empresa === em && c.anio === Number(anio) && c.mes === mes);
  async function cerrarPeriodo(em: string) {
    if (!mes || !anio) { setErr('Elegí Mes y Año para cerrar.'); return; }
    if (!window.confirm(`¿Cerrar ${MESES[mes - 1]} ${anio} de ${em}? No se podrá borrar ni re-liquidar hasta reabrirlo.`)) return;
    setErr(''); setOk('');
    try { await api.post('/cierres', { empresa: em, anio: Number(anio), mes }); setOk(`Período cerrado para ${em}.`); api.get<any[]>('/cierres').then(setCierres); } catch (e: any) { setErr(e.message); }
  }
  async function reabrirPeriodo(em: string) {
    if (!window.confirm(`¿Reabrir ${MESES[mes - 1]} ${anio} de ${em}?`)) return;
    setErr(''); setOk('');
    try { await api.del(`/cierres?empresa=${encodeURIComponent(em)}&anio=${Number(anio)}&mes=${mes}`); setOk(`Período reabierto para ${em}.`); api.get<any[]>('/cierres').then(setCierres); } catch (e: any) { setErr(e.message); }
  }
  async function eliminar(it: Item) {
    if (!window.confirm(`¿Eliminar el recibo de ${it.nom} — ${MESES[it.mes - 1]} ${it.anio} · ${tipoLbl(it.tipo)}? Sirve para re-liquidar.`)) return;
    setErr(''); setOk('');
    try { await api.del(`/recibos/${it.id}`); if (selId === it.id) { setSel(null); setSelId(null); } setOk('Recibo eliminado.'); load(); } catch (e: any) { setErr(e.message); }
  }
  async function borrarPeriodo(empName?: string) {
    if (!mes || !anio) { setErr('Elegí Mes y Año para borrar un período.'); return; }
    const alc = `${MESES[mes - 1]} ${anio}${tipo ? ' · ' + tipoLbl(tipo) : ''}${empName ? ' · ' + empName : (empresa ? ' · ' + empresa : ' · todas las empresas')}`;
    if (!window.confirm(`¿Eliminar TODOS los recibos de ${alc}? Sirve para re-liquidar.`)) return;
    setErr(''); setOk('');
    try {
      const r = await api.post<{ eliminados: number }>('/recibos/eliminar-lote', { anio: Number(anio), mes, empresa: empName || empresa || undefined, tipo: tipo || undefined });
      setOk(`${r.eliminados} recibo(s) eliminados — ${alc}.`); load();
    } catch (e: any) { setErr(e.message); }
  }
  if (sel) return (
    <>
      <div className="row" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <button className="btn ghost" onClick={() => { setSel(null); setSelId(null); }}>← Volver a la lista</button>
        <button className="btn" onClick={() => imprimirRecibo(sel)}>🖨 Imprimir / PDF</button>
        <button className="btn ghost" onClick={verVistas}>👁 Ver visualizaciones del empleado</button>
      </div>
      {vistas && (
        <div className="card" style={{ marginBottom: 12 }}>
          <strong>Visualizaciones del empleado</strong>
          {!vistas.length && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>El empleado todavía no visualizó este recibo.</div>}
          {vistas.length > 0 && <table style={{ marginTop: 6, fontSize: 13 }}><tbody>{vistas.map((v, i) => <tr key={i}><td>{v.nom} <span className="muted">({v.leg_num})</span></td><td className="muted">{new Date(v.created_at).toLocaleString('es-AR')}</td></tr>)}</tbody></table>}
        </div>
      )}
      <div className="card"><ReciboView recibo={sel} /></div>
    </>
  );

  return (
    <>
      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 240 }} placeholder="Buscar empleado o legajo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 200 }} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="">Todas las empresas</option>
          {empresas.map((em) => <option key={em} value={em}>{em}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 150 }} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          <option value={0}>Todos los meses</option>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <input className="input" style={{ maxWidth: 110 }} type="number" placeholder="Año" value={anio} onChange={(e) => setAnio(e.target.value)} />
        <select className="input" style={{ maxWidth: 180 }} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {err && <div className="err" style={{ marginBottom: 10 }}>⚠ {err}</div>}
      {ok && <div className="ok" style={{ marginBottom: 10 }}>✓ {ok}</div>}
      {!!(mes && anio) && <button className="btn ghost" style={{ marginBottom: 10, color: 'var(--red)' }} onClick={() => borrarPeriodo()}>🗑 Borrar período {MESES[mes - 1]} {anio}{tipo ? ' · ' + tipoLbl(tipo) : ''}{empresa ? ' · ' + empresa : ' (todas las empresas)'}</button>}
      <button className="btn ghost" style={{ marginBottom: 10, marginLeft: 8 }} onClick={exportarCsv}>⬇ Exportar CSV</button>

      {(() => {
        const vis = tipo ? items.filter((it) => it.tipo === tipo) : items;
        if (!vis.length) return <div className="card"><div className="muted" style={{ textAlign: 'center', padding: 20 }}>No hay recibos con esos filtros.</div></div>;
        const emps = [...new Set(vis.map((i) => i.empresa))].sort((a, b) => a.localeCompare(b));
        const SEP = '|#|';
        return emps.map((em) => {
          const delEmp = vis.filter((i) => i.empresa === em);
          const legs = [...new Set(delEmp.map((i) => i.leg_num + SEP + i.nom))].sort((a, b) => a.split(SEP)[1].localeCompare(b.split(SEP)[1]));
          const empOpen = openEmp[em] !== false;
          const netoEmp = delEmp.reduce((acc, i) => acc + Number(i.neto || 0), 0);
          const cerrado = estaCerrado(em);
          return (
            <div className="card" key={em} style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: 'var(--bg3)' }} onClick={() => setOpenEmp((st) => ({ ...st, [em]: !empOpen }))}>
                <strong style={{ color: 'var(--accent2)' }}>{empOpen ? '▾ ' : '▸ '}{em} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({delEmp.length} recibos · {legs.length} empleados · neto {money(netoEmp)})</span></strong>
                <span className="row" style={{ gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                  {cerrado && <span className="badge" style={{ color: 'var(--yellow)' }}>🔒 Cerrado</span>}
                  <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} disabled={imp} onClick={() => imprimirLista(delEmp)}>🖨 {imp ? 'Generando…' : 'Imprimir'}</button>
                  {!!(mes && anio) && !cerrado && <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12, color: 'var(--red)' }} onClick={() => borrarPeriodo(em)}>🗑 Borrar {MESES[mes - 1]} {anio}{tipo ? ' · ' + tipoLbl(tipo) : ''}</button>}
                  {esAdmin && !!(mes && anio) && (cerrado
                    ? <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => reabrirPeriodo(em)}>🔓 Reabrir</button>
                    : <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => cerrarPeriodo(em)}>🔒 Cerrar período</button>)}
                </span>
              </div>
              {empOpen && (
                <div style={{ padding: '2px 8px 8px' }}>
                  {legs.map((key) => {
                    const leg = key.split(SEP)[0], nom = key.split(SEP)[1];
                    const recs = delEmp.filter((i) => i.leg_num === leg && i.nom === nom).sort((a, b) => b.anio - a.anio || b.mes - a.mes || a.tipo.localeCompare(b.tipo));
                    const lkey = em + SEP + key;
                    const legOpen = !!openLeg[lkey];
                    return (
                      <div key={key} style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', cursor: 'pointer' }} onClick={() => setOpenLeg((st) => ({ ...st, [lkey]: !legOpen }))}>
                          <span style={{ fontSize: 13 }}>{legOpen ? '▾ ' : '▸ '}{nom} <span className="muted">({leg})</span></span>
                          <span className="muted" style={{ fontSize: 12 }}>{recs.length} recibo(s)</span>
                        </div>
                        {legOpen && (
                          <table style={{ width: '100%', fontSize: 13, marginBottom: 6 }}>
                            <tbody>
                              {recs.map((it) => (
                                <tr key={it.id}>
                                  <td style={{ paddingLeft: 26 }}>{MESES[it.mes - 1]} {it.anio} <span className="muted">· {tipoLbl(it.tipo)}</span></td>
                                  <td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{money(it.neto)}</td>
                                  <td className="muted" style={{ textAlign: 'right', fontSize: 12 }}>{it.created_by || '—'}</td>
                                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12, marginRight: 6 }} onClick={() => ver(it)}>Ver</button>
                                    <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12, color: 'var(--red)' }} onClick={() => eliminar(it)}>✕</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        });
      })()}
      <p className="muted" style={{ marginTop: 10 }}>{(tipo ? items.filter((i) => i.tipo === tipo) : items).length} recibo(s) · neto total {money((tipo ? items.filter((i) => i.tipo === tipo) : items).reduce((acc, i) => acc + Number(i.neto || 0), 0))}</p>
    </>
  );
}
