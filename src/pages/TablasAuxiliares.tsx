import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Tablas auxiliares del asiento de sueldos: las tres que en el Excel se mantienen
// a mano (TABLA OS, CATEGORIAS y los conceptos propios de cada gremio).

interface OS {
  cod_os: string; nombre: string; por_aporte: number; imp_aporte: number;
  por_reten: number; imp_reten: number; direccion: string | null; localidad: string | null;
  cp: string | null; telefono: string | null; activo: boolean;
}
interface Cat {
  cod_categoria: string; descripcion: string; hs_normal: number;
  hs_min_imp: number; di_min_imp: number; aplica_tope: boolean;
}

const TABS = [
  { key: 'os', label: 'Obras sociales (TABLA OS)' },
  { key: 'categorias', label: 'Categorías' },
] as const;

// Campo numérico que guarda al salir del foco, sin re-renderizar toda la tabla en cada tecla.
const Num = ({ valor, onGuardar, ancho = 90 }: { valor: number; onGuardar: (v: number) => void; ancho?: number }) => {
  const [v, setV] = useState(String(valor ?? 0));
  useEffect(() => { setV(String(valor ?? 0)); }, [valor]);
  return (
    <input className="input" style={{ width: ancho, padding: '2px 6px', textAlign: 'right', fontFamily: 'monospace' }}
      value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => { const n = Number(v.replace(',', '.')); if (!isNaN(n) && n !== Number(valor)) onGuardar(n); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
  );
};
const Txt = ({ valor, onGuardar, ancho = 150 }: { valor: string; onGuardar: (v: string) => void; ancho?: number }) => {
  const [v, setV] = useState(valor ?? '');
  useEffect(() => { setV(valor ?? ''); }, [valor]);
  return (
    <input className="input" style={{ width: ancho, padding: '2px 6px' }}
      value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== (valor ?? '')) onGuardar(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
  );
};

export default function TablasAuxiliares() {
  const [tab, setTab] = useState<string>('os');
  const [os, setOs] = useState<OS[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [busca, setBusca] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function cargar() {
    setErr('');
    try {
      const r = await api.get<{ obrasSociales: OS[]; categorias: Cat[] }>('/asiento-sueldos/auxiliares');
      setOs(r.obrasSociales); setCats(r.categorias);
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { cargar(); }, []);

  async function guardar(tabla: string, clave: string | number, campo: string, valor: any) {
    setErr(''); setMsg('');
    try {
      await api.put(`/asiento-sueldos/auxiliares/${tabla}/${encodeURIComponent(String(clave))}`, { [campo]: valor });
      setMsg('Guardado.');
      setTimeout(() => setMsg(''), 1500);
    } catch (e: any) { setErr(e.message); cargar(); }
  }

  const filtra = (txt: string) => !busca.trim() || txt.toLowerCase().includes(busca.trim().toLowerCase());

  return (
    <>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} className={t.key === tab ? 'btn' : 'btn ghost'}
            style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input className="input" style={{ maxWidth: 240 }} placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <p className="muted" style={{ marginTop: -4, marginBottom: 12 }}>
        Los aportes y contribuciones propios de cada gremio (INACAP, La Estrella, OSECAC, UOM) se administran en
        <strong> Tablas y configuración → Sindicatos</strong>, junto al resto de los parámetros del convenio.
      </p>

      {err && <div className="err" style={{ marginBottom: 10 }}>⚠ {err}</div>}
      {msg && <div className="ok" style={{ marginBottom: 10 }}>{msg}</div>}

      {tab === 'os' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <strong>Aportes y retenciones por obra social</strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              El código es el que lleva el legajo (OSECAC, UOM, OSDE…), no el código RNOS del padrón nacional.
              Los valores vienen del Excel de Contabilidad: revisalos antes de usarlos para liquidar.
            </div>
          </div>
          <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead><tr>
                <th style={{ textAlign: 'left' }}>COD_OS</th><th style={{ textAlign: 'left' }}>NOMBRE_OS</th>
                <th>POR_APORTE</th><th>IMP_APORTE</th><th>POR_RETEN</th><th>IMP_RETEN</th>
                <th style={{ textAlign: 'left' }}>DIRECCION</th><th style={{ textAlign: 'left' }}>LOCALIDAD</th>
                <th style={{ textAlign: 'left' }}>CP</th><th style={{ textAlign: 'left' }}>TELEFONO</th>
              </tr></thead>
              <tbody>
                {os.filter((o) => filtra(o.cod_os + ' ' + o.nombre)).map((o) => (
                  <tr key={o.cod_os}>
                    <td style={{ fontFamily: 'monospace' }}>{o.cod_os}</td>
                    <td><Txt valor={o.nombre} ancho={240} onGuardar={(v) => guardar('os', o.cod_os, 'nombre', v)} /></td>
                    <td><Num valor={Number(o.por_aporte)} onGuardar={(v) => guardar('os', o.cod_os, 'por_aporte', v)} /></td>
                    <td><Num valor={Number(o.imp_aporte)} onGuardar={(v) => guardar('os', o.cod_os, 'imp_aporte', v)} /></td>
                    <td><Num valor={Number(o.por_reten)} onGuardar={(v) => guardar('os', o.cod_os, 'por_reten', v)} /></td>
                    <td><Num valor={Number(o.imp_reten)} onGuardar={(v) => guardar('os', o.cod_os, 'imp_reten', v)} /></td>
                    <td><Txt valor={o.direccion || ''} onGuardar={(v) => guardar('os', o.cod_os, 'direccion', v)} /></td>
                    <td><Txt valor={o.localidad || ''} ancho={120} onGuardar={(v) => guardar('os', o.cod_os, 'localidad', v)} /></td>
                    <td><Txt valor={o.cp || ''} ancho={60} onGuardar={(v) => guardar('os', o.cod_os, 'cp', v)} /></td>
                    <td><Txt valor={o.telefono || ''} ancho={110} onGuardar={(v) => guardar('os', o.cod_os, 'telefono', v)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'categorias' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <strong>Parámetros por categoría</strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Horas normales de la jornada, horas y días mínimos imponibles y aplicación de tope. El básico de cada
              categoría sigue saliendo de la escala salarial vigente.
            </div>
          </div>
          <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead><tr>
                <th style={{ textAlign: 'left' }}>COD_CATEGO</th><th style={{ textAlign: 'left' }}>DESCRIP</th>
                <th>HS_NORMAL</th><th>HS_MIN_IMP</th><th>DI_MIN_IMP</th><th>APLICATOPE</th>
              </tr></thead>
              <tbody>
                {cats.filter((c) => filtra(c.cod_categoria + ' ' + c.descripcion)).map((c) => (
                  <tr key={c.cod_categoria}>
                    <td style={{ fontFamily: 'monospace' }}>{c.cod_categoria}</td>
                    <td><Txt valor={c.descripcion} ancho={240} onGuardar={(v) => guardar('categorias', c.cod_categoria, 'descripcion', v)} /></td>
                    <td><Num valor={Number(c.hs_normal)} onGuardar={(v) => guardar('categorias', c.cod_categoria, 'hs_normal', v)} /></td>
                    <td><Num valor={Number(c.hs_min_imp)} onGuardar={(v) => guardar('categorias', c.cod_categoria, 'hs_min_imp', v)} /></td>
                    <td><Num valor={Number(c.di_min_imp)} onGuardar={(v) => guardar('categorias', c.cod_categoria, 'di_min_imp', v)} /></td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={!!c.aplica_tope}
                        onChange={(e) => { setCats((s) => s.map((x) => x.cod_categoria === c.cod_categoria ? { ...x, aplica_tope: e.target.checked } : x)); guardar('categorias', c.cod_categoria, 'aplica_tope', e.target.checked); }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </>
  );
}
