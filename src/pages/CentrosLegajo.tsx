import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';

// Asignación de centro de costos y centro de operaciones por legajo.
// Son los dos ejes con los que se abre el asiento contable de sueldos.

interface Fila {
  id: number; leg_num: string; nom: string; empresa: string; activo: boolean;
  centro_costo: string | null; centro_operacion: string | null; lugar: string | null;
  cod_plan_os: string | null; imp_plan_os: string | null; cod_os: string | null; cuil: string | null;
}
interface CentroOp { codigo: string; denominacion: string; }

export default function CentrosLegajo() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [centrosCosto, setCentrosCosto] = useState<string[]>([]);
  const [centrosOper, setCentrosOper] = useState<CentroOp[]>([]);
  type Patch = { centroCosto?: string; centroOperacion?: string; codPlanOs?: string; impPlanOs?: number };
  const [cambios, setCambios] = useState<Record<number, Patch>>({});
  const [busca, setBusca] = useState('');
  const [soloFaltantes, setSoloFaltantes] = useState(false);
  const [soloActivos, setSoloActivos] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function cargar() {
    setErr('');
    try {
      const r = await api.get<{ legajos: Fila[]; centrosCosto: string[]; centrosOperacion: CentroOp[] }>('/asiento-sueldos/centros');
      setFilas(r.legajos); setCentrosCosto(r.centrosCosto); setCentrosOper(r.centrosOperacion); setCambios({});
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { cargar(); }, []);

  const ORIG: Record<string, keyof Fila> = {
    centroCosto: 'centro_costo', centroOperacion: 'centro_operacion',
    codPlanOs: 'cod_plan_os', impPlanOs: 'imp_plan_os',
  };
  const valor = (f: Fila, campo: keyof Patch) => {
    const c = cambios[f.id];
    if (c && c[campo] !== undefined) return String(c[campo]);
    return String(f[ORIG[campo]] ?? '');
  };
  const setValor = (f: Fila, campo: keyof Patch, v: string) =>
    setCambios((s) => ({ ...s, [f.id]: { ...s[f.id], [campo]: campo === 'impPlanOs' ? (Number(v) || 0) : v } }));

  const visibles = useMemo(() => filas.filter((f) => {
    if (soloActivos && f.activo === false) return false;
    if (soloFaltantes && valor(f, 'centroCosto') && valor(f, 'centroOperacion')) return false;
    if (!busca.trim()) return true;
    const t = busca.trim().toLowerCase();
    return f.nom.toLowerCase().includes(t) || String(f.leg_num).toLowerCase().includes(t);
  }), [filas, busca, soloFaltantes, soloActivos, cambios]);

  const faltantes = filas.filter((f) => f.activo !== false && (!valor(f, 'centroCosto') || !valor(f, 'centroOperacion'))).length;
  const pendientes = Object.keys(cambios).length;

  async function guardar() {
    setErr(''); setMsg(''); setGuardando(true);
    try {
      const asignaciones = Object.entries(cambios).map(([id, c]) => ({ id: Number(id), ...c }));
      const r = await api.put<{ actualizados: number }>('/asiento-sueldos/centros', { asignaciones });
      setMsg(`${r.actualizados} legajo(s) actualizado(s).`);
      await cargar();
    } catch (e: any) { setErr(e.message); }
    finally { setGuardando(false); }
  }

  function plantilla() {
    const aoa = [['LEGAJO', 'APELLIDO Y NOMBRE', 'EMPRESA', 'CENTRO DE COSTOS', 'CENTRO DE OPERACIONES', 'COD_PLAN', 'IMP_PLAN']];
    for (const f of filas) aoa.push([f.leg_num, f.nom, f.empresa, valor(f, 'centroCosto'), valor(f, 'centroOperacion'), valor(f, 'codPlanOs'), valor(f, 'impPlanOs')]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Centros por legajo');
    XLSX.writeFile(wb, 'Centros por legajo.xlsx');
  }

  // Importa un Excel con columnas LEGAJO / CENTRO DE COSTOS / CENTRO DE OPERACIONES.
  // No guarda: deja los valores cargados en la grilla para revisar antes de confirmar.
  async function importar(file: File) {
    setErr(''); setMsg('');
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      const datos = XLSX.utils.sheet_to_json<Record<string, any>>(hoja, { defval: '' });
      const norm = (s: any) => String(s ?? '').replace(/\D/g, '');
      const porLeg = new Map(filas.map((f) => [norm(f.leg_num), f]));
      const nuevos: Record<number, { centroCosto?: string; centroOperacion?: string }> = {};
      let sinMatch = 0;
      for (const d of datos) {
        const clave = Object.keys(d).find((k) => /legajo/i.test(k));
        const kcc = Object.keys(d).find((k) => /costo/i.test(k));
        const kco = Object.keys(d).find((k) => /operaci/i.test(k));
        const kpl = Object.keys(d).find((k) => /cod[_ ]?plan/i.test(k));
        const kim = Object.keys(d).find((k) => /imp[_ ]?plan/i.test(k));
        const f = porLeg.get(norm(clave ? d[clave] : ''));
        if (!f) { sinMatch++; continue; }
        const cc = kcc ? String(d[kcc]).trim().toLowerCase() : '';
        const co = kco ? String(d[kco]).trim() : '';
        const patch: Patch = {};
        if (cc && cc !== (f.centro_costo || '')) patch.centroCosto = cc;
        if (co && co !== (f.centro_operacion || '')) patch.centroOperacion = co;
        if (kpl && String(d[kpl]).trim() && String(d[kpl]).trim() !== (f.cod_plan_os || '')) patch.codPlanOs = String(d[kpl]).trim();
        if (kim && String(d[kim]).trim() && Number(d[kim]) !== Number(f.imp_plan_os || 0)) patch.impPlanOs = Number(d[kim]) || 0;
        if (Object.keys(patch).length) nuevos[f.id] = patch;
      }
      setCambios((s) => ({ ...s, ...nuevos }));
      setMsg(`Importadas ${Object.keys(nuevos).length} asignaciones${sinMatch ? ` (${sinMatch} legajo/s del archivo no existen en el padrón)` : ''}. Revisá y guardá.`);
    } catch (e: any) { setErr('No se pudo leer el archivo: ' + e.message); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div><div className="muted" style={{ fontSize: 12 }}>Legajos</div><strong style={{ fontSize: 18 }}>{filas.length}</strong></div>
          <div><div className="muted" style={{ fontSize: 12 }}>Sin asignar</div>
            <strong style={{ fontSize: 18, color: faltantes ? 'var(--red)' : 'var(--green)' }}>{faltantes}</strong></div>
          <div><div className="muted" style={{ fontSize: 12 }}>Cambios sin guardar</div><strong style={{ fontSize: 18 }}>{pendientes}</strong></div>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={guardar} disabled={!pendientes || guardando}>{guardando ? 'Guardando…' : `Guardar ${pendientes || ''}`}</button>
          <button className="btn ghost" onClick={plantilla}>⬇ Exportar / plantilla</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>⬆ Importar Excel</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); }} />
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 10 }}>
          El centro de costos define a qué cuenta de resultado va el sueldo de cada legajo (413001 comercialización, 413002 producción,
          413003 administración, 413014 Post Venta, 413015 Marketing, 413020 Desarrollo) y el centro de operaciones es la segunda
          apertura del asiento. Sin estos dos datos el asiento sale agrupado en blanco.
        </p>
      </div>

      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="ok" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="row" style={{ gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Buscar por legajo o apellido…"
          value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label className="row" style={{ gap: 5, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={soloFaltantes} onChange={(e) => setSoloFaltantes(e.target.checked)} /> Sólo sin asignar
        </label>
        <label className="row" style={{ gap: 5, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} /> Sólo activos
        </label>
        <span className="muted" style={{ fontSize: 12 }}>{visibles.length} de {filas.length}</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead><tr>
              <th style={{ textAlign: 'left' }}>Legajo</th>
              <th style={{ textAlign: 'left' }}>Apellido y nombre</th>
              <th style={{ textAlign: 'left' }}>Empresa</th>
              <th style={{ textAlign: 'left' }}>Centro de costos</th>
              <th style={{ textAlign: 'left' }}>Centro de operaciones</th>
              <th style={{ textAlign: 'left' }}>Obra social</th>
              <th style={{ textAlign: 'left' }}>COD_PLAN</th>
              <th style={{ textAlign: 'left' }}>IMP_PLAN</th>
              <th style={{ textAlign: 'left' }}>Lugar de trabajo</th>
            </tr></thead>
            <tbody>
              {visibles.map((f) => {
                const cc = valor(f, 'centroCosto'), co = valor(f, 'centroOperacion');
                const tocado = !!cambios[f.id];
                return (
                  <tr key={f.id} style={tocado ? { background: 'rgba(61,127,255,.08)' } : undefined}>
                    <td style={{ fontFamily: 'monospace' }}>{f.leg_num}</td>
                    <td>{f.nom}{f.activo === false && <span className="badge" style={{ marginLeft: 6 }}>baja</span>}</td>
                    <td className="muted">{f.empresa}</td>
                    <td>
                      <select className="input" style={{ padding: '2px 6px', minWidth: 110, borderColor: cc ? undefined : 'var(--red)' }}
                        value={cc} onChange={(e) => setValor(f, 'centroCosto', e.target.value)}>
                        <option value="">— sin asignar —</option>
                        {centrosCosto.map((c) => <option key={c} value={c}>{c}</option>)}
                        {cc && !centrosCosto.includes(cc) && <option value={cc}>{cc} (fuera del plan)</option>}
                      </select>
                    </td>
                    <td>
                      <select className="input" style={{ padding: '2px 6px', minWidth: 170, borderColor: co ? undefined : 'var(--red)' }}
                        value={co} onChange={(e) => setValor(f, 'centroOperacion', e.target.value)}>
                        <option value="">— sin asignar —</option>
                        {centrosOper.map((c) => <option key={c.codigo} value={c.denominacion}>{c.denominacion}</option>)}
                        {co && !centrosOper.some((c) => c.denominacion === co) && <option value={co}>{co} (no está en el maestro)</option>}
                      </select>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {f.cod_os || '—'}
                      {!f.cuil && <span className="badge" style={{ marginLeft: 6, color: 'var(--red)' }}>sin CUIL</span>}
                    </td>
                    <td>
                      <input className="input" style={{ width: 90, padding: '2px 6px' }}
                        value={valor(f, 'codPlanOs')} onChange={(e) => setValor(f, 'codPlanOs', e.target.value)} />
                    </td>
                    <td>
                      <input className="input" style={{ width: 90, padding: '2px 6px', textAlign: 'right', fontFamily: 'monospace' }}
                        value={valor(f, 'impPlanOs')} onChange={(e) => setValor(f, 'impPlanOs', e.target.value)} />
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{f.lugar || '—'}</td>
                  </tr>
                );
              })}
              {!visibles.length && <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 16 }}>Sin legajos para el filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
