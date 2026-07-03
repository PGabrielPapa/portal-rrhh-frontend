import { Fragment, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';
import EmpleadoPicker from '../components/EmpleadoPicker';

interface E { id: number; tipo: string; descripcion?: string; identificador?: string; estado: string; fecha_entrega?: string; fecha_devolucion?: string; nom?: string; leg_num?: string; empresa?: string; data?: { numeroChip?: string; empresaChip?: string }; }
const TIPOS = [['celular', '📱 Celular / Smartphone'], ['notebook', '💻 Notebook / Laptop'], ['tablet', '📟 Tablet'], ['auto', '🚗 Vehículo / Auto'], ['herramienta', '🔧 Herramienta'], ['ropa', '👕 Ropa / EPP'], ['chip', '📶 Chip telefónico'], ['llave', '🔑 Llave / Tarjeta de acceso'], ['otro', '📦 Otro elemento']];
const ESTADOS: Record<string, { l: string; c: string }> = { entregado: { l: 'En uso', c: 'var(--green)' }, devuelto: { l: 'Devuelto', c: 'var(--t3)' }, perdido: { l: 'Extraviado', c: 'var(--red)' }, roto: { l: 'Dado de baja', c: 'var(--yellow)' } };
const tipoLabel = (t: string) => TIPOS.find((x) => x[0] === t)?.[1] || t;
const fmt = (s?: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-AR') : '—';
const hoy = () => new Date().toISOString().slice(0, 10);

export default function Elementos() {
  const [items, setItems] = useState<E[]>([]);
  const [q, setQ] = useState(''); const [empresa, setEmpresa] = useState(''); const [empresas, setEmpresas] = useState<string[]>([]);
  const [emp, setEmp] = useState<Empleado | null>(null);
  const [f, setF] = useState<Record<string, string>>({ tipo: 'celular', fechaEntrega: hoy() });
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [histId, setHistId] = useState<number | null>(null);
  const [hist, setHist] = useState<any[]>([]);
  async function verHist(it: E) { if (histId === it.id) { setHistId(null); return; } try { setHist(await api.get<any[]>(`/elementos/${it.id}/historial`)); setHistId(it.id); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }

  async function load() { try { const p = new URLSearchParams(); if (q) p.set('q', q); if (empresa) p.set('empresa', empresa); setItems(await api.get<E[]>(`/elementos?${p}`)); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { api.get<Empleado[]>('/empleados').then((es) => setEmpresas([...new Set(es.map((e) => e.empresa))].sort())).catch(() => {}); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, empresa]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault(); if (!emp) return;
    try { await api.post('/elementos', { empleadoId: emp.id, tipo: f.tipo, descripcion: f.descripcion, identificador: f.identificador, fechaEntrega: f.fechaEntrega, observaciones: f.observaciones, numeroChip: f.numeroChip, empresaChip: f.empresaChip }); setMsg({ t: 'Elemento registrado', ok: true }); setF({ tipo: 'celular', fechaEntrega: hoy() }); setEmp(null); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function cambiarEstado(it: E, estado: string) { try { await api.patch(`/elementos/${it.id}`, { estado, fechaDevolucion: estado !== 'entregado' ? hoy() : null }); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <form className="card" style={{ marginBottom: 18 }} onSubmit={registrar}>
        <h3 style={{ marginTop: 0 }}>Registrar entrega</h3>
        <div className="field" style={{ marginBottom: 10 }}><label>Empleado *</label><EmpleadoPicker onSelect={setEmp} /></div>
        <div className="grid2" style={{ marginBottom: 10 }}>
          <div className="field"><label>Tipo</label><select className="input" value={f.tipo} onChange={set('tipo')}>{TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="field"><label>Identificador (serie / IMEI / patente)</label><input className="input" value={f.identificador || ''} onChange={set('identificador')} /></div>
          <div className="field"><label>Descripción</label><input className="input" value={f.descripcion || ''} onChange={set('descripcion')} /></div>
          <div className="field"><label>Fecha de entrega</label><input className="input" type="date" value={f.fechaEntrega || ''} onChange={set('fechaEntrega')} /></div>
        </div>
        {f.tipo === 'chip' && (
          <div className="grid2" style={{ marginBottom: 10 }}>
            <div className="field"><label>Número de línea *</label><input className="input" value={f.numeroChip || ''} onChange={set('numeroChip')} placeholder="Ej: 11 5555-5555" /></div>
            <div className="field"><label>Empresa (operadora)</label><input className="input" value={f.empresaChip || ''} onChange={set('empresaChip')} placeholder="Movistar, Claro, Personal…" /></div>
          </div>
        )}
        <div className="field" style={{ marginBottom: 12 }}><label>Observaciones</label><input className="input" value={f.observaciones || ''} onChange={set('observaciones')} /></div>
        {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 8 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
        <button className="btn" disabled={!emp || (f.tipo === 'chip' && !f.numeroChip)}>Registrar</button>
      </form>
      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 240 }} placeholder="Buscar empleado o legajo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 200 }} value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas las empresas</option>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Empleado</th><th>Tipo</th><th>Identificador</th><th>Entrega</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {items.map((it) => (
              <Fragment key={it.id}>
              <tr>
                <td>{it.nom} <span className="muted">({it.leg_num})</span></td><td>{tipoLabel(it.tipo)}</td><td>{it.tipo === 'chip' ? <span>📶 {it.data?.numeroChip || '—'}{it.data?.empresaChip ? ` · ${it.data.empresaChip}` : ''}</span> : (it.identificador || '—')}</td><td>{fmt(it.fecha_entrega)}</td>
                <td><span className="badge" style={{ color: ESTADOS[it.estado]?.c }}>{ESTADOS[it.estado]?.l || it.estado}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 11, marginRight: 4 }} onClick={() => verHist(it)}>Historial</button>
                  {it.estado === 'entregado' && <>
                  <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 11, marginRight: 4 }} onClick={() => cambiarEstado(it, 'devuelto')}>Devuelto</button>
                  <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 11, marginRight: 4 }} onClick={() => cambiarEstado(it, 'perdido')}>Extraviado</button>
                  <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => cambiarEstado(it, 'roto')}>Baja</button>
                  </>}
                </td>
              </tr>
              {histId === it.id && (
                <tr><td colSpan={6} style={{ background: 'var(--bg2)', padding: '8px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Historial del elemento</div>
                  {hist.length === 0 ? <div className="muted" style={{ fontSize: 12 }}>Sin movimientos registrados.</div>
                    : hist.map((h) => (
                      <div key={h.id} className="row" style={{ justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                        <span><b>{h.evento}</b>{h.detalle ? ` · ${h.detalle}` : ''}</span>
                        <span className="muted">{new Date(h.created_at).toLocaleString('es-AR')}{h.created_by ? ` · ${h.created_by}` : ''}</span>
                      </div>))}
                </td></tr>
              )}
              </Fragment>
            ))}
            {!items.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin elementos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
