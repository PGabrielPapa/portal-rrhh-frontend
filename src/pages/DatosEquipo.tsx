import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Empleado } from '../lib/types';
import Avatar from '../components/Avatar';

const v = (x: unknown) => (x === null || x === undefined || x === '' ? '—' : String(x));
const sexoLabel = (x: unknown) => (({ M: 'Masculino', F: 'Femenino', X: 'Otro' } as Record<string, string>)[String(x || '')] || (x ? String(x) : '—'));
const fmtFecha = (s: unknown) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s ? String(s) : '—'); };
const money = (n: number) => '$ ' + (n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
const antigDe = (ing: unknown) => { const d = new Date(String(ing || '').slice(0, 10) + 'T00:00:00'); if (isNaN(d.getTime())) return null; return Math.floor((Date.now() - d.getTime()) / (365.25 * 864e5)); };
const domicilio = (p: any) => {
  const l1 = [p.dom_calle, p.dom_nro, p.dom_piso ? `Piso ${p.dom_piso}` : '', p.dom_depto ? `Dto ${p.dom_depto}` : ''].filter(Boolean).join(' ');
  const l2 = [p.dom_loc, p.dom_prov, p.dom_cp ? `(${p.dom_cp})` : ''].filter(Boolean).join(' ');
  return [l1, l2].filter(Boolean).join(' · ') || '—';
};

function Det({ label, value }: { label: string; value: unknown }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 14 }}>{v(value)}</div>
    </div>
  );
}

export default function DatosEquipo() {
  const [items, setItems] = useState<Empleado[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [abierto, setAbierto] = useState<Set<number>>(new Set());

  const [costos, setCostos] = useState<Record<number, { antiguedad: number; basico: number; remun: number }>>({});
  useEffect(() => {
    api.get<Empleado[]>('/empleados/equipo').then(setItems).catch((e: any) => setErr(e.message));
    const d = new Date();
    api.get<{ items: { id: number; antiguedad: number; basico: number; remun: number }[] }>(`/liquidacion/costo-equipo?anio=${d.getFullYear()}&mes=${d.getMonth() + 1}`)
      .then((r) => { const m: Record<number, any> = {}; for (const it of (r.items || [])) m[it.id] = { antiguedad: it.antiguedad, basico: it.basico, remun: it.remun }; setCostos(m); })
      .catch(() => {});
  }, []);

  const list = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return items
      .filter((e) => !ql || e.nom.toLowerCase().includes(ql) || String(e.legNum).includes(ql) || String((e as any).lugar || '').toLowerCase().includes(ql) || String(e.empresa || '').toLowerCase().includes(ql))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }, [items, q]);

  const toggle = (id: number) => setAbierto((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <>
      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 300 }} placeholder="Buscar nombre, legajo, empresa o lugar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>{list.length} persona(s) a cargo</span>
      </div>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {!err && !items.length && <div className="muted">No tenés personal a cargo en el organigrama.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((e) => {
          const p = e as any;
          const ab = abierto.has(e.id);
          const puesto = p.tarea || p.desc_categoria || [e.cat, e.tramo].filter(Boolean).join(' ');
          return (
            <div key={e.id} className="card" style={{ padding: 0 }}>
              <div className="row" style={{ gap: 12, alignItems: 'center', padding: '10px 14px', cursor: 'pointer' }} onClick={() => toggle(e.id)}>
                <Avatar nombre={e.nom} foto={p.foto} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{e.nom}</div>
                  <div className="muted" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    Leg. {e.legNum} · {e.empresa}{puesto ? ` · ${puesto}` : ''}{p.lugar ? ` · ${p.lugar}` : ''}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    Ingreso {fmtFecha(e.ingreso)}{antigDe(e.ingreso) != null ? ` · Antig. ${antigDe(e.ingreso)} año(s)` : ''}{costos[e.id] ? ` · Remun. ${money(costos[e.id].basico)}` : ''}
                  </div>
                </div>
                <span className="muted" style={{ fontSize: 18 }}>{ab ? '▾' : '▸'}</span>
              </div>

              {ab && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>
                  <div className="grid2" style={{ alignItems: 'start' }}>
                    <div>
                      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Personales</div>
                      <Det label="DNI" value={e.dni} />
                      <Det label="CUIL" value={e.cuil} />
                      <Det label="Fecha de nacimiento" value={p.fecha_nac} />
                      <Det label="Sexo" value={sexoLabel(p.sexo)} />
                      <Det label="Estado civil" value={p.estado_civil} />
                      <Det label="Nacionalidad" value={p.nacionalidad} />
                      <Det label="Domicilio" value={domicilio(p)} />
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Contacto</div>
                      <Det label="Mail laboral" value={p.email_laboral} />
                      <Det label="Mail personal" value={p.email_personal} />
                      <Det label="E-mail (sistema)" value={e.email} />
                      <Det label="Teléfono laboral" value={p.tel_laboral} />
                      <Det label="Teléfono personal" value={p.tel_personal} />

                      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', margin: '12px 0 6px' }}>Contacto de emergencia</div>
                      <Det label="Nombre y apellido" value={p.contacto_nombre} />
                      <Det label="Teléfono" value={p.contacto_tel} />
                      <Det label="Vínculo" value={p.contacto_vinculo} />
                    </div>
                  </div>

                  <div className="grid2" style={{ marginTop: 6 }}>
                    <Det label="Empresa" value={e.empresa} />
                    <Det label="Fecha de ingreso" value={fmtFecha(e.ingreso)} />
                    <Det label="Categoría / Tramo" value={[e.cat, e.tramo].filter(Boolean).join(' ')} />
                    <Det label="Antigüedad" value={antigDe(e.ingreso) != null ? `${antigDe(e.ingreso)} año(s)` : '—'} />
                    <Det label="Remuneración por escala (cat/tramo)" value={costos[e.id] ? money(costos[e.id].basico) : '—'} />
                    <Det label="Remuneración con antigüedad" value={costos[e.id] ? money(costos[e.id].remun) : '—'} />
                    <Det label="Convenio / Sindicato" value={[p.cod_convenio, p.cod_sindicato].filter(Boolean).join(' · ')} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
