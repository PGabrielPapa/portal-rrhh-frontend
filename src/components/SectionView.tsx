import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { ComponentType } from 'react';
import { findSection, esModuloSiempre } from '../lib/sections';
import { useAuth } from '../lib/auth';
import { META, fallback } from '../lib/meta';
import Placeholder from './Placeholder';
import Empleados from '../pages/Empleados';
import Personas from '../pages/Personas';
import MisDatos from '../pages/MisDatos';
import TurnosReglas from '../pages/TurnosReglas';
import Seguridad from '../pages/Seguridad';
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
import TableroGerente from '../pages/TableroGerente';
import GananciasFinal from '../pages/GananciasFinal';
import Embargos from '../pages/Embargos';
import Provision from '../pages/Provision';
import Alertas from '../pages/Alertas';
import ValoresLegales from '../pages/ValoresLegales';
import ControlesLiq from '../pages/ControlesLiq';
import Novedades from '../pages/Novedades';
import Vacaciones from '../pages/Vacaciones';
import LegajoDocs from '../pages/LegajoDocs';
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
import Produccion from '../pages/Produccion';
import MisRecibos from '../pages/MisRecibos';
import RecibosGestion from '../pages/RecibosGestion';
import Licencias from '../pages/Licencias';
import MisAprobaciones from '../pages/MisAprobaciones';
import EstadoSistema from '../pages/EstadoSistema';
import Sanciones from '../pages/Sanciones';
import Evaluaciones from '../pages/Evaluaciones';
import Delegaciones from '../pages/Delegaciones';
import MisDelegaciones from '../pages/MisDelegaciones';
import CertTrabajo from '../pages/CertTrabajo';
import CertTrabajoRRHH from '../pages/CertTrabajoRRHH';
import AdminUsuarios from '../pages/AdminUsuarios';
import AdminAuditoria from '../pages/AdminAuditoria';
import AdminEmpresas from '../pages/AdminEmpresas';
import CentrosOperaciones from '../pages/CentrosOperaciones';
import Puestos from '../pages/Puestos';
import DescripcionPuestos from '../pages/DescripcionPuestos';
import Reclutamiento from '../pages/Reclutamiento';
import Desempeno9box from '../pages/Desempeno9box';
import TableroTalento from '../pages/TableroTalento';
import Compensaciones from '../pages/Compensaciones';
import SeleccionEmbudo from '../pages/SeleccionEmbudo';
import LMS from '../pages/LMS';
import Desarrollo from '../pages/Desarrollo';
import Muro from '../pages/Muro';
import ComunicadosRRHH from '../pages/ComunicadosRRHH';
import FicharWeb from '../pages/FicharWeb';
import FichajeWebRRHH from '../pages/FichajeWebRRHH';
import MisDocumentosFirma from '../pages/MisDocumentosFirma';
import DocumentosFirma from '../pages/DocumentosFirma';
import MiFormacion from '../pages/MiFormacion';
import MiFeedback from '../pages/MiFeedback';
import AsistenteIA from '../pages/AsistenteIA';
import SicoreGanancias from '../pages/SicoreGanancias';
import MatrizAntiguedad from '../pages/MatrizAntiguedad';
import Modalidades from '../pages/Modalidades';
import Competencias from '../pages/Competencias';
import Unidades from '../pages/Unidades';
import Posiciones from '../pages/Posiciones';
import Workflows from '../pages/Workflows';
import Onboarding from '../pages/Onboarding';
import Formacion from '../pages/Formacion';
import EncuestasRRHH from '../pages/EncuestasRRHH';
import MisEncuestas from '../pages/MisEncuestas';
import Sucesion from '../pages/Sucesion';
import ActualizacionMasiva from '../pages/ActualizacionMasiva';
import CamposAdicionales from '../pages/CamposAdicionales';
import CertServicios from '../pages/CertServicios';
import ValoresAux from '../pages/ValoresAux';
import PlantillasLegajo from '../pages/PlantillasLegajo';
import SimplificacionRegistral from '../pages/SimplificacionRegistral';
import ModeloRecibo from '../pages/ModeloRecibo';
import Agrupaciones from '../pages/Agrupaciones';
import Elementos from '../pages/Elementos';
import Beneficios from '../pages/Beneficios';
import CambiosDomicilio from '../pages/CambiosDomicilio';
import MisFamiliares from '../pages/MisFamiliares';
import CostoEquipo from '../pages/CostoEquipo';
import Justificaciones from '../pages/Justificaciones';
import FichadasImport from '../pages/FichadasImport';
import FichadasConsulta from '../pages/FichadasConsulta';
import FichadasEquipo from '../pages/FichadasEquipo';
import FichadasDia from '../pages/FichadasDia';
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
  'seguridad': Seguridad,
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
  'tablero-equipo': TableroGerente,
  'ganancias-final': GananciasFinal,
  'embargos': Embargos,
  'provision': Provision,
  'alertas': Alertas,
  'valores-legales': ValoresLegales,
  'controles-liq': ControlesLiq,
  'novedades': Novedades,
  'vacaciones': Vacaciones,
  'legajo-docs': LegajoDocs,
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
  'produccion': Produccion,
  'mis-recibos': MisRecibos,
  'recibos-gestion': RecibosGestion,
  'aprobaciones-pendientes': MisAprobaciones,
  'estado-sistema': EstadoSistema,
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
  'centros-operaciones': CentrosOperaciones,
  'puestos': Puestos,
  'descripcion-puestos': DescripcionPuestos,
  'reclutamiento': Reclutamiento,
  'desempeno-9box': Desempeno9box,
  'tablero-talento': TableroTalento,
  'compensaciones': Compensaciones,
  'seleccion-embudo': SeleccionEmbudo,
  'lms': LMS,
  'desarrollo': Desarrollo,
  'muro': Muro,
  'comunicados-rrhh': ComunicadosRRHH,
  'fichar-web': FicharWeb,
  'fichaje-web': FichajeWebRRHH,
  'mis-firmas': MisDocumentosFirma,
  'documentos-firma': DocumentosFirma,
  'mi-formacion': MiFormacion,
  'mi-feedback': MiFeedback,
  'asistente-ia': AsistenteIA,
  'sicore-ganancias': SicoreGanancias,
  'matriz-antiguedad': MatrizAntiguedad,
  'modalidades': Modalidades,
  'competencias': Competencias,
  'unidades': Unidades,
  'posiciones': Posiciones,
  'workflows': Workflows,
  'onboarding': Onboarding,
  'formacion': Formacion,
  'encuestas-rrhh': EncuestasRRHH,
  'mis-encuestas': MisEncuestas,
  'sucesion': Sucesion,
  'actualizacion-masiva': ActualizacionMasiva,
  'campos-adicionales': CamposAdicionales,
  'cert-servicios': CertServicios,
  'valores-aux': ValoresAux,
  'plantillas-legajo': PlantillasLegajo,
  'simplificacion': SimplificacionRegistral,
  'modelo-recibo': ModeloRecibo,
  'agrupaciones': Agrupaciones,
  'elementos-trabajo': Elementos,
  'beneficios': Beneficios,
  'cambios-domicilio': CambiosDomicilio,
  'mis-familiares': MisFamiliares,
  'justificar-licencia': Justificaciones,
  'fichadas-import': FichadasImport,
  'fichadas-consulta': FichadasConsulta,
  'turnos-reglas': TurnosReglas,
  'fichadas-equipo': FichadasEquipo,
  'delegaciones': Delegaciones,
  'mis-delegaciones': MisDelegaciones,
  'mis-fichadas': FichadasDia,
  'fichadas-dia': FichadasDia,
};

export default function SectionView() {
  const { key } = useParams();
  const { user } = useAuth();
  const section = key ? findSection(key) : undefined;
  if (!section) return <Navigate to="/" replace />;
  if (user?.modulosOcultos && user.modulosOcultos.includes(section.key) && !esModuloSiempre(section.key)) return <Navigate to="/" replace />;
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
