import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { ComponentType } from 'react';
import { findSection } from '../lib/sections';
import { useAuth } from '../lib/auth';
import { META, fallback } from '../lib/meta';
import Placeholder from './Placeholder';
import Empleados from '../pages/Empleados';
import Personas from '../pages/Personas';
import MisDatos from '../pages/MisDatos';
import Mensajes from '../pages/Mensajes';
import MensajesRRHH from '../pages/MensajesRRHH';
import Organigrama from '../pages/Organigrama';
import Ganancias from '../pages/Ganancias';
import GananciasParams from '../pages/GananciasParams';
import LibroSueldos from '../pages/LibroSueldos';
import F931 from '../pages/F931';
import Asiento from '../pages/Asiento';
import ArchivosBanco from '../pages/ArchivosBanco';
import GeneradorReportes from '../pages/GeneradorReportes';
import Simulaciones from '../pages/Simulaciones';
import SimuladorGanancias from '../pages/SimuladorGanancias';
import Siradig from '../pages/Siradig';
import GananciasControl from '../pages/GananciasControl';
import GananciasApertura from '../pages/GananciasApertura';
import Acumuladores from '../pages/Acumuladores';
import Tablero from '../pages/Tablero';
import GananciasFinal from '../pages/GananciasFinal';
import Embargos from '../pages/Embargos';
import Provision from '../pages/Provision';
import Alertas from '../pages/Alertas';
import ValoresLegales from '../pages/ValoresLegales';
import ControlesLiq from '../pages/ControlesLiq';
import Novedades from '../pages/Novedades';
import ParametrosHist from '../pages/ParametrosHist';
import DdjjSindical from '../pages/DdjjSindical';
import Sindicatos from '../pages/Sindicatos';
import DocumentosFirmados from '../pages/DocumentosFirmados';
import Hys from '../pages/Hys';
import MisHys from '../pages/MisHys';
import Reglamento from '../pages/Reglamento';
import CierrePeriodos from '../pages/CierrePeriodos';
import NivelesUsuario from '../pages/NivelesUsuario';
import LiquidacionAnual from '../pages/LiquidacionAnual';
import CbuNovedades from '../pages/CbuNovedades';
import Escalas from '../pages/Escalas';
import ArtEmpresas from '../pages/ArtEmpresas';
import MisCbus from '../pages/MisCbus';
import Adelantos from '../pages/Adelantos';
import Parametros from '../pages/Parametros';
import Conceptos from '../pages/Conceptos';
import Liquidacion from '../pages/Liquidacion';
import MisRecibos from '../pages/MisRecibos';
import RecibosGestion from '../pages/RecibosGestion';
import Licencias from '../pages/Licencias';
import Sanciones from '../pages/Sanciones';
import Evaluaciones from '../pages/Evaluaciones';
import CertTrabajo from '../pages/CertTrabajo';
import CertTrabajoRRHH from '../pages/CertTrabajoRRHH';
import AdminUsuarios from '../pages/AdminUsuarios';
import AdminAuditoria from '../pages/AdminAuditoria';
import AdminEmpresas from '../pages/AdminEmpresas';
import Elementos from '../pages/Elementos';
import Beneficios from '../pages/Beneficios';
import CambiosDomicilio from '../pages/CambiosDomicilio';
import MisFamiliares from '../pages/MisFamiliares';
import CostoEquipo from '../pages/CostoEquipo';
import Justificaciones from '../pages/Justificaciones';
import FichadasImport from '../pages/FichadasImport';
import FichadasConsulta from '../pages/FichadasConsulta';
import FichadasEquipo from '../pages/FichadasEquipo';
import DatosEquipo from '../pages/DatosEquipo';
import ChsMinutas from '../pages/ChsMinutas';
import ChsPolitica from '../pages/ChsPolitica';
import ChsSiniestros from '../pages/ChsSiniestros';
import ChsMediciones from '../pages/ChsMediciones';
import ChsAuditorias from '../pages/ChsAuditorias';
import ChsNoConf from '../pages/ChsNoConf';
import ChsCarteleria from '../pages/ChsCarteleria';
import ChsEvidencias from '../pages/ChsEvidencias';
import ChsRiesgos from '../pages/ChsRiesgos';
import ChsDashboard from '../pages/ChsDashboard';
import ChsCapacitaciones from '../pages/ChsCapacitaciones';
import ChsEpp from '../pages/ChsEpp';

// Módulos ya migrados (clave de sección → componente).
const COMPONENTS: Record<string, ComponentType> = {
  'empleados': Empleados,
  'personas': Personas,
  'mis-datos': MisDatos,
  'mensajes': Mensajes,
  'mensajes-rrhh': MensajesRRHH,
  'organigrama': Organigrama,
  'mis-ganancias': Ganancias,
  'ganancias-rrhh': Ganancias,
  'ganancias-params': GananciasParams,
  'libro-sueldos': LibroSueldos,
  'f931': F931,
  'asiento': Asiento,
  'bancos': ArchivosBanco,
  'reportes': GeneradorReportes,
  'simulaciones': Simulaciones,
  'simulador-ganancias': SimuladorGanancias,
  'siradig': Siradig,
  'ganancias-control': GananciasControl,
  'ganancias-apertura': GananciasApertura,
  'acumuladores': Acumuladores,
  'tablero': Tablero,
  'ganancias-final': GananciasFinal,
  'embargos': Embargos,
  'provision': Provision,
  'alertas': Alertas,
  'valores-legales': ValoresLegales,
  'controles-liq': ControlesLiq,
  'novedades': Novedades,
  'parametros-hist': ParametrosHist,
  'ddjj-sindical': DdjjSindical,
  'sindicatos': Sindicatos,
  'documentos': DocumentosFirmados,
  'hys': Hys,
  'mis-hys': MisHys,
  'reglamento': Reglamento,
  'cierre-periodos': CierrePeriodos,
  'user-levels': NivelesUsuario,
  'liquidacion-anual': LiquidacionAnual,
  'cbu-novedades': CbuNovedades,
  'escalas': Escalas,
  'art-empresas': ArtEmpresas,
  'mis-cbus': MisCbus,
  'anticipos': Adelantos,
  'aprobaciones': Adelantos,
  'costo-equipo': CostoEquipo,
  'datos-equipo': DatosEquipo,
  'chs-minutas': ChsMinutas,
  'chs-politica': ChsPolitica,
  'chs-siniestros': ChsSiniestros,
  'chs-mediciones': ChsMediciones,
  'chs-auditorias': ChsAuditorias,
  'chs-noconf': ChsNoConf,
  'chs-carteleria': ChsCarteleria,
  'chs-evidencias': ChsEvidencias,
  'chs-riesgos': ChsRiesgos,
  'chs-dashboard': ChsDashboard,
  'chs-capacitaciones': ChsCapacitaciones,
  'chs-epp': ChsEpp,
  'adelantos-rrhh': Adelantos,
  'parametros': Parametros,
  'conceptos': Conceptos,
  'liquidacion': Liquidacion,
  'mis-recibos': MisRecibos,
  'recibos-gestion': RecibosGestion,
  'mis-licencias': Licencias,
  'licencias-equipo': Licencias,
  'licencias-rrhh': Licencias,
  'sanciones': Sanciones,
  'mis-sanciones': Sanciones,
  'sanciones-equipo': Sanciones,
  'evaluaciones': Evaluaciones,
  'mis-evaluaciones': Evaluaciones,
  'evaluaciones-equipo': Evaluaciones,
  'cert-trabajo': CertTrabajo,
  'cert-trabajo-rrhh': CertTrabajoRRHH,
  'admin-usuarios': AdminUsuarios,
  'auditoria': AdminAuditoria,
  'admin-empresas': AdminEmpresas,
  'elementos-trabajo': Elementos,
  'beneficios': Beneficios,
  'cambios-domicilio': CambiosDomicilio,
  'mis-familiares': MisFamiliares,
  'justificar-licencia': Justificaciones,
  'fichadas-import': FichadasImport,
  'fichadas-consulta': FichadasConsulta,
  'fichadas-equipo': FichadasEquipo,
};

export default function SectionView() {
  const { key } = useParams();
  const { user } = useAuth();
  const section = key ? findSection(key) : undefined;
  if (!section) return <Navigate to="/" replace />;
  if (section.key.startsWith('chs-')) {
    const r = user?.role; const full = user?.comiteHys || r === 'rrhh' || r === 'admin' || (r === 'comite' && user?.acceso === 'full');
    const dash = r === 'comite' && user?.acceso === 'dashboard';
    if (dash) { if (section.key !== 'chs-dashboard') return <Navigate to="/" replace />; }
    else if (!full) return <Navigate to="/" replace />;
  }
  const Comp = COMPONENTS[section.key];
  return (
    <>
      <PageHeader sectionKey={section.key} label={section.label} />
      {Comp ? <Comp /> : <Placeholder label={section.label} />}
    </>
  );
}

function PageHeader({ sectionKey, label }: { sectionKey: string; label: string }) {
  const nav = useNavigate();
  const m = META[sectionKey] || fallback;
  return (
    <>
      <button className="page-back" onClick={() => nav('/')} title="Volver al menú">← Volver al inicio</button>
      <div className="page-header">
        <div className="page-ico" style={{ background: `rgba(${m.col},.1)`, border: `1px solid rgba(${m.col},.3)` }}>{m.ico}</div>
        <div>
          <div className="page-title">{label}</div>
          {m.desc && <div className="page-sub">{m.desc}</div>}
        </div>
      </div>
    </>
  );
}
