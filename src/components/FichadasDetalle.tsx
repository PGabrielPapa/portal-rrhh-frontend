// Detalle diario de fichadas + tipos y helpers compartidos.
// Lo usan tanto la consulta de RR.HH. como el panel del responsable directo.
// La prop `gerente` adapta la vista del responsable directo: oculta las horas
// A FAVOR del banco (eso lo controla solo RR.HH.) y resalta las faltas
// injustificadas. Lo que se liquida = horas extra + tiempo en contra.

export function minToHhmm(min: number): string {
  const neg = min < 0;
  const a = Math.abs(Math.round(min || 0));
  const h = Math.floor(a / 60), m = a % 60;
  return `${neg ? '-' : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type Estado = 'ok' | 'no-laborable' | 'revisar' | 'licencia' | 'licencia-portal' | 'injustificado' | 'home-office';

export type TipoDia = 'habil' | 'sabado' | 'domingo' | 'feriado';
export interface DiaDetalle {
  fecha: string; dia: string; entrada?: string; salida?: string; marcas?: string; nMarcas?: number; intermedioMin?: number; computarIntermedio?: boolean;
  hsNetasMin: number; hsNormalMin: number; saldoMin: number | null; tipoDia?: TipoDia;
  extra50Min: number; extra100Min: number; extraComputa: boolean;
  tardeMin: number; completa: boolean; estado: Estado;
  comentario?: string; licenciaPortal?: string | null;
  sinLicenciaPortal?: boolean; licenciaConflicto?: boolean; licenciaSoloPortal?: boolean;
}
export interface DiaRevisar { fecha: string; motivo: string; tarde?: string; }
export interface FichadaData {
  legajoProsoft?: string; diasTrabajados?: number; horasExtra50Min?: number; horasExtra100Min?: number;
  horasExtraDescartadaMin?: number; tardanzasMin?: number; diasTardanza?: number;
  diasARevisar?: DiaRevisar[]; bancoNetoMin?: number; aRecuperarMin?: number; dias?: DiaDetalle[];
  licenciasProsoft?: Record<string, number>; diasLicencia?: number; diasInjustificados?: number;
  diasLicenciaConflicto?: number;
}

// Estado del circuito de aprobación de la novedad del período.
export type EstadoAprob = 'pendiente' | 'aprob_rrhh' | 'autorizada' | 'observada';

export function aprobBadge(estado?: EstadoAprob) {
  switch (estado) {
    case 'aprob_rrhh': return <span style={{ color: '#2563eb', fontWeight: 600 }}>Aprob. RR.HH. — espera gerente</span>;
    case 'autorizada': return <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Autorizada (liquidable)</span>;
    case 'observada': return <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ Observada</span>;
    default: return <span style={{ color: '#d97706' }}>Pendiente</span>;
  }
}

export function estadoBadge(e: Estado) {
  switch (e) {
    case 'ok': return <span style={{ color: '#16a34a' }}>OK</span>;
    case 'no-laborable': return <span className="muted">sáb/dom/feriado (extra)</span>;
    case 'revisar': return <span style={{ color: '#d97706' }}>⚠ revisar (marca incompleta)</span>;
    case 'licencia': return <span style={{ color: '#2563eb' }}>licencia</span>;
    case 'licencia-portal': return <span style={{ color: '#2563eb' }}>licencia (portal)</span>;
    case 'injustificado': return <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ INJUSTIFICADO</span>;
    case 'home-office': return <span style={{ color: '#16a34a' }}>Home Office (trabajado)</span>;
  }
}
function bgFila(x: DiaDetalle) {
  if (x.licenciaConflicto) return 'rgba(220,38,38,.12)';
  if (x.estado === 'revisar') return 'rgba(217,119,6,.10)';
  if (x.estado === 'injustificado') return 'rgba(220,38,38,.10)';
  if ((x.intermedioMin || 0) > 0 && !x.computarIntermedio) return 'rgba(217,119,6,.09)'; // intervalo intermedio sin resolver → revisar
  if (x.estado === 'licencia' || x.estado === 'licencia-portal') return 'rgba(37,99,235,.07)';
  return undefined;
}
function novedadDe(x: DiaDetalle) {
  if (x.licenciaConflicto) return <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ {x.licenciaPortal || 'Licencia'} aprobada — pero HAY MARCAS (no la tomó)</span>;
  if (x.comentario) return <span style={{ color: '#2563eb' }}>{x.comentario}{x.sinLicenciaPortal ? <span style={{ color: '#d97706' }}> · ⚠ no está cargada en el portal</span> : ''}</span>;
  if (x.licenciaPortal) return <span style={{ color: '#2563eb' }}>{x.licenciaPortal} (portal){x.licenciaSoloPortal ? <span style={{ color: '#d97706' }}> · ⚠ no figura en el reloj</span> : ''}</span>;
  return <span className="muted">—</span>;
}

// Lo liquidable del mes. Los totales ya vienen calculados por el backend con el
// "banco compensatorio corrido": neto trabajado desde las marcas (E1/S1..E4/S4)
// vs jornada (9 o 10 hs), el déficit se compensa con el a favor de otros días
// hábiles; lo que sobra de un día por +30 min es extra 50 %, y ≤30 min va al
// banco. Sábado = extra 50 %, domingo/feriado = extra 100 % (no compensan).
export function calcLiquidable(d: FichadaData) {
  const extra50 = d.horasExtra50Min || 0;
  const extra100 = d.horasExtra100Min || 0;
  const extraLiquidable = extra50 + extra100;
  const banco = d.bancoNetoMin || 0;                    // + a favor / − a recuperar
  const aFavor = banco > 0 ? banco : 0;
  const aRecuperar = banco < 0 ? -banco : (d.aRecuperarMin || 0);
  const inj = d.diasInjustificados || 0;
  return { banco, extra50, extra100, extraLiquidable, aFavor, aRecuperar, inj };
}

export function DetalleDias({ d, nom, gerente = false, onAjusteIntervalo }: { d: FichadaData; nom: string; gerente?: boolean; onAjusteIntervalo?: (fecha: string, computar: boolean) => void }) {
  const dias = d.dias || [];
  if (!dias.length) return <span className="muted">Sin detalle diario para este empleado (importado con una versión anterior; reimportá el período).</span>;
  // "Extra/saldo del día": el saldo a favor del día (neto − jornada). En hábiles
  // puede compensar déficit de otros días; en sábado/domingo/feriado es extra directo.
  const extraDe = (x: DiaDetalle) => {
    const s = typeof x.saldoMin === 'number' ? x.saldoMin : null;
    if (s == null || s <= 0) return '—';
    const t = x.tipoDia;
    if (t === 'domingo' || t === 'feriado') return minToHhmm(s) + ' (100%)';
    if (t === 'sabado') return minToHhmm(s) + ' (50%)';
    return minToHhmm(s) + (s <= 30 ? ' (banco)' : ' (50%)');
  };
  const { banco, extra50, extra100, extraLiquidable, aRecuperar, inj } = calcLiquidable(d);
  const conIntervalo = dias.filter((x) => (x.intermedioMin || 0) > 0 && !x.computarIntermedio).length;
  // El gerente NO ve el saldo a favor: se oculta la columna de saldo diario.
  const verSaldo = !gerente;

  return (
    <div style={{ overflow: 'auto' }}>
      <div style={{ margin: '8px 2px 10px', padding: '8px 10px', background: 'rgba(22,163,74,.07)', borderRadius: 6, fontSize: 12.5 }}>
        {!gerente && banco > 0 && <>Banco de horas a favor: <b style={{ color: '#16a34a' }}>{minToHhmm(banco)}</b> · </>}
        {aRecuperar > 0 && <>Tiempo a recuperar <b style={{ color: '#dc2626' }}>{minToHhmm(aRecuperar)}</b> · </>}
        <b>Extra a liquidar: <span style={{ color: extraLiquidable > 0 ? '#16a34a' : undefined }}>{minToHhmm(extraLiquidable)}</span></b>
        <span className="muted"> (50%: {minToHhmm(extra50)} · 100%: {minToHhmm(extra100)})</span>
        {inj > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}> · ⚠ Faltas injustificadas: {inj}</span>}
        {conIntervalo > 0 && <span style={{ color: '#d97706', fontWeight: 600 }}> · ⚠ {conIntervalo} día(s) con intervalo intermedio a revisar (¿almuerzo?)</span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, margin: '8px 2px 6px' }}>Detalle diario de {nom}{verSaldo ? ' — neto trabajado entre marcas vs jornada. El déficit se compensa con el a favor de otros días hábiles; sábado/domingo/feriado no compensan.' : ''}</div>
      <table style={{ fontSize: 12.5 }}>
        <thead><tr>
          <th>Fecha</th><th>Día</th><th>Fichadas (entrada–salida)</th>
          <th style={{ textAlign: 'right' }}>Hs Netas</th><th style={{ textAlign: 'right' }}>Jornada</th>
          {verSaldo && <th style={{ textAlign: 'right' }}>Saldo día</th>}
          <th style={{ textAlign: 'right' }}>Extra</th>
          <th style={{ textAlign: 'right' }}>Tarde</th><th>Estado</th><th>Novedad / Licencia</th>
        </tr></thead>
        <tbody>
          {dias.map((x, i) => (
            <tr key={i} style={{ background: bgFila(x) }}>
              <td className="muted">{x.fecha}</td>
              <td>{x.dia}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {x.marcas || (x.entrada ? `${x.entrada}–${x.salida || '?'}` : '—')}
                {(x.intermedioMin || 0) > 0 && !x.computarIntermedio &&
                  <span style={{ color: '#d97706', fontWeight: 600, fontSize: 11 }} title="Tiempo entre fichadas que NO se computó. Revisar si corresponde a almuerzo o si debe pagarse."> · ⚠ {minToHhmm(x.intermedioMin!)} sin trabajar en el medio</span>}
                {(x.intermedioMin || 0) > 0 && x.computarIntermedio &&
                  <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 11 }}> · ✓ {minToHhmm(x.intermedioMin!)} computado como jornada</span>}
                {onAjusteIntervalo && (x.intermedioMin || 0) > 0 &&
                  <button className="btn ghost" style={{ marginLeft: 6, padding: '1px 8px', fontSize: 11 }}
                    onClick={() => onAjusteIntervalo(x.fecha, !x.computarIntermedio)}>
                    {x.computarIntermedio ? 'Deshacer' : 'Computar como jornada'}
                  </button>}
                {(x.intermedioMin || 0) === 0 && (x.nMarcas || 0) > 1 && <span className="muted" style={{ fontSize: 11 }}> · {x.nMarcas} tramos</span>}
              </td>
              <td style={{ textAlign: 'right' }}>{x.hsNetasMin > 0 ? minToHhmm(x.hsNetasMin) : '—'}</td>
              <td style={{ textAlign: 'right' }} className="muted">{minToHhmm(x.hsNormalMin)}</td>
              {verSaldo && <td style={{ textAlign: 'right', color: x.saldoMin == null ? '#888' : (x.saldoMin < 0 ? '#dc2626' : '#16a34a') }}>{x.saldoMin == null ? '—' : minToHhmm(x.saldoMin)}</td>}
              <td style={{ textAlign: 'right' }}>{extraDe(x)}</td>
              <td style={{ textAlign: 'right', color: x.tardeMin > 0 && x.completa ? '#d97706' : undefined }}>{x.tardeMin > 0 ? minToHhmm(x.tardeMin) : '—'}</td>
              <td>{estadoBadge(x.estado)}</td>
              <td>{novedadDe(x)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {verSaldo ? (
            <tr style={{ fontWeight: 600, borderTop: '2px solid rgba(120,130,160,.3)' }}>
              <td colSpan={5} style={{ textAlign: 'right' }}>{banco < 0 ? 'Tiempo a recuperar:' : 'Banco de horas a favor:'}</td>
              <td style={{ textAlign: 'right', color: banco < 0 ? '#dc2626' : '#16a34a' }}>{minToHhmm(banco)}</td>
              <td colSpan={4}></td>
            </tr>
          ) : (
            <tr style={{ fontWeight: 600, borderTop: '2px solid rgba(120,130,160,.3)' }}>
              <td colSpan={5} style={{ textAlign: 'right' }}>Tiempo a recuperar del mes:</td>
              <td colSpan={4} style={{ textAlign: 'right', color: aRecuperar ? '#dc2626' : undefined }}>{minToHhmm(aRecuperar)}</td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}
