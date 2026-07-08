import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

// Actualización masiva de legajos (réplica de las "operaciones masivas" de Tango):
// cambiar un mismo dato a un grupo de empleados de una sola vez.
interface Emp { id: number; nom: string; legNum: string; empresa: string; cat?: string; tramo?: string; [k: string]: any; }
interface Campo { key: string; label: string; }

export default function ActualizacionMasiva() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [empresa, setEmpresa] = useState('');
  const [q, setQ] = useState('');
  const [campo, setCampo] = useState('');
  const [valor, setValor] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setErr('');
      const [e, c] = await Promise.all([
        api.get<Emp[]>('/empleados?activos=true'),
        api.get<Campo[]>('/empleados/masivo/campos'),
      ]);
      setEmps(e); setCampos(c);
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  const empresas = useMemo(() => [...new Set(emps.map((e) => e.empresa).filter(Boolean))].sort(), [emps]);
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return emps.filter((e) =>
      (!empresa || e.empresa === empresa) &&
      (!t || e.nom.toLowerCase().includes(t) || String(e.legNum).includes(t)));
  }, [emps, empresa, q]);

  const valActual = (e: Emp) => { const v = e[campo]; return v == null || v === '' ? '—' : String(v); };
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todosFiltrados = filtrados.length > 0 && filtrados.every((e) => sel.has(e.id));
  function toggleTodos() {
    setSel((s) => {
      const n = new Set(s);
      if (todosFiltrados) filtrados.forEach((e) => n.delete(e.id));
      else filtrados.forEach((e) => n.add(e.id));
      return n;
    });
  }

  async function aplicar() {
    setErr(''); setMsg('');
    const ids = filtrados.filter((e) => sel.has(e.id)).map((e) => e.id);
    if (!campo) return setErr('Elegí el dato a cambiar.');
    if (!valor.trim()) return setErr('Ingresá el nuevo valor.');
    if (!ids.length) return setErr('Seleccioná al menos un empleado.');
    const lbl = campos.find((c) => c.key === campo)?.label || campo;
    if (!window.confirm(`Vas a cambiar "${lbl}" a "${valor.trim()}" en ${ids.length} legajo(s). ¿Confirmás?`)) return;
    try {
      setBusy(true);
      const r = await api.post<{ actualizados: number; sinCambio: number; errores: string[]; total: number }>(
        '/empleados/masivo', { ids, campo, valor: valor.trim() });
      setMsg(`Listo: ${r.actualizados} actualizado(s), ${r.sinCambio} sin cambios${r.errores.length ? `, ${r.errores.length} con error` : ''}.`);
      if (r.errores.length) setErr(r.errores.slice(0, 5).join(' · '));
      setSel(new Set()); setValor('');
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      {err && <div className="err" style={{ marginBottom: 12 }}>⚠ {err}</div>}
      {msg && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--green)', color: 'var(--green)' }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label className="muted" style={{ fontSize: 12 }}>Dato a cambiar</label><br />
            <select className="input" style={{ minWidth: 220 }} value={campo} onChange={(e) => setCampo(e.target.value)}>
              <option value="">Elegí un dato…</option>
              {campos.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="muted" style={{ fontSize: 12 }}>Nuevo valor{campo === 'os_codigo' ? ' (cód. RNOS)' : ''}</label><br />
            <input className="input" style={{ minWidth: 220 }} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Nuevo valor para todos los seleccionados" />
          </div>
          <button className="btn primary" disabled={busy} onClick={aplicar}>{busy ? 'Aplicando…' : `Aplicar a seleccionados (${filtrados.filter((e) => sel.has(e.id)).length})`}</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>El cambio queda registrado en el histórico de cada legajo y se sincroniza con su período vigente.</div>
      </div>

      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <select className="input" style={{ maxWidth: 220 }} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="">Todas las empresas</option>
          {empresas.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Buscar por nombre o legajo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted" style={{ alignSelf: 'center', fontSize: 13 }}>{filtrados.length} empleado(s) · {sel.size} seleccionado(s)</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr>
            <th style={{ width: 34 }}><input type="checkbox" checked={todosFiltrados} onChange={toggleTodos} title="Seleccionar todos los filtrados" /></th>
            <th>Empleado</th><th>Legajo</th><th>Empresa</th>
            <th>{campo ? (campos.find((c) => c.key === campo)?.label + ' (actual)') : 'Valor actual'}</th>
          </tr></thead>
          <tbody>
            {filtrados.map((e) => (
              <tr key={e.id} style={sel.has(e.id) ? { background: 'rgba(61,127,255,.08)' } : undefined}>
                <td><input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} /></td>
                <td>{e.nom}</td>
                <td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.legNum}</td>
                <td>{e.empresa}</td>
                <td className="muted">{campo ? valActual(e) : '—'}</td>
              </tr>
            ))}
            {!filtrados.length && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin empleados para el filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
