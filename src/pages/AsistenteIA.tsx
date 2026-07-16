import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Estado { disponible: boolean; provider?: string | null; modelo?: string | null; }
interface Enc { id: number; titulo: string; tipo?: string; }
interface Sol { id: number; empleadoNom: string; }

const TIPOS_BORRADOR = [
  { v: 'comunicado', l: 'Comunicado interno' },
  { v: 'descripcion-puesto', l: 'Descripción de puesto' },
  { v: 'objetivo', l: 'Objetivo / OKR' },
  { v: 'devolucion', l: 'Devolución de desempeño' },
  { v: 'politica', l: 'Política interna' },
];

export default function AsistenteIA() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [encs, setEncs] = useState<Enc[]>([]);
  const [sols, setSols] = useState<Sol[]>([]);
  const [salida, setSalida] = useState('');
  const [cargando, setCargando] = useState('');
  const [err, setErr] = useState('');

  // Borradores
  const [tipo, setTipo] = useState('comunicado');
  const [instr, setInstr] = useState('');
  // Resúmenes
  const [encSel, setEncSel] = useState<number | null>(null);
  const [solSel, setSolSel] = useState<number | null>(null);
  // CV
  const [cv, setCv] = useState('');
  const [perfil, setPerfil] = useState('');
  // Asistente
  const [preg, setPreg] = useState('');

  useEffect(() => {
    api.get<Estado>('/ia/estado').then(setEstado).catch(() => setEstado({ disponible: false }));
    api.get<Enc[]>('/encuestas').then((e) => { setEncs(e); if (e[0]) setEncSel(e[0].id); }).catch(() => {});
    api.get<Sol[]>('/desarrollo/feedback').then((s) => { setSols(s); if (s[0]) setSolSel(s[0].id); }).catch(() => {});
  }, []);

  async function run(label: string, fn: () => Promise<{ texto: string }>) {
    setErr(''); setSalida(''); setCargando(label);
    try { const r = await fn(); setSalida(r.texto || '(sin respuesta)'); }
    catch (e: any) { setErr(e.message); }
    finally { setCargando(''); }
  }
  const copiar = () => { navigator.clipboard?.writeText(salida); };

  if (estado && !estado.disponible) {
    return (
      <div className="card">
        <h4 style={{ marginTop: 0 }}>Asistente IA — no configurado</h4>
        <p className="muted" style={{ fontSize: 14 }}>
          Las funciones de IA están listas pero desactivadas. Para habilitarlas, definí en el backend la variable <code>IA_API_KEY</code> (y opcionalmente <code>IA_PROVIDER</code> / <code>IA_MODEL</code>) en el archivo <code>.env</code>, y reiniciá el servidor.
          Mientras tanto, el resto del portal funciona normalmente.
        </p>
      </div>
    );
  }

  return (
    <>
      {estado && <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 12 }}>IA activa · proveedor {estado.provider} · modelo {estado.modelo}. Los textos son borradores/sugerencias: revisalos antes de usarlos.</p>}
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 340px', minWidth: 300 }}>
          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ marginTop: 0 }}>Redactar un borrador</h4>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS_BORRADOR.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
            </div>
            <textarea className="input" rows={3} placeholder="Contá de qué se trata (tema, tono, datos clave)…" value={instr} onChange={(e) => setInstr(e.target.value)} style={{ marginBottom: 8 }} />
            <button className="btn" disabled={!!cargando || !instr.trim()} onClick={() => run('borrador', () => api.post('/ia/borrador', { tipo, instrucciones: instr }))}>{cargando === 'borrador' ? 'Generando…' : 'Generar borrador'}</button>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ marginTop: 0 }}>Encuestas</h4>
            <select className="input" style={{ marginBottom: 8 }} value={encSel ?? ''} onChange={(e) => setEncSel(Number(e.target.value))}>{encs.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}</select>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn ghost" disabled={!!cargando || !encSel} onClick={() => run('enc', () => api.post('/ia/resumir-encuesta', { encuestaId: encSel }))}>{cargando === 'enc' ? '…' : 'Resumir resultados'}</button>
              <button className="btn ghost" disabled={!!cargando || !encSel} onClick={() => run('clima', () => api.post('/ia/analizar-clima', { encuestaId: encSel }))}>{cargando === 'clima' ? '…' : 'Analizar clima'}</button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ marginTop: 0 }}>Feedback 360°</h4>
            <select className="input" style={{ marginBottom: 8 }} value={solSel ?? ''} onChange={(e) => setSolSel(Number(e.target.value))}>{sols.map((s) => <option key={s.id} value={s.id}>{s.empleadoNom}</option>)}</select>
            <button className="btn ghost" disabled={!!cargando || !solSel} onClick={() => run('fb', () => api.post('/ia/resumir-feedback', { solicitudId: solSel }))}>{cargando === 'fb' ? '…' : 'Resumir feedback'}</button>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ marginTop: 0 }}>Resumen de CV</h4>
            <textarea className="input" rows={3} placeholder="Pegá el texto del CV…" value={cv} onChange={(e) => setCv(e.target.value)} style={{ marginBottom: 8 }} />
            <input className="input" placeholder="Perfil buscado (opcional)" value={perfil} onChange={(e) => setPerfil(e.target.value)} style={{ marginBottom: 8 }} />
            <button className="btn ghost" disabled={!!cargando || !cv.trim()} onClick={() => run('cv', () => api.post('/ia/resumir-cv', { texto: cv, perfil }))}>{cargando === 'cv' ? '…' : 'Resumir y evaluar'}</button>
          </div>

          <div className="card">
            <h4 style={{ marginTop: 0 }}>Asistente</h4>
            <textarea className="input" rows={2} placeholder="Preguntá algo sobre gestión de RR.HH…." value={preg} onChange={(e) => setPreg(e.target.value)} style={{ marginBottom: 8 }} />
            <button className="btn ghost" disabled={!!cargando || !preg.trim()} onClick={() => run('asis', () => api.post('/ia/asistente', { pregunta: preg }))}>{cargando === 'asis' ? '…' : 'Preguntar'}</button>
          </div>
        </div>

        <div style={{ flex: '1 1 360px', minWidth: 300 }}>
          <div className="card" style={{ position: 'sticky', top: 64, minHeight: 200 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h4 style={{ marginTop: 0 }}>Resultado</h4>
              {salida && <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={copiar}>Copiar</button>}
            </div>
            {cargando ? <div className="muted">Pensando…</div>
              : salida ? <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{salida}</div>
              : <div className="muted" style={{ fontSize: 13 }}>Elegí una acción de la izquierda; el resultado aparece acá.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
