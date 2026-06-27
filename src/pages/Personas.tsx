import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';

interface Periodo { id: number; empresa?: string; legajo?: string; fechaIngreso?: string; fechaEgreso?: string; funcion?: string; catEscala?: string; tramoEscala?: string; catConvenio?: string; codConvenio?: string; codSindicato?: string; vigente?: boolean }
interface Persona { id: number; cuil?: string; dni: string; apellido?: string; nombres?: string; nom?: string; tipos: string[]; data?: any; empleadoActivo?: boolean; nPeriodos?: number; periodos?: Periodo[]; accesoComite?: string | null; tieneClave?: boolean }

const TIPOS: [string, string][] = [['empleado', 'Empleado'], ['familiar', 'Familiar'], ['prestador_hys', 'Prestador HyS'], ['medicina_laboral', 'Medicina Laboral'], ['postulante', 'Postulante'], ['contratista', 'Contratista'], ['otro', 'Otro']];
const tipoLbl = (t: string) => TIPOS.find((x) => x[0] === t)?.[1] || t;
const fmt = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—'); };

export default function Personas() {
  const [items, setItems] = useState<Persona[]>([]);
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [exp, setExp] = useState<Record<number, Persona | null>>({});
  const [edit, setEdit] = useState<Persona | null>(null);
  const [show, setShow] = useState(false);
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [asc, setAsc] = useState<Persona | null>(null);
  const nav = useNavigate();

  async function load() {
    try { const p = new URLSearchParams(); if (tipo) p.set('tipo', tipo); if (q) p.set('q', q); setItems(await api.get<Persona[]>(`/personas?${p}`)); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tipo, q]);
  useEffect(() => { api.get<string[]>('/personas/_empresas').then(setEmpresas).catch(() => {}); }, []);

  async function toggle(id: number) {
    if (exp[id] !== undefined) { setExp((s) => { const n = { ...s }; delete n[id]; return n; }); return; }
    setExp((s) => ({ ...s, [id]: null }));
    try { const full = await api.get<Persona>(`/personas/${id}`); setExp((s) => ({ ...s, [id]: full })); } catch { /* */ }
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Buscar nombre, DNI o CUIL…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 200 }} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los tipos</option>{TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => { setEdit(null); setShow(true); }}>+ Nueva persona</button>
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr><th></th><th>Nombre</th><th>DNI</th><th>CUIL</th><th>Tipos</th><th>Períodos</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => {
              const abierto = exp[p.id] !== undefined; const full = exp[p.id];
              return [
                <tr key={p.id}>
                  <td style={{ cursor: 'pointer', width: 24 }} onClick={() => toggle(p.id)}>{abierto ? '▾' : '▸'}</td>
                  <td>{p.nom || `${p.apellido || ''} ${p.nombres || ''}`}{p.empleadoActivo && <span className="badge" style={{ color: 'var(--green)', marginLeft: 6 }}>Empleado activo</span>}</td>
                  <td>{p.dni}</td><td>{p.cuil || '—'}</td>
                  <td>{(p.tipos || []).map((t) => <span key={t} className="badge" style={{ marginRight: 4 }}>{tipoLbl(t)}</span>)}</td>
                  <td>{p.nPeriodos ?? 0}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {!p.empleadoActivo && <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => setAsc(p)}>⬆ Dar de alta empleado</button>}
                    <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setEdit(p); setShow(true); }}>Editar</button>
                  </td>
                </tr>,
                abierto && (
                  <tr key={`d${p.id}`}><td colSpan={7} style={{ background: 'var(--bg2)', padding: '10px 16px' }}>
                    {!full ? <span className="muted">Cargando…</span> : (full.periodos && full.periodos.length ? (
                      <table style={{ width: '100%', fontSize: 13 }}>
                        <thead><tr><th style={{ textAlign: 'left' }}>Empresa</th><th style={{ textAlign: 'left' }}>Legajo</th><th style={{ textAlign: 'left' }}>Ingreso</th><th style={{ textAlign: 'left' }}>Egreso</th><th style={{ textAlign: 'left' }}>Función</th><th style={{ textAlign: 'left' }}>Cat. escala</th><th style={{ textAlign: 'left' }}>Cat. convenio</th><th style={{ textAlign: 'left' }}>Estado</th></tr></thead>
                        <tbody>{full.periodos.map((pe) => (
                          <tr key={pe.id}><td>{pe.empresa || '—'}</td><td>{pe.legajo || '—'}</td><td>{fmt(pe.fechaIngreso)}</td><td>{fmt(pe.fechaEgreso)}</td><td>{pe.funcion || '—'}</td>
                            <td>{[pe.catEscala, pe.tramoEscala].filter(Boolean).join(' ') || '—'}</td><td>{pe.catConvenio || '—'}</td>
                            <td><span className="badge" style={{ color: pe.vigente ? 'var(--green)' : 'var(--t3)' }}>{pe.vigente ? 'Vigente' : 'Cerrado'}</span></td></tr>
                        ))}</tbody>
                      </table>
                    ) : <span className="muted">Sin períodos de prestación registrados.</span>)}
                  </td></tr>
                ),
              ].filter(Boolean);
            })}
            {!items.length && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin personas.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>{items.length} persona(s)</p>

      {show && <PersonaModal persona={edit} onClose={() => setShow(false)} onSaved={(t) => { setShow(false); setMsg({ t, ok: true }); load(); }} onError={(t) => setMsg({ t, ok: false })} />}
      {asc && <AscenderModal persona={asc} empresas={empresas} onClose={() => setAsc(null)} onDone={(empId) => { setAsc(null); setMsg({ t: 'Empleado dado de alta — completá sus datos en ABM Empleados', ok: true }); nav('/m/empleados'); void empId; }} onError={(t) => { setAsc(null); setMsg({ t, ok: false }); }} />}
    </>
  );
}

function AscenderModal({ persona, empresas, onClose, onDone, onError }: { persona: Persona; empresas: string[]; onClose: () => void; onDone: (empId: number) => void; onError: (t: string) => void }) {
  const [empresa, setEmpresa] = useState(empresas[0] || '');
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!empresa) { onError('Elegí una empresa'); return; }
    setBusy(true);
    try { const r: any = await api.post(`/personas/${persona.id}/ascender`, { empresa }); onDone(r.empleadoId); }
    catch (e: any) { onError(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h3 style={{ marginTop: 0 }}>Dar de alta como empleado</h3>
        <p className="muted" style={{ fontSize: 13 }}>{persona.nom || `${persona.apellido || ''} ${persona.nombres || ''}`} · DNI {persona.dni}</p>
        <div className="field"><label>Empresa</label><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}>{empresas.map((em) => <option key={em} value={em}>{em}</option>)}</select></div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Se crea el empleado con legajo automático y su período de prestación vigente. Después completás categoría, sueldo, etc. en ABM Empleados.</div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={go} disabled={busy || !empresa}>{busy ? 'Creando…' : 'Dar de alta'}</button>
        </div>
      </div>
    </div>
  );
}

function PersonaModal({ persona, onClose, onSaved, onError }: { persona: Persona | null; onClose: () => void; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const p = persona || ({} as Persona); const d = p.data || {};
  const [f, setF] = useState<any>({
    apellido: p.apellido || (String(p.nom || '').split(',')[0] || '').trim(),
    nombres: p.nombres || (String(p.nom || '').split(',').slice(1).join(',') || '').trim(),
    dni: p.dni || '', cuil: p.cuil || '',
    email: d.email || '', tel: d.tel || d.tel_personal || '', fecha_nac: d.fecha_nac || '',
  });
  const [tipos, setTipos] = useState<string[]>(p.tipos || []);
  const [busy, setBusy] = useState(false);
  const [accesoC, setAccesoC] = useState<string>(p.accesoComite || '');
  const [accNote, setAccNote] = useState('');
  async function aplicarAcceso() {
    if (!persona) return;
    try {
      const r: any = await api.post(`/personas/${persona.id}/acceso-comite`, { acceso: accesoC || null });
      setAccNote(accesoC ? `Acceso "${accesoC === 'dashboard' ? 'Solo dashboard' : 'Completo'}" habilitado.${r.claveInicial ? ` Clave inicial: ${r.claveInicial} (el DNI).` : ''}` : 'Acceso al comité quitado.');
    } catch (e: any) { setAccNote('⚠ ' + e.message); }
  }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const toggleTipo = (t: string) => setTipos((s) => s.includes(t) ? s.filter((x) => x !== t) : [...s, t]);
  async function save() {
    if (!f.dni.trim()) { onError('El DNI es obligatorio'); return; }
    setBusy(true);
    try {
      const body = { ...f, tipos };
      if (persona) await api.put(`/personas/${persona.id}`, body); else await api.post('/personas', body);
      onSaved(persona ? 'Persona actualizada' : 'Persona creada');
    } catch (e: any) { onError(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <h3 style={{ marginTop: 0 }}>{persona ? 'Editar persona' : 'Nueva persona'}</h3>
        <div className="grid2">
          <div className="field"><label>Apellido</label><input className="input" value={f.apellido} onChange={set('apellido')} /></div>
          <div className="field"><label>Nombres</label><input className="input" value={f.nombres} onChange={set('nombres')} /></div>
          <div className="field"><label>DNI *</label><input className="input" value={f.dni} onChange={set('dni')} /></div>
          <div className="field"><label>CUIL</label><input className="input" value={f.cuil} onChange={set('cuil')} placeholder="XX-XXXXXXXX-X" /></div>
          <div className="field"><label>E-mail</label><input className="input" value={f.email} onChange={set('email')} /></div>
          <div className="field"><label>Teléfono</label><input className="input" value={f.tel} onChange={set('tel')} /></div>
          <div className="field"><label>Fecha de nacimiento</label><input className="input" value={f.fecha_nac} onChange={set('fecha_nac')} placeholder="AAAA-MM-DD o DD/MM/AAAA" /></div>
        </div>
        <div className="sb-group-label" style={{ margin: '12px 0 6px' }}>Tipos de persona</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          {TIPOS.map(([v, l]) => <label key={v} className="row" style={{ gap: 5, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={tipos.includes(v)} onChange={() => toggleTipo(v)} /> {l}</label>)}
        </div>
        {tipos.includes('empleado') && !persona?.empleadoActivo && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Para que sea empleado operativo (con liquidación), se da de alta su período desde ABM Empleados. Acá queda marcada como tipo "Empleado".</div>}
        {persona && <>
          <div className="sb-group-label" style={{ margin: '14px 0 6px' }}>Acceso al Comité de HyS (login por DNI)</div>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="input" style={{ maxWidth: 240 }} value={accesoC} onChange={(e) => setAccesoC(e.target.value)}>
              <option value="">Sin acceso</option>
              <option value="dashboard">Solo dashboard de HyS</option>
              <option value="full">Acceso completo al comité</option>
            </select>
            <button type="button" className="btn ghost" onClick={aplicarAcceso}>Aplicar acceso</button>
            {persona.tieneClave && <span className="muted" style={{ fontSize: 12 }}>🔑 clave configurada</span>}
          </div>
          {accNote && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{accNote}</div>}
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Al habilitar acceso, la clave inicial es el DNI. "Solo dashboard" ve únicamente los indicadores.</div>
        </>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy || !f.dni}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
