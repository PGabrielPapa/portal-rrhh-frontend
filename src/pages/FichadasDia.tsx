import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface EmpDia {
  empleado_id: number; leg_num: string; nom: string; empresa: string;
  entrada: string; salida: string; hsNetas: string; estado: string; tarde: string;
  turno: string; comentario: string; laborable: boolean; ficho: boolean; sinFichar: boolean;
  marcas: string[];
}
interface DiaResp { fecha: string; empleados: EmpDia[]; resumen: { total: number; ficharon: number; sinFichar: number }; }

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Cada key de menú define el alcance.
const SCOPE: Record<string, 'mias' | 'equipo' | 'todas'> = {
  'mis-fichadas': 'mias',
  'fichadas-dia-equipo': 'equipo',
  'fichadas-dia': 'todas',
};

export default function FichadasDia() {
  const { key } = useParams();
  const scope = SCOPE[key || ''] || 'mias';
  const [fecha, setFecha] = useState(hoyISO());
  const [data, setData] = useState<DiaResp | null>(null);
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [soloSinFichar, setSoloSinFichar] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(''); setBusy(true);
    try {
      const r = await api.get<DiaResp>(`/prosoft/dia?scope=${scope}&fecha=${fecha}`);
      setData(r);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fecha]);

  const empleados = data?.empleados || [];
  const empresas = [...new Set(empleados.map((e) => e.empresa).filter(Boolean))].sort();
  let visibles = empresaFiltro ? empleados.filter((e) => e.empresa === empresaFiltro) : empleados;
  if (soloSinFichar) visibles = visibles.filter((e) => e.sinFichar);

  const esMias = scope === 'mias';

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 14 }}>
        {esMias
          ? 'Tus marcas del día (entrada, salida, estado), en vivo desde el reloj. Elegí una fecha para ver días anteriores.'
          : scope === 'equipo'
            ? 'Fichadas del día de tu equipo, en vivo. Los que debían trabajar y no ficharon aparecen en rojo arriba.'
            : 'Fichadas del día de toda la empresa, en vivo desde el reloj. Los que no ficharon (día laborable, sin licencia) aparecen en rojo.'}
      </p>

      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field"><label>Fecha</label>
            <input className="input" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <button className="btn" onClick={load} disabled={busy}>{busy ? '…' : '🔄 Actualizar'}</button>
          {!esMias && empresas.length > 1 && (
            <div className="field"><label>Empresa</label>
              <select className="input" value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)}>
                <option value="">Todas</option>
                {empresas.map((em) => <option key={em} value={em}>{em}</option>)}
              </select>
            </div>
          )}
          {!esMias && data && data.resumen.sinFichar > 0 && (
            <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={soloSinFichar} onChange={(e) => setSoloSinFichar(e.target.checked)} />
              Solo sin fichar
            </label>
          )}
        </div>
      </div>

      {esMias ? (
        <MiDia emp={empleados[0]} fecha={fecha} />
      ) : (
        <>
          {data && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
                <Stat n={data.resumen.total} label="Personas" />
                <Stat n={data.resumen.ficharon} label="Ficharon" color="#16a34a" />
                <Stat n={data.resumen.sinFichar} label="Sin fichar" color={data.resumen.sinFichar ? '#dc2626' : undefined} />
              </div>
            </div>
          )}
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead><tr><th>Legajo</th><th>Empleado</th><th>Empresa</th><th>Entrada</th><th>Salida</th><th>Estado</th><th style={{ textAlign: 'right' }}>Tarde</th></tr></thead>
              <tbody>
                {visibles.map((e) => (
                  <tr key={e.empleado_id} style={{ background: e.sinFichar ? 'rgba(220,38,38,.12)' : (e.comentario ? 'rgba(37,99,235,.06)' : undefined) }}>
                    <td className="muted">{e.leg_num}</td>
                    <td>{e.nom}</td>
                    <td className="muted">{e.empresa}</td>
                    <td>{e.entrada || '—'}</td>
                    <td>{e.salida || '—'}</td>
                    <td>{e.sinFichar
                      ? <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ SIN FICHAR</span>
                      : e.comentario
                        ? <span style={{ color: '#2563eb' }}>{e.comentario}</span>
                        : <span className="muted">{e.estado || (e.ficho ? 'Presente' : (e.laborable ? '—' : 'No laborable'))}</span>}
                    </td>
                    <td style={{ textAlign: 'right', color: e.tarde && e.tarde !== '00:00' ? '#d97706' : undefined }}>{e.tarde && e.tarde !== '00:00' ? e.tarde : '—'}</td>
                  </tr>
                ))}
                {!visibles.length && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>{data ? 'Sin datos para esta fecha/filtro.' : 'Cargando…'}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function MiDia({ emp, fecha }: { emp?: EmpDia; fecha: string }) {
  if (!emp) return <div className="card"><span className="muted">No hay datos tuyos para el {fecha}.</span></div>;
  return (
    <div className="card">
      <div className="row" style={{ gap: 28, flexWrap: 'wrap' }}>
        <Stat txt={emp.entrada || '—'} label="Entrada" />
        <Stat txt={emp.salida || '—'} label="Salida" />
        <Stat txt={emp.hsNetas || '—'} label="Horas netas" />
        <Stat txt={emp.tarde && emp.tarde !== '00:00' ? emp.tarde : '—'} label="Tardanza" color={emp.tarde && emp.tarde !== '00:00' ? '#d97706' : undefined} />
      </div>
      <div style={{ marginTop: 12, fontSize: 13 }}>
        Estado: {emp.sinFichar
          ? <b style={{ color: '#dc2626' }}>Sin fichar</b>
          : emp.comentario
            ? <b style={{ color: '#2563eb' }}>{emp.comentario}</b>
            : <b>{emp.estado || (emp.ficho ? 'Presente' : (emp.laborable ? 'Sin marca' : 'No laborable'))}</b>}
        {emp.marcas.length > 0 && <span className="muted"> · Marcas: {emp.marcas.join(' · ')}</span>}
      </div>
    </div>
  );
}

function Stat({ n, txt, label, color }: { n?: number; txt?: string; label: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 23, fontWeight: 700, color }}>{txt ?? n}</div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}
