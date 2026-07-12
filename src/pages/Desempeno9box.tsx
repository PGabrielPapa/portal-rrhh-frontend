import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';
import EmpleadoPicker from '../components/EmpleadoPicker';

// Desempeño / 9-box (estilo Meta4): objetivos, competencias y matriz potencial vs. desempeño.
const NIV = [['', '—'], ['1', 'Bajo'], ['2', 'Medio'], ['3', 'Alto']];
const potLbl = ['', 'Bajo', 'Medio', 'Alto'];

export default function Desempeno9box() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [sel, setSel] = useState<Empleado | null>(null);
  const [f, setF] = useState<any>({ objetivos: [], competencias: [], desempeno: '', potencial: '', nota: '' });
  const [box, setBox] = useState<any>({ celdas: {} });
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');

  async function loadBox() { try { setBox(await api.get<any>(`/desempeno/9box?anio=${anio}`)); } catch (e: any) { setErr(e.message); } }
  useEffect(() => { loadBox(); /* eslint-disable-next-line */ }, [anio]);

  async function abrir(e: Empleado | null) {
    setSel(e); setMsg(''); setErr(''); if (!e) return;
    try { const d = await api.get<any>(`/desempeno/${e.id}?anio=${anio}`); setF({ objetivos: d.objetivos || [], competencias: d.competencias || [], desempeno: d.desempeno ?? '', potencial: d.potencial ?? '', nota: d.nota || '' }); }
    catch (er: any) { setErr(er.message); }
  }
  async function guardar() {
    if (!sel) return; setErr(''); setMsg('');
    try { await api.put(`/desempeno/${sel.id}`, { ...f, anio }); setMsg('Ficha guardada.'); loadBox(); }
    catch (e: any) { setErr(e.message); }
  }
  const addObj = () => setF({ ...f, objetivos: [...f.objetivos, { texto: '', peso: '', logro: '' }] });
  const setObj = (i: number, k: string, v: string) => setF({ ...f, objetivos: f.objetivos.map((o: any, j: number) => j === i ? { ...o, [k]: v } : o) });
  const addComp = () => setF({ ...f, competencias: [...f.competencias, { nombre: '', nivel: '' }] });
  const setComp = (i: number, k: string, v: string) => setF({ ...f, competencias: f.competencias.map((c: any, j: number) => j === i ? { ...c, [k]: v } : c) });

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}
      <div className="row" style={{ marginBottom: 12, gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field"><label>Año</label><input className="input" type="number" style={{ width: 100 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></div>
        <div className="field" style={{ minWidth: 260 }}><label>Empleado</label><EmpleadoPicker onSelect={abrir} /></div>
      </div>

      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {sel && (
          <div className="card" style={{ flex: '1 1 380px', minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>{sel.nom} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· {anio}</span></h3>
            <div className="grid2" style={{ marginBottom: 10 }}>
              <div className="field"><label>Desempeño</label><select className="input" value={f.desempeno} onChange={(e) => setF({ ...f, desempeno: e.target.value })}>{NIV.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div className="field"><label>Potencial</label><select className="input" value={f.potencial} onChange={(e) => setF({ ...f, potencial: e.target.value })}>{NIV.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            </div>
            <div className="field"><label>Objetivos</label>
              {f.objetivos.map((o: any, i: number) => (
                <div key={i} className="row" style={{ gap: 6, marginBottom: 4 }}>
                  <input className="input" style={{ flex: 1 }} placeholder="Objetivo" value={o.texto} onChange={(e) => setObj(i, 'texto', e.target.value)} />
                  <input className="input" style={{ width: 70 }} type="number" placeholder="peso%" value={o.peso} onChange={(e) => setObj(i, 'peso', e.target.value)} />
                  <input className="input" style={{ width: 70 }} type="number" placeholder="logro%" value={o.logro} onChange={(e) => setObj(i, 'logro', e.target.value)} />
                </div>
              ))}
              <button className="btn ghost" style={{ fontSize: 12 }} onClick={addObj}>+ Objetivo</button>
            </div>
            <div className="field" style={{ marginTop: 8 }}><label>Competencias</label>
              {f.competencias.map((c: any, i: number) => (
                <div key={i} className="row" style={{ gap: 6, marginBottom: 4 }}>
                  <input className="input" style={{ flex: 1 }} placeholder="Competencia" value={c.nombre} onChange={(e) => setComp(i, 'nombre', e.target.value)} />
                  <select className="input" style={{ width: 110 }} value={c.nivel} onChange={(e) => setComp(i, 'nivel', e.target.value)}>{['', '1', '2', '3', '4', '5'].map((n) => <option key={n} value={n}>{n === '' ? 'nivel' : n}</option>)}</select>
                </div>
              ))}
              <button className="btn ghost" style={{ fontSize: 12 }} onClick={addComp}>+ Competencia</button>
            </div>
            <div className="field" style={{ marginTop: 8 }}><label>Nota</label><textarea className="input" rows={2} value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} /></div>
            <button className="btn primary" onClick={guardar}>Guardar ficha</button>
          </div>
        )}

        <div className="card" style={{ flex: '1 1 380px', minWidth: 320 }}>
          <h3 style={{ marginTop: 0 }}>Matriz 9-box <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· {anio}</span></h3>
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr', gap: 4, fontSize: 12 }}>
            <div />{[1, 2, 3].map((d) => <div key={d} style={{ textAlign: 'center', fontWeight: 600 }}>Desemp. {potLbl[d]}</div>)}
            {[3, 2, 1].map((pot) => (
              <>
                <div key={`l${pot}`} style={{ fontWeight: 600, alignSelf: 'center' }}>Pot. {potLbl[pot]}</div>
                {[1, 2, 3].map((des) => {
                  const cel = (box.celdas || {})[`${pot}-${des}`] || [];
                  const destaca = pot >= 2 && des >= 2;
                  return (
                    <div key={`${pot}-${des}`} style={{ minHeight: 64, border: '1px solid var(--border)', borderRadius: 6, padding: 4, background: destaca ? 'rgba(34,197,94,.07)' : 'var(--bg2)' }}>
                      {cel.map((x: any) => <div key={x.empleadoId} style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={x.nom}>{x.nom}</div>)}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Verde: alto desempeño y alto potencial (talento clave).</p>
        </div>
      </div>
    </>
  );
}
