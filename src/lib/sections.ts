// Registro de secciones (módulos) agrupadas por panel, con los roles que las ven.
// ready=true → ya migrada (tiene componente). ready=false → placeholder.
export type Role = 'employee' | 'manager' | 'rrhh' | 'admin';

export interface Section { key: string; label: string; ready?: boolean; }
export interface Group { panel: string; roles: Role[]; items: Section[]; flag?: 'comiteHys'; }

export const GROUPS: Group[] = [
  {
    panel: 'Mi espacio', roles: ['employee', 'manager', 'rrhh', 'admin'],
    items: [
      { key: 'mis-recibos', label: 'Mis recibos', ready: true },
      { key: 'mis-fichadas', label: 'Mis fichadas del día', ready: true },
      { key: 'mis-ganancias', label: 'Ganancias (F.1357)', ready: true },
      { key: 'mis-datos', label: 'Mis datos', ready: true },
      { key: 'seguridad', label: 'Seguridad (2FA)', ready: true },
      { key: 'anticipos', label: 'Adelantos', ready: true },
      { key: 'mis-licencias', ready: true, label: 'Mis licencias' },
      { key: 'justificar-licencia', ready: true, label: 'Justificación de licencias' },
      { key: 'mensajes', label: 'Mensajes', ready: true },
      { key: 'mis-cbus', label: 'Mis CBUs', ready: true },
      { key: 'cert-trabajo', label: 'Certificado de trabajo', ready: true },
      { key: 'mis-sanciones', label: 'Mis sanciones', ready: true },
      { key: 'mis-evaluaciones', label: 'Mis evaluaciones', ready: true },
      { key: 'mis-delegaciones', label: 'Mis delegaciones', ready: true },
      { key: 'mis-familiares', label: 'Mis familiares', ready: true },
      { key: 'mis-hys', label: 'Higiene y Seguridad', ready: true },
    ],
  },
  {
    panel: 'Gerencia', roles: ['manager', 'admin'],
    items: [
      { key: 'tablero-equipo', label: 'Tablero del equipo', ready: true },
      { key: 'aprobaciones', label: 'Adelantos del equipo', ready: true },
      { key: 'delegaciones', label: 'Delegaciones', ready: true },
      { key: 'fichadas-equipo', label: 'Fichadas del equipo (autorizar)', ready: true },
      { key: 'licencias-equipo', ready: true, label: 'Licencias del equipo' },
      { key: 'organigrama', label: 'Organigrama / equipo', ready: true },
      { key: 'datos-equipo', label: 'Datos del personal a cargo', ready: true },
      { key: 'costo-equipo', label: 'Costo laboral del equipo', ready: true },
      { key: 'sanciones-equipo', label: 'Sanciones del equipo', ready: true },
      { key: 'evaluaciones-equipo', label: 'Evaluaciones del equipo', ready: true },
    ],
  },
  {
    panel: 'RRHH — Tablero y control', roles: ['rrhh', 'admin'],
    items: [
      { key: 'tablero', label: 'Tablero de RR.HH.', ready: true },
      { key: 'alertas', label: 'Alertas de vencimientos', ready: true },
      { key: 'controles-liq', label: 'Controles de liquidación', ready: true },
      { key: 'reportes', label: 'Generador de reportes', ready: true },
    ],
  },
  {
    panel: 'RRHH — Personal y legajos', roles: ['rrhh', 'admin'],
    items: [
      { key: 'personas', label: 'Personas (base)', ready: true },
      { key: 'empleados', label: 'ABM Empleados', ready: true },
      { key: 'actualizacion-masiva', label: 'Actualización masiva de legajos', ready: true },
      { key: 'plantillas-legajo', label: 'Plantillas de legajo', ready: true },
      { key: 'agrupaciones', label: 'Agrupaciones auxiliares', ready: true },
      { key: 'puestos', label: 'Puestos y estructura', ready: true },
      { key: 'legajo-docs', label: 'Legajo digital (documentos)', ready: true },
      { key: 'vacaciones', label: 'Vacaciones (saldos)', ready: true },
      { key: 'licencias-rrhh', ready: true, label: 'Licencias (gestión)' },
      { key: 'sanciones', label: 'Sanciones', ready: true },
      { key: 'evaluaciones', label: 'Evaluaciones de desempeño', ready: true },
      { key: 'beneficios', label: 'Beneficios', ready: true },
      { key: 'elementos-trabajo', label: 'Elementos de trabajo', ready: true },
      { key: 'cert-trabajo-rrhh', label: 'Certificados de trabajo', ready: true },
      { key: 'cert-servicios', label: 'Certificación de servicios (ANSES)', ready: true },
      { key: 'documentos', label: 'Documentos firmados', ready: true },
      { key: 'mensajes-rrhh', label: 'Mensajes de empleados', ready: true },
      { key: 'cambios-domicilio', label: 'Cambios de domicilio', ready: true },
      { key: 'hys', label: 'Higiene y Seguridad', ready: true },
    ],
  },
  {
    panel: 'RRHH — Asistencia', roles: ['rrhh', 'admin'],
    items: [
      { key: 'fichadas-import', label: 'Importar fichadas (Pro-Soft)', ready: true },
      { key: 'fichadas-dia', label: 'Fichadas del día', ready: true },
      { key: 'fichadas-consulta', label: 'Fichadas — consulta (control mensual)', ready: true },
    ],
  },
  {
    panel: 'RRHH — Liquidación de haberes', roles: ['rrhh', 'admin'],
    items: [
      { key: 'liquidacion', label: 'Liquidación', ready: true },
      { key: 'novedades', label: 'Novedades variables', ready: true },
      { key: 'adelantos-rrhh', label: 'Adelantos (otorgamiento)', ready: true },
      { key: 'conceptos', label: 'Conceptos', ready: true },
      { key: 'escalas', label: 'Escalas / convenios', ready: true },
      { key: 'acumuladores', label: 'Acumuladores', ready: true },
      { key: 'valores-aux', label: 'Valores auxiliares (fórmulas)', ready: true },
      { key: 'simulaciones', label: 'Simulaciones', ready: true },
      { key: 'recibos-gestion', label: 'Recibos (gestión)', ready: true },
      { key: 'cbu-novedades', label: 'CBU — novedades', ready: true },
      { key: 'bancos', label: 'Archivos de banco', ready: true },
      { key: 'cierre-periodos', label: 'Cierre de períodos', ready: true },
      { key: 'parametros', label: 'Parámetros de liquidación', ready: true },
    ],
  },
  {
    panel: 'RRHH — Impuesto a las Ganancias', roles: ['rrhh', 'admin'],
    items: [
      { key: 'ganancias-rrhh', label: 'Ganancias / F.1357', ready: true },
      { key: 'ganancias-control', label: 'Ganancias — informe de control', ready: true },
      { key: 'ganancias-final', label: 'Ganancias — liquidación final anual', ready: true },
      { key: 'ganancias-apertura', label: 'Ganancias — carga inicial', ready: true },
      { key: 'ganancias-params', label: 'Parámetros de Ganancias', ready: true },
      { key: 'simulador-ganancias', label: 'Simulador de Ganancias', ready: true },
      { key: 'siradig', label: 'SiRADIG (deducciones Ganancias)', ready: true },
      { key: 'liquidacion-anual', label: 'Liquidación anual ganancias', ready: true },
    ],
  },
  {
    panel: 'RRHH — Cargas sociales y AFIP', roles: ['rrhh', 'admin'],
    items: [
      { key: 'f931', label: 'F.931', ready: true },
      { key: 'libro-sueldos', label: 'Libro de sueldos', ready: true },
      { key: 'asiento', label: 'Asiento contable', ready: true },
      { key: 'ddjj-sindical', label: 'DDJJ sindical', ready: true },
      { key: 'simplificacion', label: 'Simplificación Registral (altas/bajas)', ready: true },
      { key: 'provision', label: 'Provisión SAC y vacaciones', ready: true },
      { key: 'embargos', label: 'Embargos y cuota alimentaria', ready: true },
    ],
  },
  {
    panel: 'RRHH — Tablas y configuración', roles: ['rrhh', 'admin'],
    items: [
      { key: 'valores-legales', label: 'Valores legales (topes y mínimos)', ready: true },
      { key: 'art-empresas', label: 'ART por empresa', ready: true },
      { key: 'sindicatos', label: 'Sindicatos', ready: true },
      { key: 'reglamento', label: 'Reglamento / licencias esp.', ready: true },
      { key: 'modelo-recibo', label: 'Modelo de recibo', ready: true },
      { key: 'campos-adicionales', label: 'Campos adicionales del legajo', ready: true },
    ],
  },
  {
    panel: 'Comité de HyS', roles: ['rrhh', 'admin'], flag: 'comiteHys',
    items: [
      { key: 'chs-politica', label: 'Política de HyS', ready: true },
      { key: 'chs-capacitaciones', label: 'Plan Anual de Capacitaciones', ready: true },
      { key: 'chs-siniestros', label: 'Siniestros (ART / Med. Laboral)', ready: true },
      { key: 'chs-auditorias', label: 'Auditorías e Inspecciones', ready: true },
      { key: 'chs-epp', label: 'EPP (matriz y entregas)', ready: true },
      { key: 'chs-riesgos', label: 'Matriz de Riesgos (procesos)', ready: true },
      { key: 'chs-carteleria', label: 'Cartelería', ready: true },
      { key: 'chs-minutas', label: 'Minutas del Comité', ready: true },
      { key: 'chs-noconf', label: 'No Conformidades y Mejoras', ready: true },
      { key: 'chs-mediciones', label: 'Mediciones de HyS', ready: true },
      { key: 'chs-evidencias', label: 'Evidencias de Mejoras', ready: true },
      { key: 'chs-dashboard', label: 'Indicadores (Dashboard)', ready: true },
    ],
  },
  {
    panel: 'Administración', roles: ['admin'],
    items: [
      { key: 'admin-empresas', label: 'Empresas', ready: true },
      { key: 'centros-operaciones', label: 'Centros de operaciones', ready: true },
      { key: 'admin-usuarios', label: 'Usuarios', ready: true },
      { key: 'user-levels', label: 'Niveles de usuario', ready: true },
      { key: 'auditoria', label: 'Auditoría', ready: true },
      { key: 'parametros-hist', label: 'Parámetros por vigencia', ready: true },
    ],
  },
];

// Paneles cuyo acceso está garantizado por rol y NO se pueden ocultar:
// 'Mi espacio' (todo empleado activo) y 'Gerencia' (todo gerente).
export const SIEMPRE_PANELS = ['Mi espacio', 'Gerencia'];
export function esModuloSiempre(key: string): boolean {
  const g = GROUPS.find((gr) => gr.items.some((i) => i.key === key));
  return !!g && SIEMPRE_PANELS.includes(g.panel);
}

export function groupsForRole(role: string, flags?: { comiteHys?: boolean; comiteAcceso?: string; modulosOcultos?: string[] }): Group[] {
  if (role === 'comite') {
    const chs = GROUPS.find((g) => g.flag === 'comiteHys');
    if (!chs) return [];
    const items = flags?.comiteAcceso === 'full' ? chs.items : chs.items.filter((i) => i.key === 'chs-dashboard');
    return [{ ...chs, roles: [], items }];
  }
  const ocultos = new Set(flags?.modulosOcultos || []);
  return GROUPS
    .filter((g) => g.roles.includes(role as Role) || (g.flag && flags && flags[g.flag]))
    .map((g) => (SIEMPRE_PANELS.includes(g.panel) ? g : { ...g, items: g.items.filter((it) => !ocultos.has(it.key)) }));
}

export function findSection(key: string): Section | undefined {
  for (const g of GROUPS) { const s = g.items.find((i) => i.key === key); if (s) return s; }
  return undefined;
}
