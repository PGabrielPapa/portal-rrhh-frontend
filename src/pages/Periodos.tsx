import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

// Períodos laborales del legajo: cada relación laboral con una empresa del grupo,
// con su alta, su baja y su causa. El número de legajo no cambia nunca.

interface Legajo {
  id: number; leg_num: string; nom: string; activo: boolean;
  ingreso: string | null; empresa: string; periodos: number; cesiones: number;
  vigentes?: number; empresas_vigentes?: string | null;
}
interface Empresa { id: number; nombre: string; }
interface Periodo {
  id: number; nro: number; legajo: string; empresa: string | null; empresaOrigen: string | null;
  fechaIngreso: string | null; fechaEgreso: string | null; causaEgreso: string | null;
  motivoAlta: string | null; antiguedadReconocida: string | null; vigente: boolean;
  observacion: string | null; recibos?: number;
  scvo: boolean; asigFam: boolean; osUnificada: boolean; retieneGanancias: boolean;
}

// Con cargos simultáneos hay obligaciones que se cumplen UNA sola vez, y cada una
// elige empresa por un criterio distinto. No se derivan entre sí.
const DESIGNACIONES = [
  { k: 'scvo' as const,             sigla: 'SCVO', nombre: 'Seguro de Vida Obligatorio', criterio: 'lo contrata la empresa de mayor jornada mensual (Dto. 1567/74, regl. art. 3)' },
  { k: 'asigFam' as const,          sigla: 'AAFF', nombre: 'Asignaciones familiares',    criterio: 'las habilita el empleo de mayor antigüedad (Ley 24.714 art. 21)' },
  { k: 'osUnificada' as const,      sigla: 'OS',   nombre: 'Obra social unificada',      criterio: 'la elige el trabajador y la comunica a ambos empleadores (Dto. 292/95 art. 9)' },
  { k: 'retieneGanancias' as const, sigla: 'GAN',  nombre: 'Retención de Ganancias',     criterio: 'retiene la empresa que pagó mayor remuneración el año fiscal anterior (RG 4003 art. 3)' },
];

const fmt = (d: string | null) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
const MOTIVO: Record<string, string> = { ingreso: 'Ingreso', cesion: 'Cesión de contrato', reingreso: 'Reingreso', migracion: 'Carga inicial', simultaneo: 'Cargo simultáneo' };
const masUnDia = (iso: string) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const hoy = () => new Date().toISOString().slice(0, 10);

export default function Periodos() {
  const [legajos, setLegajos] = useState<Legajo[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [proximo, setProximo] = useState('');
  const [sel, setSel] = useState<Legajo | null>(null);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [busca, setBusca] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState<any>(null);   // { tipo: 'cesion' | 'reingreso', ... }

  async function cargar() {
    setErr('');
    try {
      const r = await api.get<{ legajos: Legajo[]; empresas: Empresa[] }>('/periodos/resumen');
      setLegajos(r.legajos); setEmpresas(r.empresas);
      const p = await api.get<{ legajo: string }>('/periodos/proximo-legajo');
      setProximo(p.legajo);
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { cargar(); }, []);

  async function abrir(l: Legajo) {
    setSel(l); setForm(null); setMsg('');
    try { setPeriodos(await api.get<Periodo[]>(`/periodos/empleado/${l.id}`)); }
    catch (e: any) { setErr(e.message); }
  }

  const visibles = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return legajos;
    return legajos.filter((l) => l.nom.toLowerCase().includes(t) || String(l.leg_num).includes(t) || l.empresa.toLowerCase().includes(t));
  }, [legajos, busca]);

  // Puede haber más de uno: cargo simultáneo en dos empresas del grupo.
  const vigentes = periodos.filter((p) => p.vigente);
  const vigente = vigentes[0] || null;
  const simultaneo = vigentes.length > 1;

  // Mover una obligación a otra relación del legajo. Es excluyente: la designación
  // se apaga en todas las demás, porque la obligación se cumple una sola vez.
  async function designar(periodoId: number, k: 'scvo' | 'asigFam' | 'osUnificada' | 'retieneGanancias') {
    if (!sel) return;
    setErr(''); setMsg('');
    try {
      for (const p of periodos.filter((x) => x.vigente)) {
        const valor = p.id === periodoId;
        if (p[k] === valor) continue;
        await api.put(`/periodos/${p.id}`, { [k]: valor });
      }
      setPeriodos(await api.get<Periodo[]>(`/periodos/empleado/${sel.id}`));
    } catch (e: any) { setErr(e.message); }
  }

  async function confirmar() {
    if (!sel || !form) return;
    setErr(''); setMsg('');
    try {
      if (form.tipo === 'cesion') {
        const r = await api.post<{ antiguedadReconocida: string }>('/periodos/ceder', {
          empleadoId: sel.id, empresaDestino: form.empresaDestino,
          periodoId: form.periodoId || undefined,
          fechaEgreso: form.fechaEgreso, fechaIngreso: form.fechaIngreso, observacion: form.observacion,
        });
        setMsg(`Contrato cedido. El legajo ${sel.leg_num} conserva su número y su antigüedad desde el ${fmt(r.antiguedadReconocida)}.`);
      } else if (form.tipo === 'simultaneo') {
        await api.post('/periodos/simultaneo', {
          empleadoId: sel.id, empresa: form.empresaDestino,
          fechaIngreso: form.fechaIngreso, observacion: form.observacion,
        });
        setMsg(`Relación simultánea registrada. El legajo ${sel.leg_num} queda con dos relaciones abiertas y cobra un recibo por empresa. Revisá abajo en qué empresa queda cada obligación.`);
      } else {
        await api.post('/periodos/reingreso', {
          empleadoId: sel.id, empresaId: form.empresaDestino,
          fechaIngreso: form.fechaIngreso, reconoceAntiguedad: !!form.reconoce, observacion: form.observacion,
        });
        setMsg(`Reingreso registrado para el legajo ${sel.leg_num}.`);
      }
      setForm(null);
      await cargar();
      const l = sel; setPeriodos(await api.get<Periodo[]>(`/periodos/empleado/${l.id}`));
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
        El número de legajo identifica a la persona dentro del grupo y no cambia nunca: al ceder el contrato a otra
        empresa se conserva y se abre un período nuevo. El próximo legajo a asignar es <strong>{proximo || '…'}</strong>.
      </p>

      {err && <div className="err" style={{ marginBottom: 10 }}>⚠ {err}</div>}
      {msg && <div className="ok" style={{ marginBottom: 10 }}>{msg}</div>}

      <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: 0, flex: '1 1 380px', minWidth: 320 }}>
          <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
            <input className="input" placeholder="Buscar por legajo, apellido o empresa…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead><tr>
                <th style={{ textAlign: 'left' }}>Legajo</th><th style={{ textAlign: 'left' }}>Apellido y nombre</th>
                <th style={{ textAlign: 'left' }}>Empresa</th><th>Períodos</th>
              </tr></thead>
              <tbody>
                {visibles.map((l) => (
                  <tr key={l.id} onClick={() => abrir(l)} style={{ cursor: 'pointer', background: sel?.id === l.id ? 'rgba(61,127,255,.10)' : undefined }}>
                    <td style={{ fontFamily: 'monospace' }}>{l.leg_num}</td>
                    <td>{l.nom}{!l.activo && <span className="badge" style={{ marginLeft: 6 }}>baja</span>}</td>
                    <td className="muted">{l.empresas_vigentes || l.empresa}</td>
                    <td style={{ textAlign: 'center' }}>
                      {l.periodos}
                      {l.cesiones > 0 && <span className="badge" style={{ marginLeft: 5 }} title="Tuvo cesión de contrato">↔</span>}
                      {(l.vigentes ?? 0) > 1 && <span className="badge" style={{ marginLeft: 5, color: 'var(--accent2)' }}
                        title={`Cargos simultáneos: ${l.vigentes} relaciones abiertas a la vez`}>⇉</span>}
                    </td>
                  </tr>
                ))}
                {!visibles.length && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 16 }}>Sin resultados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ flex: '2 1 520px', minWidth: 380 }}>
          {!sel && <div className="card muted">Elegí un legajo de la lista para ver sus períodos.</div>}

          {sel && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong style={{ fontSize: 16 }}>{sel.nom}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Legajo <span style={{ fontFamily: 'monospace' }}>{sel.leg_num}</span> · ingreso al grupo {fmt(sel.ingreso)} ·
                    {vigentes.length ? ` prestando servicios en ${vigentes.map((v) => v.empresa).join(' y ')}` : ' sin período vigente'}
                    {simultaneo && <span className="badge" style={{ marginLeft: 6, color: 'var(--accent2)' }}>cargos simultáneos</span>}
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {vigente && <button className="btn" onClick={() => setForm({
                    tipo: 'cesion', empresaDestino: '', periodoId: vigentes.length > 1 ? '' : vigente.id,
                    fechaEgreso: hoy(), fechaIngreso: masUnDia(hoy()), observacion: '',
                  })}>↔ Ceder contrato</button>}
                  {vigente && <button className="btn ghost" onClick={() => setForm({
                    tipo: 'simultaneo', empresaDestino: '', fechaIngreso: hoy(), observacion: '',
                  })}>+ Cargo simultáneo</button>}
                  {!vigente && <button className="btn" onClick={() => setForm({
                    tipo: 'reingreso', empresaDestino: '', fechaIngreso: hoy(), reconoce: false, observacion: '',
                  })}>↩ Registrar reingreso</button>}
                </div>
              </div>
            </div>
          )}

          {form && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h3 style={{ marginTop: 0 }}>{form.tipo === 'cesion' ? 'Cesión del contrato de trabajo' : 'Reingreso'}</h3>
              {form.tipo === 'cesion' && (
                <p className="muted" style={{ marginTop: -6, fontSize: 12 }}>
                  Arts. 225/229 LCT: se cierra el período en la empresa cedente <strong>sin liquidación final</strong> y la
                  cesionaria continúa la relación reconociendo la antigüedad. El legajo y los datos personales no se tocan;
                  lo que cambie de la nueva relación (categoría, convenio, sindicato, remuneración) se edita después en el legajo.
                </p>
              )}
              <div className="grid2" style={{ margin: '8px 0' }}>
                <div className="field"><label>{form.tipo === 'cesion' ? 'Empresa cesionaria' : 'Empresa'}</label>
                  <select className="input" value={form.empresaDestino} onChange={(e) => setForm({ ...form, empresaDestino: e.target.value })}>
                    <option value="">— elegir —</option>
                    {empresas.filter((em) => (form.tipo === 'reingreso') || !vigentes.some((v) => v.empresa === em.nombre)).map((em) => (
                      <option key={em.id} value={em.id}>{em.nombre}</option>
                    ))}
                  </select>
                </div>
                {form.tipo === 'cesion' && vigentes.length > 1 && (
                  <div className="field"><label>Empresa cedente</label>
                    <select className="input" value={form.periodoId} onChange={(e) => setForm({ ...form, periodoId: e.target.value })}>
                      <option value="">— elegir —</option>
                      {vigentes.map((v) => <option key={v.id} value={v.id}>{v.empresa}</option>)}
                    </select>
                  </div>
                )}
                {form.tipo === 'cesion' && (
                  <div className="field"><label>Egreso en la cedente</label>
                    <input className="input" type="date" value={form.fechaEgreso}
                      onChange={(e) => setForm({ ...form, fechaEgreso: e.target.value, fechaIngreso: e.target.value ? masUnDia(e.target.value) : '' })} />
                  </div>
                )}
                <div className="field"><label>{form.tipo === 'cesion' ? 'Alta en la cesionaria' : form.tipo === 'simultaneo' ? 'Alta en la nueva empresa' : 'Fecha de reingreso'}</label>
                  <input className="input" type="date" value={form.fechaIngreso} onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })} />
                </div>
                {form.tipo === 'reingreso' && (
                  <div className="field"><label>Antigüedad</label>
                    <select className="input" value={form.reconoce ? 'si' : 'no'} onChange={(e) => setForm({ ...form, reconoce: e.target.value === 'si' })}>
                      <option value="no">Arranca de cero desde el reingreso</option>
                      <option value="si">Reconocer la antigüedad anterior</option>
                    </select>
                  </div>
                )}
                {form.tipo === 'simultaneo' && (
                  <p className="muted" style={{ gridColumn: '1 / -1', margin: 0, fontSize: 12 }}>
                    La relación vigente <strong>no se cierra</strong>: el legajo queda con dos relaciones abiertas y cobra
                    un recibo por empresa, cada uno por el mes completo (no hay prorrateo por días — eso es de la cesión).
                    Las cuatro obligaciones de una sola vez quedan, por defecto, en la relación que ya existía; movelas
                    después desde la grilla si corresponde.
                  </p>
                )}
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>Observación</label>
                  <input className="input" value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })}
                    placeholder="Ej.: acuerdo de cesión firmado el 01/09/2026" />
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={confirmar}
                  disabled={!form.empresaDestino || !form.fechaIngreso || (form.tipo === 'cesion' && vigentes.length > 1 && !form.periodoId)}>Confirmar</button>
                <button className="btn ghost" onClick={() => setForm(null)}>Cancelar</button>
              </div>
            </div>
          )}

          {sel && !!periodos.length && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}><strong>Períodos</strong></div>
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12 }}>
                  <thead><tr>
                    <th>#</th><th style={{ textAlign: 'left' }}>Empresa</th><th style={{ textAlign: 'left' }}>Alta</th>
                    <th style={{ textAlign: 'left' }}>Ingreso</th><th style={{ textAlign: 'left' }}>Egreso</th>
                    <th style={{ textAlign: 'left' }}>Causa</th><th style={{ textAlign: 'left' }}>Antig. reconocida</th>
                    {simultaneo && <th>Obligaciones</th>}<th>Recibos</th>
                  </tr></thead>
                  <tbody>
                    {periodos.map((p) => (
                      <tr key={p.id} style={p.vigente ? { background: 'rgba(34,197,94,.08)' } : undefined}>
                        <td style={{ textAlign: 'center' }}>{p.nro}</td>
                        <td>{p.empresa || '—'}{p.empresaOrigen && <div className="muted" style={{ fontSize: 11 }}>cedido desde {p.empresaOrigen}</div>}</td>
                        <td>{MOTIVO[p.motivoAlta || ''] || p.motivoAlta || '—'}</td>
                        <td>{fmt(p.fechaIngreso)}</td>
                        <td>{p.vigente ? <span className="badge" style={{ color: 'var(--green)' }}>vigente</span> : fmt(p.fechaEgreso)}</td>
                        <td>{p.causaEgreso === 'cesion' ? 'Cesión' : (p.causaEgreso || '—')}</td>
                        <td>{fmt(p.antiguedadReconocida)}</td>
                        {simultaneo && (
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {p.vigente ? DESIGNACIONES.map((d) => (
                              <button key={d.k} type="button" onClick={() => designar(p.id, d.k)}
                                title={`${d.nombre}: ${p[d.k] ? 'a cargo de esta empresa' : 'a cargo de la otra'} — ${d.criterio}`}
                                style={{
                                  cursor: 'pointer', marginRight: 3, padding: '1px 5px', fontSize: 10, borderRadius: 4,
                                  fontFamily: 'monospace', border: '1px solid var(--border)',
                                  background: p[d.k] ? 'var(--accent2)' : 'transparent',
                                  color: p[d.k] ? '#fff' : 'var(--t3)',
                                }}>{d.sigla}</button>
                            )) : <span className="muted">—</span>}
                          </td>
                        )}
                        <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{p.recibos ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {simultaneo && (
                <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 11 }} className="muted">
                  <div style={{ marginBottom: 4 }}>
                    Este legajo tiene <strong>cargos simultáneos</strong>. Cada empresa liquida su mes completo y presenta su propio F.931.
                    Estas cuatro obligaciones se cumplen <strong>una sola vez</strong> — tocá la sigla para moverla a esa empresa:
                  </div>
                  {DESIGNACIONES.map((d) => (
                    <div key={d.k}><span style={{ fontFamily: 'monospace' }}>{d.sigla}</span> — {d.nombre}: {d.criterio}.</div>
                  ))}
                </div>
              )}
              {periodos.some((p) => p.observacion) && (
                <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 11 }} className="muted">
                  {periodos.filter((p) => p.observacion).map((p) => <div key={p.id}>#{p.nro}: {p.observacion}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
