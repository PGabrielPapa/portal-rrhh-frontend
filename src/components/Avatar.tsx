import type { CSSProperties } from 'react';

// Avatar reutilizable: muestra la foto del empleado (JPG en base64) o sus iniciales.
export default function Avatar({ nombre, foto, size = 32 }: { nombre?: string; foto?: string | null; size?: number }) {
  const ini = String(nombre || '').replace(/,/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const base: CSSProperties = { width: size, height: size, borderRadius: '50%', flexShrink: 0 };
  if (foto) return <img src={foto} alt={nombre || ''} style={{ ...base, objectFit: 'cover', border: '1px solid var(--border)' }} />;
  return (
    <div style={{ ...base, background: 'var(--accent-glow)', border: '1px solid rgba(61,127,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.38), fontWeight: 700, color: 'var(--accent2)' }}>
      {ini}
    </div>
  );
}
