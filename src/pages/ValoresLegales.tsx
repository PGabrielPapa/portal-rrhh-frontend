import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface VL {
  id: number; vigenciaDesde: string; topeSipaMax: number; topeSipaMin: number; smvm: number;
  scvoPercapita: number; scvoSumaAsegurada: number; ffep: number; fuente?: string; nota?: string; updatedAt?: string;
}
const $ = (n: number) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };
const hoyISO = () => new Date().toISOString().slice(0, 10);
const vacio = (): VL => ({ id: 0, vigenciaDesde: hoyISO().slice(0, 8) + '01', topeSipaMax: 0, topeSipaMin: 0, smvm: 0, scvoPercapita: 0, scvoSumaAsegurada: 0, ffep: 0, fuente: '' });

export default function ValoresLegales() {
  const [items, setItems] = useState<VL[]>([]);
  const [edit, setEdit] = useState<VL | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  async function load() { try { setItems(await api.get<VL[]>('/valores-legales')); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  useEffect(() => { load(); }, []);

  async function guardar() {
    if (!edit) return;
    if (!edit.vigenciaDesde) { setMsg({ t: 'La vigencia es obligatoria', ok: false }); return; }
    try { await api.post('/valores-legales', edit); setEdit(null); setMsg({ t: 'Valores guardados', ok: true }); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function autoActualizar() {
    try { const r = await api.post<{ creadas: number; actualizadas: number }>('/valores-legales/auto-actualizar'); setMsg({ t: `Actualización automática: ${r.creadas} períodos nuevos, ${r.actualizadas} actualizados.`, ok: true }); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  async function borrar(v: VL) { if (!confirm(`¿Eliminar los valores con vigencia ${fmt(v.vigenciaDesde)}?`)) return; try { await api.del(`/valores-legales/${v.id}`); load(); } catch (e: any) { setMsg({ t: e.message, ok: false }); } }
  const set = (k: keyof VL, val: any) => setEdit((e) => e ? { ...e, [k]: val } : e);

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          Estos valores se <b>verifican y aplican automáticamente antes de cada corrida</b> de liquidación, según su vigencia.
          Cargá una fila nueva cada vez que cambien (la base imponible SIPA y el SMVM se actualizan todos los meses; el SCVO y el FFEP periódicamente).
          Si liquidás un período sin valores cargados, el sistema avisa o bloquea la corrida.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><button className="btn" onClick={() => { setEdit(vacio()); setMsg(null); }}>+ Cargar valores de un período</button><button className="btn ghost" onClick={autoActualizar}>↻ Actualizar automáticamente</button></div>
        {msg && <p className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 0 }}>{msg.t}</p>}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
          <thead><tr style={{ background: 'var(--bg2)' }}>
            {['Vigencia', 'Tope SIPA máx', 'Base mín', 'SMVM', 'SCVO (prima)', 'FFEP', 'Fuente', ''].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: i === 0 || i > 5 ? 'left' : 'right', borderBottom: '2px solid var(--border)' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {items.map((v, idx) => (
              <tr key={v.id} style={idx === 0 ? { background: 'rgba(34,197,94,.08)' } : undefined}>
                <td style={{ padding: '4px 8px' }}>{fmt(v.vigenciaDesde)} {idx === 0 && <span className="badge" style={{ marginLeft: 6 }}>vigente</span>}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(v.topeSipaMax)}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(v.topeSipaMin)}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(v.smvm)}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(v.scvoPercapita)}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{$(v.ffep)}</td>
                <td style={{ padding: '4px 8px' }} className="muted">{v.fuente || '—'}</td>
                <td style={{ padding: '4px 8px' }}><button className="btn ghost" onClick={() => setEdit({ ...v })}>Editar</button> <button className="btn danger" onClick={() => borrar(v)}>Eliminar</button></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={8} className="muted" style={{ padding: 10 }}>No hay valores cargados. Cargá al menos el período vigente.</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="modal-bg" onClick={() => setEdit(null)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{edit.id ? 'Editar' : 'Nuevos'} valores legales</h3>
            <div className="grid2">
              <div className="field"><label>Vigencia desde</label><input className="input" type="date" value={edit.vigenciaDesde} onChange={(e) => set('vigenciaDesde', e.target.value)} /></div>
              <div className="field"><label>Tope SIPA máximo (base imponible)</label><input className="input" type="number" step="0.01" value={edit.topeSipaMax} onChange={(e) => set('topeSipaMax', Number(e.target.value))} /></div>
              <div className="field"><label>Base imponible mínima</label><input className="input" type="number" step="0.01" value={edit.topeSipaMin} onChange={(e) => set('topeSipaMin', Number(e.target.value))} /></div>
              <div className="field"><label>SMVM</label><input className="input" type="number" step="0.01" value={edit.smvm} onChange={(e) => set('smvm', Number(e.target.value))} /></div>
              <div className="field"><label>SCVO — prima individual (Dto. 1567/74)</label><input className="input" type="number" step="0.01" value={edit.scvoPercapita} onChange={(e) => set('scvoPercapita', Number(e.target.value))} /></div>
              <div className="field"><label>SCVO — suma asegurada</label><input className="input" type="number" step="0.01" value={edit.scvoSumaAsegurada} onChange={(e) => set('scvoSumaAsegurada', Number(e.target.value))} /></div>
              <div className="field"><label>FFEP — suma fija por trabajador</label><input className="input" type="number" step="0.01" value={edit.ffep} onChange={(e) => set('ffep', Number(e.target.value))} /></div>
              <div className="field"><label>Fuente / nota</label><input className="input" value={edit.fuente || ''} onChange={(e) => set('fuente', e.target.value)} /></div>
            </div>
            <div className="row" style={{ marginTop: 12 }}><button className="btn" onClick={guardar}>Guardar</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
          </div>
        </div>
      )}
    </>
  );
}
