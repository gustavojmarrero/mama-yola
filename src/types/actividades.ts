// ===== TIPOS DE ACTIVIDADES V2 =====
// Nuevo sistema de programación de actividades con slots abiertos y recurrencia

import type { NivelEnergia, ParticipacionActividad, TurnoActividad } from './index';

// Tipos simplificados (reemplaza los 6 tipos anteriores)
export type TipoActividadV2 = 'fisica' | 'cognitiva';

// Modalidad de programación
export type ModalidadProgramacion = 'definida' | 'slot_abierto';

// Estados de instancia
export type EstadoInstancia = 'pendiente' | 'completada' | 'omitida' | 'cancelada';

// Mapeo de tipos legacy a nuevos
export const MAPEO_TIPOS_ACTIVIDAD: Record<string, TipoActividadV2> = {
  fisica: 'fisica',
  terapeutica: 'fisica',
  salida: 'fisica',
  cognitiva: 'cognitiva',
  recreativa: 'cognitiva',
  social: 'cognitiva',
};

// Configuración visual de tipos
export const TIPOS_ACTIVIDAD_CONFIG: Record<
  TipoActividadV2,
  { label: string; icon: string; color: string; bgColor: string }
> = {
  fisica: {
    label: 'Física',
    icon: '🏃',
    color: 'text-green-800',
    bgColor: 'bg-green-100 border-green-400',
  },
  cognitiva: {
    label: 'Cognitiva',
    icon: '🧠',
    color: 'text-purple-800',
    bgColor: 'bg-purple-100 border-purple-400',
  },
};

// Configuración visual de estados
export const ESTADOS_INSTANCIA_CONFIG: Record<
  EstadoInstancia,
  { label: string; icon: string; color: string; bgColor: string }
> = {
  pendiente: {
    label: 'Pendiente',
    icon: '⏳',
    color: 'text-amber-800',
    bgColor: 'bg-amber-50 border-amber-400',
  },
  completada: {
    label: 'Completada',
    icon: '✓',
    color: 'text-green-800',
    bgColor: 'bg-green-50 border-green-400',
  },
  omitida: {
    label: 'Omitida',
    icon: '⊘',
    color: 'text-red-800',
    bgColor: 'bg-red-50 border-red-400',
  },
  cancelada: {
    label: 'Cancelada',
    icon: '✕',
    color: 'text-gray-800',
    bgColor: 'bg-gray-50 border-gray-400',
  },
};

// ===== PROGRAMACIÓN DE ACTIVIDADES =====

/**
 * Datos de una actividad completamente definida por familiar/supervisor
 */
export interface ActividadDefinida {
  nombre: string;
  tipo: TipoActividadV2;
  descripcion: string;
  duracion: number; // minutos
  ubicacion: string | null;
  materialesNecesarios: string[];
  nivelEnergia: NivelEnergia;
}

/**
 * Configuración de un slot abierto donde el cuidador elige la actividad
 */
export interface SlotAbierto {
  tipo: TipoActividadV2;
  duracionEstimada: number; // minutos
  instrucciones: string;
  plantillasPermitidas: string[]; // IDs de plantillas permitidas (vacío = todas del tipo)
}

/**
 * ProgramacionActividad: Define QUÉ actividad se hace y CUÁNDO
 * Esta es la "receta" que genera instancias diarias via Cloud Function
 */
export interface ProgramacionActividad {
  id: string;
  pacienteId: string;

  // Modalidad de programación
  modalidad: ModalidadProgramacion;

  // Para modalidad 'definida': El familiar/supervisor define todo
  actividadDefinida?: ActividadDefinida;

  // Para modalidad 'slot_abierto': Solo configuración, cuidador elige plantilla
  slotAbierto?: SlotAbierto;

  // Programación temporal
  turno: TurnoActividad;
  horaPreferida: string; // "HH:mm"
  diasSemana: number[]; // [0,1,2,3,4,5,6] donde 0=Domingo, 1=Lunes, etc.

  // Metadata
  creadoPor: string; // userId del familiar/supervisor
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

// ===== INSTANCIAS DE ACTIVIDADES =====

/**
 * Datos de la actividad elegida por el cuidador (para slots abiertos)
 */
export interface ActividadElegida {
  plantillaId: string;
  nombre: string;
  duracion: number;
  descripcion?: string;
  ubicacion?: string;
  nivelEnergia?: NivelEnergia;
}

/**
 * Datos de ejecución cuando se completa la actividad
 */
export interface EjecucionActividad {
  completadaPor: string; // userId
  completadaPorNombre: string;
  completadaEn: Date;
  duracionReal: number; // minutos
  participacion?: ParticipacionActividad;
  estadoAnimo?: string;
  notas?: string;
  fotos?: string[]; // URLs Firebase Storage
}

/**
 * Datos cuando la actividad es omitida
 */
export interface OmisionActividad {
  motivo: string;
  omitidaPor: string; // userId
  omitidaPorNombre: string;
  omitidaEn: Date;
}

/**
 * InstanciaActividad: Una ocurrencia específica de una actividad programada
 * Se genera automáticamente cada día por Cloud Function basada en ProgramacionActividad
 */
export interface InstanciaActividad {
  id: string; // Formato: `${programacionId}_${YYYYMMDD}`
  pacienteId: string;
  programacionId: string; // Referencia a la programación padre

  // Datos desnormalizados para queries rápidos
  modalidad: ModalidadProgramacion;
  tipo: TipoActividadV2;
  turno: TurnoActividad;

  // Fecha específica de esta instancia
  fecha: Date; // Solo la fecha (sin hora, normalizada a 00:00)
  horaPreferida: string; // "HH:mm"

  // Para modalidad 'definida': Datos copiados de la programación
  actividadDefinida?: ActividadDefinida;

  // Para modalidad 'slot_abierto': Configuración del slot
  slotAbierto?: SlotAbierto;

  // Para modalidad 'slot_abierto': El cuidador llena esto al completar
  actividadElegida?: ActividadElegida;

  // Estado de la instancia
  estado: EstadoInstancia;

  // Registro de ejecución (cuando se completa)
  ejecucion?: EjecucionActividad;

  // Si fue omitida
  omision?: OmisionActividad;

  // Metadata
  generadaAutomaticamente: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

// ===== PLANTILLAS V2 =====

/**
 * PlantillaActividadV2: Plantilla de actividad con tipos simplificados
 */
export interface PlantillaActividadV2 {
  id: string;
  pacienteId: string;
  nombre: string;
  tipo: TipoActividadV2; // Solo 'fisica' | 'cognitiva'
  descripcion: string;
  duracion: number; // minutos
  ubicacion?: string;
  materialesNecesarios: string[];
  nivelEnergia: NivelEnergia;
  etiquetas: string[];
  turnos: TurnoActividad[]; // Turnos a los que pertenece
  foto?: string;
  favorita: boolean;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

// ===== HELPERS =====

/**
 * Mapea un tipo de actividad legacy al nuevo tipo
 */
export function mapearTipoActividad(tipoLegacy: string): TipoActividadV2 {
  return MAPEO_TIPOS_ACTIVIDAD[tipoLegacy] || 'cognitiva';
}

/**
 * Verifica si un tipo es legacy (necesita migración)
 */
export function esTipoLegacy(tipo: string): boolean {
  return ['salida', 'recreativa', 'terapeutica', 'social'].includes(tipo);
}

/**
 * Genera el ID de una instancia basada en programación y fecha
 */
export function generarIdInstancia(programacionId: string, fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${programacionId}_${year}${month}${day}`;
}

/**
 * Extrae la fecha de un ID de instancia
 */
export function extraerFechaDeIdInstancia(instanciaId: string): Date | null {
  const parts = instanciaId.split('_');
  if (parts.length < 2) return null;

  const fechaStr = parts[parts.length - 1];
  if (fechaStr.length !== 8) return null;

  const year = parseInt(fechaStr.substring(0, 4));
  const month = parseInt(fechaStr.substring(4, 6)) - 1;
  const day = parseInt(fechaStr.substring(6, 8));

  return new Date(year, month, day);
}

/**
 * Obtiene el nombre a mostrar de una instancia según su modalidad
 */
export function getNombreInstancia(instancia: InstanciaActividad): string {
  if (instancia.modalidad === 'definida' && instancia.actividadDefinida) {
    return instancia.actividadDefinida.nombre;
  }

  if (instancia.modalidad === 'slot_abierto') {
    if (instancia.actividadElegida) {
      return instancia.actividadElegida.nombre;
    }
    return `Slot ${TIPOS_ACTIVIDAD_CONFIG[instancia.tipo].label}`;
  }

  return 'Actividad';
}

/**
 * Obtiene la duración a mostrar de una instancia
 */
export function getDuracionInstancia(instancia: InstanciaActividad): number {
  // Si se completó, usar duración real
  if (instancia.ejecucion?.duracionReal) {
    return instancia.ejecucion.duracionReal;
  }

  // Si eligió actividad (slot abierto), usar duración de la elegida
  if (instancia.actividadElegida?.duracion) {
    return instancia.actividadElegida.duracion;
  }

  // Si es definida, usar duración programada
  if (instancia.actividadDefinida?.duracion) {
    return instancia.actividadDefinida.duracion;
  }

  // Si es slot abierto sin elegir, usar estimada
  if (instancia.slotAbierto?.duracionEstimada) {
    return instancia.slotAbierto.duracionEstimada;
  }

  return 30; // Default
}

// ===== DÍAS DE LA SEMANA =====

export const DIAS_SEMANA = [
  { valor: 0, corto: 'D', largo: 'Domingo' },
  { valor: 1, corto: 'L', largo: 'Lunes' },
  { valor: 2, corto: 'M', largo: 'Martes' },
  { valor: 3, corto: 'X', largo: 'Miércoles' },
  { valor: 4, corto: 'J', largo: 'Jueves' },
  { valor: 5, corto: 'V', largo: 'Viernes' },
  { valor: 6, corto: 'S', largo: 'Sábado' },
];
