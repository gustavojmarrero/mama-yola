import { ConfiguracionHorarios, TurnoActividad } from '../types';

/**
 * Convierte una hora string "HH:mm" a minutos desde medianoche
 */
function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Calcula el turno de una actividad basado en su hora y la configuración de horarios
 * @param hora - Hora en formato "HH:mm"
 * @param config - Configuración de horarios con los inicios de cada turno
 * @returns El turno correspondiente
 */
export function calcularTurno(hora: string, config: ConfiguracionHorarios): TurnoActividad {
  const minutos = horaAMinutos(hora);
  const matutino = horaAMinutos(config.chequeoDiario.matutino);
  const vespertino = horaAMinutos(config.chequeoDiario.vespertino);
  const nocturno = horaAMinutos(config.chequeoDiario.nocturno);

  // Si nocturno es después de vespertino (ej: 21:00)
  if (nocturno > vespertino) {
    if (minutos >= matutino && minutos < vespertino) {
      return 'matutino';
    } else if (minutos >= vespertino && minutos < nocturno) {
      return 'vespertino';
    } else {
      return 'nocturno';
    }
  }

  // Caso especial: nocturno cruza la medianoche
  if (minutos >= matutino && minutos < vespertino) {
    return 'matutino';
  } else if (minutos >= vespertino && minutos < nocturno) {
    return 'vespertino';
  } else {
    return 'nocturno';
  }
}

/**
 * Calcula el turno de una actividad a partir de un objeto Date
 */
export function calcularTurnoDesdeDate(fecha: Date, config: ConfiguracionHorarios): TurnoActividad {
  const hora = fecha.toTimeString().slice(0, 5); // "HH:mm"
  return calcularTurno(hora, config);
}

/**
 * Verifica si una hora está dentro de un turno específico
 */
export function horaEnTurno(hora: string, turno: TurnoActividad, config: ConfiguracionHorarios): boolean {
  return calcularTurno(hora, config) === turno;
}

/**
 * Obtiene el rango de horas de un turno en formato legible
 */
export function getRangoTurno(turno: TurnoActividad, config: ConfiguracionHorarios): string {
  const matutino = config.chequeoDiario.matutino;
  const vespertino = config.chequeoDiario.vespertino;
  const nocturno = config.chequeoDiario.nocturno;

  // Calcular hora fin (1 minuto antes del siguiente turno)
  const restarMinuto = (hora: string): string => {
    const [h, m] = hora.split(':').map(Number);
    if (m === 0) {
      return `${String(h - 1).padStart(2, '0')}:59`;
    }
    return `${String(h).padStart(2, '0')}:${String(m - 1).padStart(2, '0')}`;
  };

  switch (turno) {
    case 'matutino':
      return `${matutino} - ${restarMinuto(vespertino)}`;
    case 'vespertino':
      return `${vespertino} - ${restarMinuto(nocturno)}`;
    case 'nocturno':
      return `${nocturno} - ${restarMinuto(matutino)}`;
    default:
      return '';
  }
}

/**
 * Obtiene el label y color de un turno
 */
export function getTurnoInfo(turno: TurnoActividad): { label: string; icon: string; color: string } {
  switch (turno) {
    case 'matutino':
      return { label: 'Matutino', icon: '🌅', color: 'bg-amber-100 text-amber-800' };
    case 'vespertino':
      return { label: 'Vespertino', icon: '🌤️', color: 'bg-orange-100 text-orange-800' };
    case 'nocturno':
      return { label: 'Nocturno', icon: '🌙', color: 'bg-indigo-100 text-indigo-800' };
  }
}

export const TURNOS_ACTIVIDAD: { value: TurnoActividad; label: string; icon: string }[] = [
  { value: 'matutino', label: 'Matutino', icon: '🌅' },
  { value: 'vespertino', label: 'Vespertino', icon: '🌤️' },
  { value: 'nocturno', label: 'Nocturno', icon: '🌙' },
];
