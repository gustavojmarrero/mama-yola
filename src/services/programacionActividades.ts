// Servicio para CRUD de Programaciones de Actividades

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  ProgramacionActividad,
  TipoActividadV2,
  ModalidadProgramacion,
  ActividadDefinida,
  SlotAbierto,
} from '../types/actividades';
import type { TurnoActividad } from '../types';

const PACIENTE_ID = 'paciente-principal';

/**
 * Obtiene la referencia a la colección de programaciones
 */
function getProgramacionesRef() {
  return collection(db, 'pacientes', PACIENTE_ID, 'programacionesActividades');
}

/**
 * Convierte un documento de Firestore a ProgramacionActividad
 */
function docToProgramacion(
  docSnap: { id: string; data: () => Record<string, unknown> }
): ProgramacionActividad {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    pacienteId: data.pacienteId as string,
    modalidad: data.modalidad as ModalidadProgramacion,
    actividadDefinida: data.actividadDefinida as ActividadDefinida | undefined,
    slotAbierto: data.slotAbierto as SlotAbierto | undefined,
    turno: data.turno as TurnoActividad,
    horaPreferida: data.horaPreferida as string,
    diasSemana: data.diasSemana as number[],
    creadoPor: data.creadoPor as string,
    activo: data.activo as boolean,
    creadoEn: (data.creadoEn as Timestamp)?.toDate() || new Date(),
    actualizadoEn: (data.actualizadoEn as Timestamp)?.toDate() || new Date(),
  };
}

/**
 * Obtiene todas las programaciones activas
 */
export async function getProgramacionesActivas(): Promise<ProgramacionActividad[]> {
  const q = query(
    getProgramacionesRef(),
    where('activo', '==', true),
    orderBy('horaPreferida', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToProgramacion);
}

/**
 * Obtiene las programaciones activas para un día específico de la semana
 */
export async function getProgramacionesPorDia(
  diaSemana: number
): Promise<ProgramacionActividad[]> {
  const q = query(
    getProgramacionesRef(),
    where('activo', '==', true),
    where('diasSemana', 'array-contains', diaSemana)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToProgramacion);
}

/**
 * Obtiene las programaciones por turno
 */
export async function getProgramacionesPorTurno(
  turno: TurnoActividad
): Promise<ProgramacionActividad[]> {
  const q = query(
    getProgramacionesRef(),
    where('activo', '==', true),
    where('turno', '==', turno),
    orderBy('horaPreferida', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToProgramacion);
}

/**
 * Obtiene las programaciones por tipo de actividad
 */
export async function getProgramacionesPorTipo(
  tipo: TipoActividadV2
): Promise<ProgramacionActividad[]> {
  const programaciones = await getProgramacionesActivas();
  return programaciones.filter((p) => {
    if (p.modalidad === 'definida' && p.actividadDefinida) {
      return p.actividadDefinida.tipo === tipo;
    }
    if (p.modalidad === 'slot_abierto' && p.slotAbierto) {
      return p.slotAbierto.tipo === tipo;
    }
    return false;
  });
}

/**
 * Obtiene una programación por ID
 */
export async function getProgramacionById(
  id: string
): Promise<ProgramacionActividad | null> {
  const docRef = doc(getProgramacionesRef(), id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  return docToProgramacion(docSnap);
}

/**
 * Crea una nueva programación de actividad definida
 */
export async function crearProgramacionDefinida(
  actividad: ActividadDefinida,
  turno: TurnoActividad,
  horaPreferida: string,
  diasSemana: number[],
  creadoPor: string
): Promise<string> {
  const docRef = await addDoc(getProgramacionesRef(), {
    pacienteId: PACIENTE_ID,
    modalidad: 'definida' as ModalidadProgramacion,
    actividadDefinida: actividad,
    turno,
    horaPreferida,
    diasSemana,
    creadoPor,
    activo: true,
    creadoEn: Timestamp.now(),
    actualizadoEn: Timestamp.now(),
  });

  return docRef.id;
}

/**
 * Crea una nueva programación de slot abierto
 */
export async function crearProgramacionSlotAbierto(
  slot: SlotAbierto,
  turno: TurnoActividad,
  horaPreferida: string,
  diasSemana: number[],
  creadoPor: string
): Promise<string> {
  const docRef = await addDoc(getProgramacionesRef(), {
    pacienteId: PACIENTE_ID,
    modalidad: 'slot_abierto' as ModalidadProgramacion,
    slotAbierto: slot,
    turno,
    horaPreferida,
    diasSemana,
    creadoPor,
    activo: true,
    creadoEn: Timestamp.now(),
    actualizadoEn: Timestamp.now(),
  });

  return docRef.id;
}

/**
 * Actualiza una programación existente
 */
export async function actualizarProgramacion(
  id: string,
  datos: Partial<Omit<ProgramacionActividad, 'id' | 'pacienteId' | 'creadoEn'>>
): Promise<void> {
  const docRef = doc(getProgramacionesRef(), id);
  await updateDoc(docRef, {
    ...datos,
    actualizadoEn: Timestamp.now(),
  });
}

/**
 * Desactiva una programación (soft delete)
 */
export async function desactivarProgramacion(id: string): Promise<void> {
  const docRef = doc(getProgramacionesRef(), id);
  await updateDoc(docRef, {
    activo: false,
    actualizadoEn: Timestamp.now(),
  });
}

/**
 * Elimina una programación (hard delete)
 */
export async function eliminarProgramacion(id: string): Promise<void> {
  const docRef = doc(getProgramacionesRef(), id);
  await deleteDoc(docRef);
}

/**
 * Obtiene el tipo de actividad de una programación
 */
export function getTipoDeProgramacion(
  programacion: ProgramacionActividad
): TipoActividadV2 {
  if (programacion.modalidad === 'definida' && programacion.actividadDefinida) {
    return programacion.actividadDefinida.tipo;
  }
  if (programacion.modalidad === 'slot_abierto' && programacion.slotAbierto) {
    return programacion.slotAbierto.tipo;
  }
  return 'cognitiva'; // default
}

/**
 * Obtiene el nombre a mostrar de una programación
 */
export function getNombreProgramacion(
  programacion: ProgramacionActividad
): string {
  if (programacion.modalidad === 'definida' && programacion.actividadDefinida) {
    return programacion.actividadDefinida.nombre;
  }
  if (programacion.modalidad === 'slot_abierto' && programacion.slotAbierto) {
    const tipo = programacion.slotAbierto.tipo === 'fisica' ? 'Física' : 'Cognitiva';
    return `Actividad Opcional (${tipo})`;
  }
  return 'Actividad';
}

/**
 * Obtiene la duración de una programación
 */
export function getDuracionProgramacion(
  programacion: ProgramacionActividad
): number {
  if (programacion.modalidad === 'definida' && programacion.actividadDefinida) {
    return programacion.actividadDefinida.duracion;
  }
  if (programacion.modalidad === 'slot_abierto' && programacion.slotAbierto) {
    return programacion.slotAbierto.duracionEstimada;
  }
  return 30; // default
}

/**
 * Duplica una programación existente
 */
export async function duplicarProgramacion(
  id: string,
  creadoPor: string
): Promise<string> {
  const programacion = await getProgramacionById(id);
  if (!programacion) throw new Error('Programación no encontrada');

  const { id: _, creadoEn: __, actualizadoEn: ___, ...datos } = programacion;

  const docRef = await addDoc(getProgramacionesRef(), {
    ...datos,
    creadoPor,
    creadoEn: Timestamp.now(),
    actualizadoEn: Timestamp.now(),
  });

  return docRef.id;
}

/**
 * Cuenta las programaciones activas por tipo
 */
export async function contarProgramacionesPorTipo(): Promise<{
  fisica: number;
  cognitiva: number;
  total: number;
}> {
  const programaciones = await getProgramacionesActivas();

  let fisica = 0;
  let cognitiva = 0;

  programaciones.forEach((p) => {
    const tipo = getTipoDeProgramacion(p);
    if (tipo === 'fisica') fisica++;
    else cognitiva++;
  });

  return { fisica, cognitiva, total: programaciones.length };
}
