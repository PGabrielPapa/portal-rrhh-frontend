// src/lib/arca.ts
// Acceso a las tablas de referencia de ARCA/AFIP (códigos y obras sociales)
// y metadatos de los campos SICOSS del legajo para el ABM.
import { api } from './api';

export interface CodigoArca { codigo: number; nombre: string; }
export interface ObraSocial { codigo: string; codigo_sicoss: string; nombre: string; }
export type CodigosArca = Record<string, CodigoArca[]>;

let _cacheCodigos: CodigosArca | null = null;
export async function loadCodigos(): Promise<CodigosArca> {
  if (_cacheCodigos) return _cacheCodigos;
  _cacheCodigos = await api.get<CodigosArca>('/arca/codigos');
  return _cacheCodigos;
}

export function buscarObrasSociales(q: string): Promise<ObraSocial[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return api.get<ObraSocial[]>(`/arca/obras-sociales${qs}`);
}

// Campos SICOSS del legajo (se guardan en empleado.data). tipoCodigo apunta a la
// tabla codigos_afip que llena el desplegable; siNo => Sí/No; number/text simples.
export interface CampoSicoss {
  key: string; label: string;
  kind: 'codigo' | 'number' | 'text' | 'siNo';
  tipoCodigo?: 'situacion' | 'condicion' | 'actividad' | 'modalidad' | 'zona';
  def: number | string;
  help?: string;
}

export const CAMPOS_SICOSS: CampoSicoss[] = [
  { key: 'codigoSituacion', label: 'Situación de revista', kind: 'codigo', tipoCodigo: 'situacion', def: 1 },
  { key: 'codigoCondicion', label: 'Condición', kind: 'codigo', tipoCodigo: 'condicion', def: 1 },
  { key: 'codigoActividad', label: 'Actividad', kind: 'codigo', tipoCodigo: 'actividad', def: 0 },
  { key: 'codigoModalidad', label: 'Modalidad de contratación', kind: 'codigo', tipoCodigo: 'modalidad', def: 8 },
  { key: 'codigoZona', label: 'Zona', kind: 'codigo', tipoCodigo: 'zona', def: 0 },
  { key: 'conyuge', label: 'Cónyuge a cargo', kind: 'siNo', def: 0 },
  { key: 'hijos', label: 'Hijos a cargo', kind: 'number', def: 0 },
  { key: 'adherentes', label: 'Adherentes', kind: 'number', def: 0 },
  { key: 'regimen', label: 'Régimen (1=SIPA)', kind: 'siNo', def: 1 },
  { key: 'porcAporteAdicSS', label: '% aporte adicional SS', kind: 'number', def: 0 },
  { key: 'trabajadorConvencionado', label: 'Trabajador convencionado', kind: 'siNo', def: 1 },
  { key: 'seguroVida', label: 'Seguro de vida obligatorio', kind: 'siNo', def: 1 },
  { key: 'diasTrabajados', label: 'Días trabajados (mes)', kind: 'number', def: 30 },
  { key: 'codigoSiniestrado', label: 'Código de siniestrado', kind: 'number', def: 0 },
  { key: 'tipoEmpresa', label: 'Tipo de empresa', kind: 'number', def: 0 },
  { key: 'provinciaLocalidad', label: 'Provincia / Localidad (DGI)', kind: 'text', def: '' },
];

export function defaultsSicoss(): Record<string, string> {
  const o: Record<string, string> = {};
  for (const c of CAMPOS_SICOSS) o[c.key] = String(c.def);
  return o;
}
