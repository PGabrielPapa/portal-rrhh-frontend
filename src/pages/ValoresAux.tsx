import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Valores auxiliares del motor de fórmulas (Tango): macros, matrices por tramos y tablas.
interface Aux { id: number; tipo: string; clave: string; etiqueta: string; data: any; activo: boolean; }
const TIPOS: [string, string][] = [['macro', 'Macro (fórmula reutilizable)'], ['matriz', 'Matriz por tramos'], ['tabla', 'Tabla clave→valor']];

export default function ValoresAux() {
  const [items, setItems] = useState<Aux[]>([]);
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState<any>(null);

  async function load() { try { setItems(await api.get<Aux[]>('/valores-aux')); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { load(); }, []);

  function nuevo(tipo: string) { setErr(''); setMsg('');
    setEdit(tipo === 'macro' ? { tipo, etiqueta: '', formula: '' }
      : tipo === 'matriz' ? { tipo, etiqueta: '', tramos: [{ hasta: '', valor: '' }] }
      : { tipo, etiqueta: '', pares: [{ clave: '', valor: '' }] });
  }
  function editar(a: Aux) { setErr(''); setMsg('');
    if (a.tipo === 'macro') setEdit({ id: a.id, tipo: 'macro', etiqueta: a.etiqueta, clave: a.clave, formula: a.data?.formula || '' });
    else if (a.tipo === 'matriz') setEdit({ id: a.id, tipo: 'matriz', etiqueta: a.etiqueta, clave: a.clave, tramos: (a.data?.tramos || []).map((t: any) => ({ hasta: String(t.hasta), valor: String(t.valor) })) });
    else setEdit({ id: a.id, tipo: 'tabla', etiqueta: a.etiqueta, clave: a.clave, pares: (a.data?.pares || []).map((p: any) => ({ clave: String(p.clave), valor: String(p.valor) })) });
  }
  async function guardar() {
    setErr('');
    let data: any = {};
    if (edit.tipo === 'macro') data = { formula: edit.formula };
    else if (edit.tipo === 'matriz') data = { tramos: edit.tramos.filter((t: any) => t.hasta !== '' && t.valor !== '').map((t: any) => ({ hasta: Number(t.hasta), valor: Number(t.valor) })) };
    else data = { pares: edit.pares.filter((p: any) => String(p.clave).trim() && p.valor !== '').map((p: any) => ({ clave: String(p.clave).trim(), valor: Number(p.valor) })) };
    const body: any = { tipo: edit.tipo, etiqueta: edit.etiqueta, data, activo: true };
    if (!edit.id) body.clave = edit.etiqueta;
    try {
      if (edit.id) await api.put(`/valores-aux/${edit.id}`, body); else await api.post('/valores-aux', body);
      setEdit(null); setMsg('Guardado.'); load();
    } catch (e: any) { setErr(e.message); }
  }
  async function borrar(a: Aux) { if (!window.confirm(`¿Eliminar "${a.etiqueta}"?`)) return; try { await api.del(`/valores-aux/${a.id}`); load(); } catch (e: any) { setErr(e.message); } }

  const setFila = (arr: string, i: number, k: string, v: string) => setEdit((e: any) => { const c = [...e[arr]]; c[i] = { ...c[i], [k]: v }; return { ...e, [arr]: c }; });
  const addFila = (arr: string, tpl: any) => setEdit((e: any) => ({ ...e, [arr]: [...e[arr], tpl] }));

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}
      <p className="muted" style={{ marginTop: 0 }}>Se usan desde las fórmulas de conceptos: la <strong>macro</strong> por su nombre (ej. <code>baseCalc</code>), la <strong>matriz</strong> con <code>TRAMO("clave", x)</code> y la <strong>tabla</strong> con <code>TABLA("clave", "k")</code>.</p>
      <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {TIPOS.map(([v, l]) => <button key={v} className="btn ghost" onClick={() => nuevo(v)}>+ {l}</button>)}
      </div>

      {edit && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>{edit.id ? 'Editar' : 'Nuevo'} · {TIPOS.find(([v]) => v === edit.tipo)?.[1]}</h3>
          <div className="field" style={{ marginBottom: 10 }}><label>Nombre / etiqueta *</label><input className="input" value={edit.etiqueta} onChange={(e) => setEdit({ ...edit, etiqueta: e.target.value })} placeholder={edit.tipo === 'macro' ? 'Ej: baseCalc' : edit.tipo === 'matriz' ? 'Ej: plusAntig' : 'Ej: premios'} />{edit.clave && <span className="muted" style={{ fontSize: 12 }}> · clave: <code>{edit.clave}</code></span>}</div>
          {edit.tipo === 'macro' && <div className="field"><label>Fórmula</label><input className="input" value={edit.formula} onChange={(e) => setEdit({ ...edit, formula: e.target.value })} placeholder="Ej: basico + antiguedad_monto" /></div>}
          {edit.tipo === 'matriz' && (<div>
            <label className="muted" style={{ fontSize: 12 }}>Tramos (se usa el primer tramo cuyo "hasta" ≥ el valor consultado)</label>
            {edit.tramos.map((t: any, i: number) => <div key={i} className="row" style={{ gap: 8, marginTop: 6 }}>
              <input className="input" style={{ width: 140 }} type="number" placeholder="hasta" value={t.hasta} onChange={(e) => setFila('tramos', i, 'hasta', e.target.value)} />
              <input className="input" style={{ width: 160 }} type="number" placeholder="valor" value={t.valor} onChange={(e) => setFila('tramos', i, 'valor', e.target.value)} />
            </div>)}
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => addFila('tramos', { hasta: '', valor: '' })}>+ Tramo</button>
          </div>)}
          {edit.tipo === 'tabla' && (<div>
            <label className="muted" style={{ fontSize: 12 }}>Pares clave → valor</label>
            {edit.pares.map((p: any, i: number) => <div key={i} className="row" style={{ gap: 8, marginTop: 6 }}>
              <input className="input" style={{ width: 160 }} placeholder="clave" value={p.clave} onChange={(e) => setFila('pares', i, 'clave', e.target.value)} />
              <input className="input" style={{ width: 160 }} type="number" placeholder="valor" value={p.valor} onChange={(e) => setFila('pares', i, 'valor', e.target.value)} />
            </div>)}
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => addFila('pares', { clave: '', valor: '' })}>+ Fila</button>
          </div>)}
          <div style={{ marginTop: 12 }}><button className="btn primary" onClick={guardar} disabled={!edit.etiqueta.trim()}>Guardar</button> <button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th>Tipo</th><th>Clave</th><th>Etiqueta</th><th>Contenido</th><th></th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td><span className="badge">{TIPOS.find(([v]) => v === a.tipo)?.[1] || a.tipo}</span></td>
                <td style={{ fontFamily: 'monospace' }}>{a.clave}</td>
                <td>{a.etiqueta}</td>
                <td className="muted" style={{ fontSize: 12 }}>{a.tipo === 'macro' ? a.data?.formula : a.tipo === 'matriz' ? `${(a.data?.tramos || []).length} tramo(s)` : `${(a.data?.pares || []).length} fila(s)`}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => editar(a)}>Editar</button>
                  <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => borrar(a)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>Todavía no definiste valores auxiliares.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
