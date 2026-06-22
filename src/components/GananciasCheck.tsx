// src/components/GananciasCheck.tsx
// Chequeo previo a la liquidación: verifica que estén vigentes y correctas, para
// el semestre del período (RG 4003), TANTO las tablas de deducciones (art. 30)
// COMO la escala de cálculo del impuesto (art. 94). Se actualiza al cambiar el período.
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Verif {
  ok: boolean;
  semOk: boolean;
  dedOk: boolean;
  escOk: boolean;
  periodoEsperado: string;
  periodoVigente: string | null;
  vigenciaDesde?: string | null;
  rg?: string | null;
  valores: { mni: number; dedEsp: number; dedEsp2: number; conyuge: number; hijo: number; hijoInc: number } | null;
  escala: { tramos: number; primerTramoHasta: number | null; alicuotaMax: number | null; fijoMax: number | null; excedenteMax: number | null } | null;
  mensaje: string;
}
const money = (n: any) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GananciasCheck({ anio, mes }: { anio: number; mes: number }) {
  const [v, setV] = useState<Verif | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let vivo = true;
    api.get<Verif>(`/ganancias/verificacion?anio=${anio}&mes=${mes}`).then((r) => { if (vivo) setV(r); }).catch(() => {});
    return () => { vivo = false; };
  }, [anio, mes]);
  if (!v) return null;

  const color = v.ok ? 'rgba(34,197,94,.30)' : 'rgba(234,179,8,.40)';
  const bg = v.ok ? 'rgba(34,197,94,.06)' : 'rgba(234,179,8,.08)';
  const chip = (okv: boolean, label: string) => (
    <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 999, marginLeft: 6, whiteSpace: 'nowrap', color: okv ? 'var(--green)' : 'var(--yellow)', border: `1px solid ${okv ? 'rgba(34,197,94,.4)' : 'rgba(234,179,8,.5)'}` }}>
      {okv ? '✓' : '⚠'} {label}
    </span>
  );

  return (
    <div className="card" style={{ margin: '8px 0 4px', padding: '8px 12px', fontSize: 13, background: bg, border: `1px solid ${color}` }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ color: v.ok ? 'var(--green)' : 'var(--yellow)' }}>
          {v.ok ? '✓ ' : '⚠ '}{v.mensaje}
          {chip(v.dedOk, 'Deducciones art. 30')}
          {chip(v.escOk, 'Escala art. 94')}
        </span>
        {(v.valores || v.escala) && (
          <button className="btn ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => setOpen(!open)}>
            {open ? 'Ocultar valores' : 'Ver tablas'}
          </button>
        )}
      </div>
      {open && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
          {v.valores && (
            <div><b>Deducciones (art. 30):</b> GNI {money(v.valores.mni)} · Ded. especial {money(v.valores.dedEsp)} · Cónyuge {money(v.valores.conyuge)} · Hijo {money(v.valores.hijo)} · Hijo c/disc. {money(v.valores.hijoInc)}</div>
          )}
          {v.escala && (
            <div style={{ marginTop: 2 }}><b>Escala (art. 94):</b> {v.escala.tramos} tramos · 1er tramo hasta {money(v.escala.primerTramoHasta)} · alícuota máx. {v.escala.alicuotaMax}% sobre excedente de {money(v.escala.excedenteMax)} (fijo {money(v.escala.fijoMax)})</div>
          )}
          {v.rg && <div style={{ marginTop: 2 }}>{v.rg}</div>}
        </div>
      )}
    </div>
  );
}
