import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

type Data = Record<string, any>;

const LABELS: Record<string, string> = {
  // Aportes del trabajador (nacionales)
  pctJubilacion: 'Jubilación (trabajador) %',
  pctObraSocial: 'Obra Social (trabajador) %',
  pctAnssal: 'ANSSAL %',
  pctPamiEmp: 'PAMI / INSSJP (trabajador) %',
  pctSindicatoEmp: 'Cuota sindical (trabajador) % — por defecto',
  nombreSindicato: 'Sindicato por defecto (nombre)',
  // Contribuciones patronales
  pctJubPatronal: 'Jubilación patronal %',
  pctOsPatronal: 'Obra Social patronal %',
  pctPamiPatronal: 'PAMI / INSSJP patronal %',
  pctDesempleo: 'Fondo Nacional de Empleo (desempleo) %',
  pctArt: 'ART % — por defecto (la real es por empresa en “ART por empresa”)',
  pctSindicatoPatronal: 'Cuota sindical patronal % — por defecto',
  scvoPercapita: 'Seguro de Vida Obligatorio — SCVO ($ por trabajador)',
  ffep: 'FFEP — Fondo Fiduc. Enf. Profesionales ($ por trabajador)',
  fondoCesePct: 'Fondo de cese laboral (Ley Bases) %',
  pctFal: 'FAL — Fondo de Asistencia Laboral (Ley 27.802) %',
  detraccionContrib: 'Detracción de contribuciones (Ley 27.541) $ por trabajador',
  // Conceptos remunerativos
  pctPresentismo: 'Presentismo % — por defecto',
  pctAntiguedadPorAnio: 'Antigüedad por año % — por defecto',
  // Indemnización
  modoIndemnizacion: 'Modo de indemnización (art245 | fondo_cese)',
  mesesPeriodoPrueba: 'Período de prueba (meses)',
  // Topes y valores legales
  smvmMensual: 'SMVM — Salario Mínimo Vital y Móvil ($)',
  topeAportesMax: 'Tope base SIPA (máximo) $',
  topeAportesMin: 'Base imponible mínima SIPA $',
  f931TopeJub: 'F.931 — tope jubilación $',
  f931TopeOS: 'F.931 — tope Obra Social $',
  gan_topeRetencionPct: 'Ganancias — tope de retención (% del neto)',
  // Ganancias — topes de deducciones (RG 4003)
  gan_pctEducacionMni: 'Ganancias — deducción educación: tope (% del MNI)',
  gan_topePctDonaciones: 'Ganancias — donaciones: tope (% ganancia neta)',
  gan_pctAlquilerDeducible: 'Ganancias — alquiler: % deducible',
  gan_topePctHonorariosMed: 'Ganancias — honorarios médicos: % del gasto deducible',
  gan_pctCorredoresViajantes: 'Ganancias — corredores/viajantes de comercio: %',
  gan_pctServDomesticoMniMax: 'Ganancias — servicio doméstico: tope (% del MNI)',
  gan_topePctHonorariosMedGanNeta: 'Ganancias — honorarios médicos: tope (% ganancia neta)',
  // Datos de la empresa
  cbuEmpresa: 'CBU de la empresa (débito de haberes)',
  bancoEmpresa: 'Banco de la empresa',
};

interface Grupo { titulo: string; nota?: string; keys: string[]; }
const GROUPS: Grupo[] = [
  { titulo: 'Aportes del trabajador',
    nota: 'Los % de SIPA, Obra Social, ANSSAL y PAMI son nacionales (iguales para todas las empresas). La cuota sindical real se define por sindicato en el módulo “Sindicatos” y se aplica según el sindicato de cada empleado; el valor de acá es solo el respaldo por defecto.',
    keys: ['pctJubilacion', 'pctObraSocial', 'pctAnssal', 'pctPamiEmp', 'pctSindicatoEmp', 'nombreSindicato'] },
  { titulo: 'Contribuciones patronales',
    nota: 'La ART se configura por empresa en “ART por empresa”. El FAL puede diferir por empresa (MiPyME 2,5% / grandes 1%) y se puede fijar en la ficha de cada empresa. El “Fondo Nacional de Empleo (desempleo)” es la contribución patronal de la Ley 24.013 — distinto del FAL.',
    keys: ['pctJubPatronal', 'pctOsPatronal', 'pctPamiPatronal', 'pctDesempleo', 'pctArt', 'pctSindicatoPatronal', 'scvoPercapita', 'ffep', 'fondoCesePct', 'pctFal', 'detraccionContrib'] },
  { titulo: 'Conceptos remunerativos (por defecto)',
    nota: 'El presentismo, la antigüedad y los adicionales por título reales salen del sindicato/convenio de cada empleado. Estos son valores por defecto para quienes no tengan sindicato.',
    keys: ['pctPresentismo', 'pctAntiguedadPorAnio'] },
  { titulo: 'Indemnización / Ley Bases', keys: ['modoIndemnizacion', 'mesesPeriodoPrueba'] },
  { titulo: 'Topes y valores legales',
    nota: 'Se actualizan solos con el calendario oficial (SMVM y topes SIPA). No hace falta cargarlos a mano.',
    keys: ['smvmMensual', 'topeAportesMax', 'topeAportesMin', 'f931TopeJub', 'f931TopeOS', 'gan_topeRetencionPct'] },
  { titulo: 'Ganancias — topes de deducciones (RG 4003)',
    keys: ['gan_pctEducacionMni', 'gan_topePctDonaciones', 'gan_pctAlquilerDeducible', 'gan_topePctHonorariosMed', 'gan_pctCorredoresViajantes', 'gan_pctServDomesticoMniMax', 'gan_topePctHonorariosMedGanNeta'] },
  { titulo: 'Datos de la empresa (pagos)', keys: ['cbuEmpresa', 'bancoEmpresa'] },
];

export default function Parametros() {
  const { user } = useAuth();
  const canEdit = user?.role === 'rrhh' || user?.role === 'admin';
  const [data, setData] = useState<Data | null>(null);
  const [edits, setEdits] = useState<Data>({});
  const [info, setInfo] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<any[]>([]);
  const [verHist, setVerHist] = useState(false);

  async function load() {
    try {
      const r = await api.get<{ data: Data; updated_by?: string; updated_at?: string }>('/parametros');
      setData(r.data || {});
      if (r.updated_at) setInfo(`Última actualización: ${new Date(r.updated_at).toLocaleString('es-AR')}${r.updated_by ? ` por ${r.updated_by}` : ''}`);
      api.get<any[]>('/parametros/historial').then(setHist).catch(() => {});
    } catch (e: any) { setLoadErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  function setField(k: string, v: string, isNum: boolean) {
    setEdits({ ...edits, [k]: isNum ? (v === '' ? '' : Number(v)) : v });
  }
  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await api.put<{ data: Data }>('/parametros', edits);
      setData(r.data); setEdits({});
      setMsg({ t: 'Parámetros guardados', ok: true });
    } catch (e: any) { setMsg({ t: e.message, ok: false }); } finally { setBusy(false); }
  }

  if (!data) return loadErr ? <div className="err">⚠ {loadErr}</div> : <div className="muted">Cargando…</div>;
  const val = (k: string) => (k in edits ? edits[k] : data[k]);
  const usados = new Set(GROUPS.flatMap((g) => g.keys));
  const otros = Object.keys(data).filter((k) => !usados.has(k) && ['number', 'string'].includes(typeof data[k]));

  const renderField = (k: string) => {
    const isNum = typeof data[k] === 'number';
    return (
      <div className="field" key={k}>
        <label>{LABELS[k] || k}</label>
        <input className="input" disabled={!canEdit} type={isNum ? 'number' : 'text'} step="0.01"
          value={val(k) ?? ''} onChange={(e) => setField(k, e.target.value, isNum)} />
      </div>
    );
  };

  return (
    <>
      {info && <p className="muted" style={{ marginTop: -8 }}>{info}</p>}
      {!canEdit && <div className="muted" style={{ marginBottom: 12 }}>Solo lectura (requiere rol RR.HH. o admin para editar).</div>}

      {GROUPS.map((g) => (
        <div className="card" style={{ marginBottom: 14 }} key={g.titulo}>
          <h3 style={{ marginTop: 0, marginBottom: g.nota ? 4 : 10 }}>{g.titulo}</h3>
          {g.nota && <p className="muted" style={{ marginTop: 0, marginBottom: 10, fontSize: 12 }}>{g.nota}</p>}
          <div className="grid2">{g.keys.filter((k) => k in data).map(renderField)}</div>
        </div>
      ))}

      {otros.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>Otros parámetros</h3>
          <div className="grid2">{otros.map(renderField)}</div>
        </div>
      )}

      {hist.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Historial de cambios <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({hist.length})</span></h3>
            <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setVerHist((v) => !v)}>{verHist ? 'Ocultar' : 'Ver'}</button>
          </div>
          {verHist && (
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--bg2)' }}>{['Fecha', 'Parámetro', 'Antes', 'Después', 'Por'].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {hist.map((h) => (
                    <tr key={h.id}>
                      <td style={{ padding: '3px 8px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{new Date(h.created_at).toLocaleString('es-AR')}</td>
                      <td style={{ padding: '3px 8px' }}>{LABELS[h.campo] || h.campo}</td>
                      <td style={{ padding: '3px 8px', fontFamily: 'monospace' }} className="muted">{h.valor_anterior ?? '—'}</td>
                      <td style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{h.valor_nuevo ?? '—'}</td>
                      <td style={{ padding: '3px 8px' }} className="muted">{h.actor_dni || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {msg && <div className={msg.ok ? 'ok' : 'err'} style={{ marginBottom: 10 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
      {canEdit && <button className="btn" onClick={save} disabled={busy || Object.keys(edits).length === 0}>{busy ? 'Guardando…' : `Guardar cambios${Object.keys(edits).length ? ` (${Object.keys(edits).length})` : ''}`}</button>}
    </>
  );
}
