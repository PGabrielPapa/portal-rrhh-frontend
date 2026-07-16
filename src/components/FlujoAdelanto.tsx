import FlujoAprobacion from './FlujoAprobacion';

// Flujo de aprobación multinivel de un adelanto (usa el componente genérico).
export default function FlujoAdelanto({ anticipoId, onResuelto }: { anticipoId: number; onResuelto?: () => void }) {
  return <FlujoAprobacion base="/anticipos" id={anticipoId} onResuelto={onResuelto} />;
}
