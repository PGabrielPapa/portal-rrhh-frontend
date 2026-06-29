import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { buscarObrasSociales, type ObraSocial } from '../lib/arca';
import type { Empleado } from '../lib/types';
import Avatar from '../components/Avatar';

const v = (x: unknown) => (x === null || x === undefined || x === '' ? '—' : String(x));
const sexoLabel = (x: unknown) => (({ M: 'Masculino', F: 'Femenino', X: 'X / No binario' } as Record<string, string>)[String(x || '')] || (x ? String(x) : '—'));
function Field({ label, value }: { label: string; value: unknown }) {
  return (<div className="field" style={{ marginBottom: 10 }}><label>{label}</label><div style={{ fontSize: 14 }}>{v(value)}</div></div>);
}
interface Cambio { id: number; dom_anterior?: string; dom_nuevo?: string; estado: string; created_at: string; resuelto_at?: string; resuelto_por?: string; }
const fmtFecha = (s?: string) => s ? new Date(s).toLocaleDateString('es-AR') : '';
const estadoColor = (e: string) => e === 'aprobado' ? 'var(--green)' : e === 'rechazado' ? 'var(--red)' : 'var(--yellow)';
const EST_CIV = ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Separado/a', 'Unión convivencial'];
const VINCULOS = ['Cónyuge/Pareja', 'Padre', 'Madre', 'Hijo/a', 'Hermano/a', 'Familiar', 'Amigo/a', 'Otro'];

export default function MisDatos() {
  const [p, setP] = useState<Empleado | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'datos' | 'modificar'>('datos');
  const [cambios, setCambios] = useState<Cambio[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  // Obra social
  const [osCambios, setOsCambios] = useState<any[]>([]);
  const [showOS, setShowOS] = useState(false);
  const [osQ, setOsQ] = useState('');
  const [osRes, setOsRes] = useState<ObraSocial[]>([]);
  const [osSel, setOsSel] = useState<ObraSocial | null>(null);
  const [osMsg, setOsMsg] = useState<{ t: string; ok: boolean } | null>(null);
  // Autogestión de datos de contacto (impacto directo + histórico)
  const [fc, setFc] = useState<Record<string, string>>({});
  const [msgC, setMsgC] = useState<{ t: string; ok: boolean } | null>(null);
  const [histC, setHistC] = useState<any[]>([]);
  const setC = (k: string) => (e: any) => setFc({ ...fc, [k]: e.target.value });

  async function load() {
    try { setP(await api.get<Empleado>('/empleados/mi-perfil')); }
    catch (e: any) { setErr(e.message); return; }
    try { setCambios(await api.get<Cambio[]>('/cambios-domicilio/mias')); } catch { /* opcional */ }
    try { setOsCambios(await api.get<any[]>('/cambios-obra-social/mias')); } catch { /* opcional */ }
    try { setHistC(await api.get<any[]>('/empleados/mi-perfil/cambios')); } catch { /* opcional */ }
  }
  useEffect(() => { load(); }, []);
  // Mantener el formulario de contacto sincronizado con el perfil.
  useEffect(() => {
    if (!p) return;
    setFc({ estado_civil: String(p['estado_civil'] || ''), email_personal: String(p['email_personal'] || ''), tel_personal: String(p['tel_personal'] || ''), contacto_nombre: String(p['contacto_nombre'] || ''), contacto_tel: String(p['contacto_tel'] || ''), contacto_vinculo: String(p['contacto_vinculo'] || '') });
  }, [p]);

  useEffect(() => {
    if (!showOS) return;
    const t = setTimeout(() => { buscarObrasSociales(osQ).then(setOsRes).catch(() => setOsRes([])); }, 250);
    return () => clearTimeout(t);
  }, [osQ, showOS]);

  async function enviarOS(e: React.FormEvent) {
    e.preventDefault();
    if (!osSel) { setOsMsg({ t: 'Elegí una obra social de la lista', ok: false }); return; }
    try {
      await api.post('/cambios-obra-social', { os_codigo: osSel.codigo, os_nombre: osSel.nombre });
      setOsMsg({ t: 'Cambio de obra social enviado a RR.HH.', ok: true });
      setOsSel(null); setOsQ(''); setShowOS(false); load();
    } catch (e: any) { setOsMsg({ t: e.message, ok: false }); }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    try { await api.post('/cambios-domicilio', f); setMsg({ t: 'Cambio de domicilio enviado a RR.HH.', ok: true }); setF({}); setShowForm(false); load(); }
    catch (e: any) { setMsg({ t: e.message, ok: false }); }
  }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function guardarC(e: React.FormEvent) {
    e.preventDefault();
    try { await api.patch('/empleados/mi-perfil', fc); setMsgC({ t: 'Datos actualizados. RR.HH. fue notificado.', ok: true }); await load(); }
    catch (err: any) { setMsgC({ t: err.message, ok: false }); }
  }

  if (err) return <div className="err">⚠ {err}</div>;
  if (!p) return <div className="muted">Cargando…</div>;

  const dom = [p['dom_calle'], p['dom_nro'], p['dom_piso'] ? `Piso ${p['dom_piso']}` : '', p['dom_depto'] ? `Dto ${p['dom_depto']}` : ''].filter(Boolean).join(' ');
  const loc = [p['dom_loc'], p['dom_prov'], p['dom_cp'] ? `(${p['dom_cp']})` : ''].filter(Boolean).join(' ');

  return (
    <>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <Avatar nombre={p.nom} foto={(p as any).foto} size={52} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{p.nom}</div>
          <div className="muted" style={{ fontFamily: 'var(--font-mono)', marginTop: 2 }}>Legajo {p.legNum} · {p.empresa}{p['lugar'] ? ` · ${p['lugar']}` : ''}</div>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <button className={tab === 'datos' ? 'btn' : 'btn ghost'} onClick={() => setTab('datos')}>Mis datos</button>
        <button className={tab === 'modificar' ? 'btn' : 'btn ghost'} onClick={() => setTab('modificar')}>Modificar datos</button>
      </div>

      {tab === 'datos' && (<>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Datos personales</h3>
          <div className="grid2">
            <Field label="DNI" value={p.dni} /><Field label="CUIL" value={p.cuil} />
            <Field label="Fecha de nacimiento" value={p['fecha_nac']} /><Field label="Sexo" value={sexoLabel(p['sexo'])} />
            <Field label="Estado civil" value={p['estado_civil']} /><Field label="Nacionalidad" value={p['nacionalidad']} />
            <Field label="E-mail (sistema)" value={p.email} />
            <Field label="Mail laboral" value={p['email_laboral']} /><Field label="Mail personal" value={p['email_personal']} />
            <Field label="Teléfono laboral" value={p['tel_laboral']} /><Field label="Teléfono personal" value={p['tel_personal']} />
            <Field label="Contacto de emergencia" value={[p['contacto_nombre'], p['contacto_tel'], p['contacto_vinculo']].filter(Boolean).join(' · ')} />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Datos laborales</h3>
          <div className="grid2">
            <Field label="Empresa" value={p.empresa} /><Field label="Legajo" value={p.legNum} />
            <Field label="Fecha de ingreso" value={p.ingreso} /><Field label="Categoría" value={p.cat} />
            <Field label="Tramo" value={p.tramo} /><Field label="Tarea" value={p['tarea']} />
            <Field label="Condición" value={p['condicion']} /><Field label="Convenio" value={p['cod_convenio']} />
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Domicilio y obra social</h3>
          <div className="grid2">
            <Field label="Domicilio" value={dom} /><Field label="Localidad / Provincia" value={loc} />
            <Field label="Obra social actual" value={p['os_nombre'] || p['desc_os']} />
            <Field label="Código (RNOS)" value={p['os_codigo'] || p['cod_os']} />
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Para actualizar estos datos, andá a la pestaña «Modificar datos».</div>
        </div>
      </>)}

      {tab === 'modificar' && (<>
        <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>Acá podés actualizar tus datos de contacto (se aplican al instante y se notifica a RR.HH.) o informar cambios de domicilio y obra social (RR.HH. los revisa y aprueba).</p>

        {/* Datos de contacto — edición directa */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Datos de contacto <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· se actualizan al instante</span></h3>
          <form onSubmit={guardarC} style={{ marginTop: 8 }}>
            <div className="grid2">
              <div className="field"><label>Estado civil</label><select className="input" value={fc.estado_civil || ''} onChange={setC('estado_civil')}><option value="">—</option>{!EST_CIV.includes(fc.estado_civil) && fc.estado_civil && <option value={fc.estado_civil}>{fc.estado_civil}</option>}{EST_CIV.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
              <div className="field"><label>Mail personal</label><input className="input" type="email" value={fc.email_personal || ''} onChange={setC('email_personal')} /></div>
              <div className="field"><label>Teléfono personal</label><input className="input" value={fc.tel_personal || ''} onChange={setC('tel_personal')} /></div>
            </div>
            <div className="sb-group-label" style={{ margin: '10px 0 6px' }}>Contacto de emergencia</div>
            <div className="grid2">
              <div className="field"><label>Nombre y apellido</label><input className="input" value={fc.contacto_nombre || ''} onChange={setC('contacto_nombre')} /></div>
              <div className="field"><label>Teléfono</label><input className="input" value={fc.contacto_tel || ''} onChange={setC('contacto_tel')} /></div>
              <div className="field"><label>Vínculo</label><select className="input" value={fc.contacto_vinculo || ''} onChange={setC('contacto_vinculo')}><option value="">—</option>{!VINCULOS.includes(fc.contacto_vinculo) && fc.contacto_vinculo && <option value={fc.contacto_vinculo}>{fc.contacto_vinculo}</option>}{VINCULOS.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
            </div>
            <div className="row" style={{ marginTop: 10 }}><button className="btn">Guardar cambios</button></div>
          </form>
          {msgC && <div className={msgC.ok ? 'ok' : 'err'} style={{ marginTop: 10 }}>{msgC.ok ? '✓ ' : '⚠ '}{msgC.t}</div>}
          {histC.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="muted" style={{ marginBottom: 6, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.05em' }}>Histórico de cambios</div>
              {histC.map((c) => (
                <div key={c.id} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <b>{c.etiqueta || c.campo}</b>: <span className="muted">{c.valor_anterior || '—'}</span> → {c.valor_nuevo || '—'}<span className="muted"> · {fmtFecha(c.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Domicilio — informar cambio */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Domicilio <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· requiere aprobación de RR.HH.</span></h3>
            <button className="btn ghost" onClick={() => setShowForm(!showForm)}>✏ Informar cambio</button>
          </div>
          <div className="grid2" style={{ marginTop: 12 }}>
            <Field label="Domicilio actual" value={dom} /><Field label="Localidad / Provincia" value={loc} />
          </div>
          {showForm && (
            <form onSubmit={enviar} style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <h4 style={{ marginTop: 0 }}>Nuevo domicilio</h4>
              <div className="grid2">
                <div className="field"><label>Calle *</label><input className="input" value={f.calle || ''} onChange={set('calle')} /></div>
                <div className="field"><label>Número *</label><input className="input" value={f.nro || ''} onChange={set('nro')} /></div>
                <div className="field"><label>Piso</label><input className="input" value={f.piso || ''} onChange={set('piso')} /></div>
                <div className="field"><label>Depto</label><input className="input" value={f.depto || ''} onChange={set('depto')} /></div>
                <div className="field"><label>Localidad *</label><input className="input" value={f.loc || ''} onChange={set('loc')} /></div>
                <div className="field"><label>Provincia</label><input className="input" value={f.prov || ''} onChange={set('prov')} /></div>
                <div className="field"><label>C.P.</label><input className="input" value={f.cp || ''} onChange={set('cp')} /></div>
              </div>
              <div className="row" style={{ marginTop: 10 }}><button className="btn">Enviar</button><button type="button" className="btn ghost" onClick={() => setShowForm(false)}>Cancelar</button></div>
            </form>
          )}
          {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginTop: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
          {cambios.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="muted" style={{ marginBottom: 6, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.05em' }}>Histórico de domicilios</div>
              {cambios.map((c) => (
                <div key={c.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div>{c.dom_nuevo}</div>
                    <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      {c.estado === 'aprobado' ? `Vigente desde ${fmtFecha(c.resuelto_at)}` : c.estado === 'rechazado' ? `Rechazado ${fmtFecha(c.resuelto_at)}` : `Informado ${fmtFecha(c.created_at)}`}
                    </div>
                  </div>
                  <span className="badge" style={{ color: estadoColor(c.estado) }}>{c.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Obra social — solicitar cambio */}
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Obra social <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· requiere aprobación de RR.HH.</span></h3>
            <button className="btn ghost" onClick={() => { setShowOS(!showOS); setOsMsg(null); }}>✏ Solicitar cambio</button>
          </div>
          <div className="grid2" style={{ marginTop: 12 }}>
            <Field label="Obra social actual" value={p['os_nombre'] || p['desc_os']} />
            <Field label="Código (RNOS)" value={p['os_codigo'] || p['cod_os']} />
          </div>
          {showOS && (
            <form onSubmit={enviarOS} style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <h4 style={{ marginTop: 0 }}>Elegir nueva obra social</h4>
              <div className="field">
                <label>Buscar por nombre o código</label>
                <input className="input" value={osQ} onChange={(e) => { setOsQ(e.target.value); setOsSel(null); }} placeholder="Ej.: OSDE, gráfico, 1-0900-4…" />
              </div>
              {osSel
                ? <div className="ok" style={{ marginTop: 4 }}>Seleccionada: <b>{osSel.codigo}</b> — {osSel.nombre}</div>
                : osQ && (
                  <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4 }}>
                    {osRes.map((o) => (
                      <div key={o.codigo} onClick={() => setOsSel(o)} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{o.codigo}</span> — {o.nombre}
                      </div>
                    ))}
                    {!osRes.length && <div className="muted" style={{ padding: '6px 10px', fontSize: 13 }}>Sin coincidencias.</div>}
                  </div>
                )}
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn" disabled={!osSel}>Enviar solicitud</button>
                <button type="button" className="btn ghost" onClick={() => { setShowOS(false); setOsSel(null); setOsQ(''); }}>Cancelar</button>
              </div>
            </form>
          )}
          {osMsg && <div className={osMsg.ok ? 'ok' : 'err'} style={{ marginTop: 10 }}>{osMsg.ok ? '✓ ' : '⚠ '}{osMsg.t}</div>}
          {osCambios.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="muted" style={{ marginBottom: 6, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.05em' }}>Histórico de obra social</div>
              {osCambios.map((c) => (
                <div key={c.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div><span style={{ fontFamily: 'var(--font-mono)' }}>{c.os_codigo}</span> — {c.os_nombre}</div>
                    <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      {c.estado === 'aprobado' ? `Vigente desde ${fmtFecha(c.resuelto_at)}` : c.estado === 'rechazado' ? `Rechazado ${fmtFecha(c.resuelto_at)}` : `Solicitado ${fmtFecha(c.created_at)}`}
                    </div>
                  </div>
                  <span className="badge" style={{ color: estadoColor(c.estado) }}>{c.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </>)}
    </>
  );
}
