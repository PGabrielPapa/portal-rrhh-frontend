import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Concepto { id: number; codigo: string; descripcion: string; tipo: string; formula?: string; base_legal?: string; activo: boolean; data?: any; }
const FLAGS: [string, string][] = [['rem', 'Remunerativo'], ['incideSac', 'Incide SAC'], ['incidePresentismo', 'Incide presentismo'], ['incideAntiguedad', 'Incide antigüedad'], ['remAsignada', 'Rem. asignada'], ['saleRecibo', 'Sale en recibo'], ['libroLey', 'Libro ley'], ['f931', 'F.931'], ['boletaSindical', 'Boleta sindical']];

const TIPOS = [
  { v: 'remunerativo', l: 'Remunerativo' },
  { v: 'no_remunerativo', l: 'No remunerativo' },
  { v: 'descuento', l: 'Descuento' },
  { v: 'aporte', l: 'Aporte' },
  { v: 'contribucion', l: 'Contribución' },
];
const tipoLabel = (t: string) => TIPOS.find((x) => x.v === t)?.l || t;

export default function Conceptos() {
  const { user } = useAuth();
  const canEdit = user?.role === 'rrhh' || user?.role === 'admin';
  const [items, setItems] = useState<Concepto[]>([]);
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState<Concepto | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [exp, setExp] = useState<Record<number, boolean>>({});

  async function load() {
    try {
      const p = new URLSearchParams();
      if (q) p.set('q', q); if (tipo) p.set('tipo', tipo);
      setItems(await api.get<Concepto[]>(`/conceptos?${p.toString()}`));
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, tipo]);

  async function toggle(c: Concepto) { try { await api.patch(`/conceptos/${c.id}/activo`, { activo: !c.activo }); load(); } catch (e: any) { setErr(e.message); } }

  return (
    <>
      <div className="row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }} />
        {canEdit && <button className="btn" onClick={() => setShowNew(true)}>+ Nuevo concepto</button>}
      </div>
      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Buscar código o descripción…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 200 }} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </div>
      {err && <div className="err" style={{ marginBottom: 10 }}>⚠ {err}</div>}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Código</th><th>Descripción</th><th>Tipo</th><th>Sindicato</th><th>Base legal</th><th>Estado</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {items.map((c) => {
              const d = c.data || {};
              const tieneFlags = !!(d.sindicato || 'rem' in d);
              const abierto = !!exp[c.id];
              return [
                <tr key={c.id}>
                  <td style={{ fontFamily: 'monospace', cursor: tieneFlags ? 'pointer' : undefined }} onClick={() => tieneFlags && setExp((s) => ({ ...s, [c.id]: !abierto }))}>{tieneFlags ? (abierto ? '▾ ' : '▸ ') : ''}{c.codigo}</td>
                  <td>{c.descripcion}</td>
                  <td><span className="badge">{tipoLabel(c.tipo)}</span></td>
                  <td className="muted" style={{ fontSize: 12 }}>{d.sindicato ? `${d.sindicato}${d.cct ? ' · ' + d.cct : ''}` : '—'}</td>
                  <td className="muted">{c.base_legal || '—'}</td>
                  <td><span className="badge" style={{ color: c.activo ? 'var(--green)' : 'var(--t3)' }}>{c.activo ? 'Activo' : 'Inactivo'}</span></td>
                  {canEdit && <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => setEdit(c)}>Editar</button>
                    <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggle(c)}>{c.activo ? 'Desactivar' : 'Activar'}</button>
                  </td>}
                </tr>,
                abierto && tieneFlags && (
                  <tr key={`d${c.id}`}><td colSpan={canEdit ? 7 : 6} style={{ background: 'var(--bg2)', padding: '8px 14px' }}>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{FLAGS.map(([k, l]) => <span key={k} className="badge" style={{ color: d[k] ? 'var(--green)' : 'var(--t3)' }}>{d[k] ? '✓' : '✗'} {l}</span>)}</div>
                    {d.base && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Base de cálculo: {d.base}{d.valor ? ` · valor de referencia $${d.valor}` : ''}{d.nivelTitulo ? ` · nivel de título: ${d.nivelTitulo}` : ''}</div>}
                    {d.confirmar && <div style={{ fontSize: 12, marginTop: 4, color: 'var(--yellow)' }}>⚠ Importe/criterio a confirmar con el CCT vigente.</div>}
                  </td></tr>
                ),
              ].filter(Boolean);
            })}
            {!items.length && <tr><td colSpan={canEdit ? 7 : 6} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin conceptos.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>{items.length} concepto(s)</p>

      {(showNew || edit) && <ConceptoModal concepto={edit} onClose={() => { setShowNew(false); setEdit(null); }} onSaved={() => { setShowNew(false); setEdit(null); load(); }} onError={setErr} />}
    </>
  );
}

function ConceptoModal({ concepto, onClose, onSaved, onError }: { concepto: Concepto | null; onClose: () => void; onSaved: () => void; onError: (t: string) => void; }) {
  const [f, setF] = useState<any>(concepto || { tipo: 'remunerativo' });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const setD = (k: string) => (e: any) => setF({ ...f, data: { ...(f.data || {}), [k]: e.target.value } });
  const [vars, setVars] = useState<{ variables: { clave: string; desc: string }[]; funciones: string[] } | null>(null);
  const [ayuda, setAyuda] = useState(false);
  const [prueba, setPrueba] = useState<any>(null);
  const BASES: [string, string][] = [['rem', 'Remunerativo (con aportes)'], ['norem', 'No remunerativo'], ['exento', 'Exento de Ganancias'], ['descuento', 'Descuento']];
  useEffect(() => { api.get<any>('/conceptos/variables').then(setVars).catch(() => {}); }, []);
  async function probar() {
    setPrueba(null);
    try { const r = await api.post<any>('/conceptos/probar-formula', { formula: f.formula, condicion: (f.data || {}).condicion }); setPrueba(r); }
    catch (e: any) { setPrueba({ ok: false, error: e.message }); }
  }

  async function save() {
    setBusy(true);
    try {
      const payload = { ...f };
      if (f.formula && String(f.formula).trim()) payload.data = { ...(f.data || {}), esFormula: true, base: (f.data || {}).base || (f.tipo === 'descuento' ? 'descuento' : f.tipo === 'no_remunerativo' ? 'norem' : 'rem') };
      if (concepto) await api.put(`/conceptos/${concepto.id}`, payload);
      else await api.post('/conceptos', payload);
      onSaved();
    } catch (e: any) { onError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{concepto ? 'Editar concepto' : 'Nuevo concepto'}</h3>
        <div className="grid2">
          <div className="field"><label>Código *</label><input className="input" value={f.codigo || ''} onChange={set('codigo')} disabled={!!concepto} /></div>
          <div className="field"><label>Tipo</label>
            <select className="input" value={f.tipo} onChange={set('tipo')}>{TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
          </div>
        </div>
        <div className="field" style={{ margin: '10px 0' }}><label>Descripción *</label><input className="input" value={f.descripcion || ''} onChange={set('descripcion')} /></div>
        <div className="field" style={{ marginBottom: 10 }}><label>Base legal</label><input className="input" value={f.base_legal || ''} onChange={set('base_legal')} /></div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Fórmula (opcional) — se suma como concepto calculado</label>
          <input className="input" value={f.formula || ''} onChange={set('formula')} placeholder="Ej: SI(ausencias == 0, basico * 0.10, 0)" />
        </div>
        {f.formula && (
          <div className="grid2" style={{ marginTop: 10 }}>
            <div className="field"><label>Base del concepto</label>
              <select className="input" value={(f.data || {}).base || (f.tipo === 'descuento' ? 'descuento' : f.tipo === 'no_remunerativo' ? 'norem' : 'rem')} onChange={setD('base')}>{BASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
            <div className="field"><label>Condición (opcional) — si da 0, no aplica</label><input className="input" value={(f.data || {}).condicion || ''} onChange={setD('condicion')} placeholder="Ej: anios >= 1" /></div>
          </div>
        )}
        {f.formula && (
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn ghost" onClick={probar}>Probar con datos de ejemplo</button>
            <button type="button" className="btn ghost" style={{ marginLeft: 8 }} onClick={() => setAyuda((v) => !v)}>{ayuda ? 'Ocultar ayuda' : 'Ver variables y funciones'}</button>
            {prueba && (prueba.ok
              ? <div className="card" style={{ marginTop: 8, borderColor: 'var(--green)' }}>
                  <div>Resultado con datos de ejemplo: <strong>$ {Number(prueba.valor).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>{!prueba.aplica && <span className="muted"> · la condición da 0 → no aplica</span>}</div>
                  {prueba.fueraCatalogo?.length > 0 && <div style={{ color: 'var(--yellow)', fontSize: 12, marginTop: 4 }}>⚠ Variables no reconocidas (¿error de tipeo?): {prueba.fueraCatalogo.join(', ')}</div>}
                </div>
              : <div className="err" style={{ marginTop: 8 }}>⚠ {prueba.error}</div>)}
            {ayuda && vars && (
              <div className="card" style={{ marginTop: 8, fontSize: 12 }}>
                <div style={{ marginBottom: 6 }}><strong>Funciones:</strong> {vars.funciones.join(', ')}</div>
                <div><strong>Variables:</strong></div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {vars.variables.map((v) => <span key={v.clave} className="badge" title={v.desc} style={{ fontFamily: 'monospace' }}>{v.clave}</span>)}
                  <span className="badge" title="Cualquier campo adicional del legajo" style={{ fontFamily: 'monospace' }}>cx_…</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy || !f.codigo || !f.descripcion}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
