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

export interface DiaDetalle {
  fecha: string; dia: string; entrada?: string; salida?: string;
  hsNetasMin: number; hsNormalMin: number; saldoMin: number | null;
  extra50Min: number; extra100Min: number; extraComputa: boolean;
  tardeMin: number; completa: boolean; estado: Estado;
  comentario?: string; licenciaPortal?: string | null;
  sinLicenciaPortal?: boolean; licenciaConflicto?: boolean; licenciaSoloPortal?: boolean;
}
export interface DiaRevisar { fecha: string; motivo: string; tarde?: string; }
export interface FichadaData {
  legajoProsoft?: string; diasTrabajados?: number; horasExtra50Min?: number; horasExtra100Min?: number;
  horasExtraDescartadaMin?: number; tardanzasMin?: number; diasTardanza?: number;
  diasARevisar?: DiaRevisar[]; bancoNetoMin?: number; dias?: DiaDetalle[];
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
    case 'no-laborable': return <span className="muted">finde/feriado (a favor)</span>;
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
  if (x.estado === 'licencia' || x.estado === 'licencia-portal') return 'rgba(37,99,235,.07)';
  return undefined;
}
function novedadDe(x: DiaDetalle) {
  if (x.licenciaConflicto) return <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ {x.licenciaPortal || 'Licencia'} aprobada — pero HAY MARCAS (no la tomó)</span>;
  if (x.comentario) return <span style={{ color: '#2563eb' }}>{x.comentario}{x.sinLicenciaPortal ? <span style={{ color: '#d97706' }}> · ⚠ no está cargada en el portal</span> : ''}</span>;
  if (x.licenciaPortal) return <span style={{ color: '#2563eb' }}>{x.licenciaPortal} (portal){x.licenciaSoloPortal ? <span style={{ color: '#d97706' }}> · ⚠ no figura en el reloj</span> : ''}</span>;
  return <span className="muted">—</span>;
}

// Cálculo de lo liquidable del mes. La hora extra COMPENSA primero el tiempo en
// contra: extra neto = (extra 50 + extra 100) − tiempo en contra. El tiempo en
// contra es la suma de los días con marca completa trabajados por debajo de la
// jornada (días en contra). Las horas a favor (banco positivo) son solo control.
export function calcLiquidable(d: FichadaData) {
  // El extra se cuenta POR DÍA: solo los días cuyo saldo a favor llegó a 30 min
  // suman como extra. Los saldos chicos (<30/día) NO se suman → quedan en banco
  // de horas (control). El extra compensa primero el tiempo en contra.
  const dias = d.dias || [];
  let extraBruta = 0;   // Σ de días con saldo a favor ≥ 30 min
  let deficit = 0;      // Σ de días trabajados por debajo de la jornada
  let bancoChico = 0;   // Σ de días a favor < 30 min (banco de horas, no se liquida)
  for (const x of dias) {
    const s = typeof x.saldoMin === 'number' ? x.saldoMin : null;
    if (s == null) continue;
    if (s >= 30) extraBruta += s;
    else if (s > 0) bancoChico += s;
    else if (s < 0) deficit += -s;
  }
  const extraLiquidable = Math.max(0, extraBruta - deficit);  // extra compensa lo en contra
  const aRecuperar = Math.max(0, deficit - extraBruta);
  const banco = d.bancoNetoMin || 0;
  const inj = d.diasInjustificados || 0;
  return { banco, extraBruta, deficit, bancoChico, extraLiquidable, aRecuperar, inj };
}

export function DetalleDias({ d, nom, gerente = false }: { d: FichadaData; nom: string; gerente?: boolean }) {
  const dias = d.dias || [];
  if (!dias.length) return <span className="muted">Sin detalle diario para este empleado (importado con una versión anterior; reimportá el período).</span>;
  // Extra del día = lo trabajado por encima de la jornada (Hs netas − jornada = Saldo día).
  const extraDe = (x: DiaDetalle) => {
    const s = typeof x.saldoMin === 'number' ? x.saldoMin : null;
    if (s == null || s <= 0) return '—';
    return minToHhmm(s) + (s < 30 ? ' (<30m)' : '');
  };
  const { banco, extraLiquidable, aRecuperar, bancoChico, inj } = calcLiquidable(d);
  // El gerente NO ve el saldo a favor: se oculta la columna de saldo diario.
  const verSaldo = !gerente;

  return (
    <div style={{ overflow: 'auto' }}>
      <div style={{ margin: '8px 2px 10px', padding: '8px 10px', background: 'rgba(22,163,74,.07)', borderRadius: 6, fontSize: 12.5 }}>
        {!gerente && <>Resultado del mes: <b style={{ color: banco < 0 ? '#dc2626' : '#16a34a' }}>{minToHhmm(banco)}</b> ({banco < 0 ? 'en contra' : 'a favor'}) · </>}
        {aRecuperar > 0 && <>Tiempo a recuperar <b style={{ color: '#dc2626' }}>{minToHhmm(aRecuperar)}</b> · </>}
        <b>Extra a liquidar: <span style={{ color: extraLiquidable > 0 ? '#16a34a' : undefined }}>{minToHhmm(extraLiquidable)}</span></b>
        <span className="muted"> (solo días con +30 min a favor)</span>
        {!gerente && bancoChico > 0 && <span className="muted"> · Banco de horas: {minToHhmm(bancoChico)} (saldos &lt; 30 min/día, no se liquidan)</span>}
        {inj > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}> · ⚠ Faltas injustificadas: {inj}</span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, margin: '8px 2px 6px' }}>Detalle diario de {nom}{verSaldo ? ' — el banco del mes es la suma de "Saldo día". Licencias y findes/feriados no suman al banco.' : ''}</div>
      <table style={{ fontSize: 12.5 }}>
        <thead><tr>
          <th>Fecha</th><th>Día</th><th>Entrada</th><th>Salida</th>
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
              <td>{x.entrada || '—'}</td>
              <td>{x.salida || '—'}</td>
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
              <td colSpan={6} style={{ textAlign: 'right' }}>Banco del mes (suma de saldos):</td>
              <td style={{ textAlign: 'right', color: banco < 0 ? '#dc2626' : '#16a34a' }}>{minToHhmm(banco)}</td>
              <td colSpan={4}></td>
            </tr>
          ) : (
            <tr style={{ fontWeight: 600, borderTop: '2px solid rgba(120,130,160,.3)' }}>
              <td colSpan={6} style={{ textAlign: 'right' }}>Tiempo a recuperar del mes:</td>
              <td colSpan={4} style={{ textAlign: 'right', color: aRecuperar ? '#dc2626' : undefined }}>{minToHhmm(aRecuperar)}</td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}
