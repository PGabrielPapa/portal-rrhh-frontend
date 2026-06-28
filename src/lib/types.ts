export interface Empleado {
  id: number;
  uid: string;
  legNum: string;
  leg: string;
  dni: string;
  cuil?: string;
  nom: string;
  email?: string;
  empresa: string;
  cat?: string;
  tramo?: string;
  ingreso?: string;
  bruto: number;
  neto: number;
  role: string;
  activo: boolean;
  esAlta: boolean;
  [k: string]: unknown;
}
export interface AuthUser { id: number | null; dni: string; nom: string; role: string; empresa?: string; comiteHys?: boolean; acceso?: string; personaId?: number; modulosOcultos?: string[]; twofa?: boolean; }
export interface LoginResult { token: string; mustChangePassword: boolean; user: AuthUser; }
export interface ImportResult { ok: number; dup: number; err: number; errores: string[]; mensaje: string; }
