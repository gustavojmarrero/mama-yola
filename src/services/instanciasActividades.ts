// Servicio para CRUD de Instancias de Actividades

import {
  collection,
  doc,
  setDoc,
  updateDoc,
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
  InstanciaActividad,
  ProgramacionActividad,
  EstadoInstancia,
  EjecucionActividad,
  OmisionActividad,
  ActividadElegida,
} from '../types/actividades';
import { generarIdInstancia } from '../types/actividades';
import type { TurnoActividad, ParticipacionActividad } from '../types';

const PACIENTE_ID = 'paciente-principal';

/**
 * Obtiene la referencia a la colección de instancias
 */
function getInstanciasRef() {
  return collection(db, 'pacientes', PACIENTE_ID, 'instanciasActividades');
}

/**
 * Convierte un documento de Firestore a InstanciaActividad
 */
function docToInstancia(
  docSnap: { id: string; data: () => Record<string, unknown> }
): InstanciaActividad {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    pacienteId: data.pacienteId as string,
    programacionId: data.programacionId as string,
    modalidad: data.modalidad as InstanciaActividad['modalidad'],
    tipo: data.tipo as InstanciaActividad['tipo'],
    turno: data.turno as TurnoActividad,
    fecha: (data.fecha as Timestamp)?.toDate() || new Date(),
    horaPreferida: data.horaPreferida as string,
    actividadDefinida: data.actividadDefinida as InstanciaActividad['actividadDefinida'],
    slotAbierto: data.slotAbierto as InstanciaActividad['slotAbierto'],
    actividadElegida: data.actividadElegida as InstanciaActividad['actividadElegida'],
    estado: data.estado as EstadoInstancia,
    ejecucion: data.ejecucion
      ? {
          ...data.ejecucion as EjecucionActividad,
          completadaEn: ((data.ejecucion as EjecucionActividad).completadaEn as unknown as Timestamp)?.toDate(),
        }
      : undefined,
    omision: data.omision
      ? {
          ...data.omision as OmisionActividad,
          omitidaEn: ((data.omision as OmisionActividad).omitidaEn as unknown as Timestamp)?.toDate(),
        }
      : undefined,
    generadaAutomaticamente: data.generadaAutomaticamente as boolean,
    creadoEn: (data.creadoEn as Timestamp)?.toDate() || new Date(),
    actualizadoEn: (data.actualizadoEn as Timestamp)?.toDate() || new Date(),
  };
}

/**
 * Normaliza una fecha a medianoche (00:00:00)
 */
function normalizarFecha(fecha: Date): Date {
  const normalizada = new Date(fecha);
  normalizada.setHours(0, 0, 0, 0);
  return normalizada;
}

/**
 * Obtiene las instancias para una fecha específica
 */
export async function getInstanciasPorFecha(
  fecha: Date
): Promise<InstanciaActividad[]> {
  const fechaNormalizada = normalizarFecha(fecha);
  const fechaSiguiente = new Date(fechaNormalizada);
  fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);

  const q = query(
    getInstanciasRef(),
    where('fecha', '>=', Timestamp.fromDate(fechaNormalizada)),
    where('fecha', '<', Timestamp.fromDate(fechaSiguiente)),
    orderBy('fecha', 'asc'),
    orderBy('horaPreferida', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToInstancia);
}

/**
 * Obtiene las instancias para un rango de fechas
 */
export async function getInstanciasPorRango(
  fechaInicio: Date,
  fechaFin: Date
): Promise<InstanciaActividad[]> {
  const inicio = normalizarFecha(fechaInicio);
  const fin = normalizarFecha(fechaFin);
  fin.setDate(fin.getDate() + 1); // Incluir el día final

  const q = query(
    getInstanciasRef(),
    where('fecha', '>=', Timestamp.fromDate(inicio)),
    where('fecha', '<', Timestamp.fromDate(fin)),
    orderBy('fecha', 'asc'),
    orderBy('horaPreferida', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToInstancia);
}

/**
 * Obtiene una instancia por su ID
 */
export async function getInstanciaById(
  id: string
): Promise<InstanciaActividad | null> {
  const docRef = doc(getInstanciasRef(), id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  return docToInstancia(docSnap);
}

/**
 * Crea una instancia a partir de una programación
 */
export async function crearInstanciaDeProgamacion(
  programacion: ProgramacionActividad,
  fecha: Date,
  generadaAutomaticamente = true
): Promise<string> {
  const fechaNormalizada = normalizarFecha(fecha);
  const instanciaId = generarIdInstancia(programacion.id, fechaNormalizada);

  // Verificar si ya existe
  const existente = await getInstanciaById(instanciaId);
  if (existente) return instanciaId;

  const tipo =
    programacion.modalidad === 'definida'
      ? programacion.actividadDefinida!.tipo
      : programacion.slotAbierto!.tipo;

  const datos: Omit<InstanciaActividad, 'id'> = {
    pacienteId: PACIENTE_ID,
    programacionId: programacion.id,
    modalidad: programacion.modalidad,
    tipo,
    turno: programacion.turno,
    fecha: fechaNormalizada,
    horaPreferida: programacion.horaPreferida,
    actividadDefinida:
      programacion.modalidad === 'definida'
        ? programacion.actividadDefinida
        : undefined,
    slotAbierto:
      programacion.modalidad === 'slot_abierto'
        ? programacion.slotAbierto
        : undefined,
    estado: 'pendiente',
    generadaAutomaticamente,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  };

  const docRef = doc(getInstanciasRef(), instanciaId);
  await setDoc(docRef, {
    ...datos,
    fecha: Timestamp.fromDate(fechaNormalizada),
    creadoEn: Timestamp.now(),
    actualizadoEn: Timestamp.now(),
  });

  return instanciaId;
}

/**
 * Genera instancias para todas las programaciones activas en una fecha
 */
export async function generarInstanciasParaFecha(
  fecha: Date,
  programaciones: ProgramacionActividad[]
): Promise<number> {
  const fechaNormalizada = normalizarFecha(fecha);
  const diaSemana = fechaNormalizada.getDay();

  // Filtrar programaciones que aplican para este día
  const programacionesDelDia = programaciones.filter(
    (p) => p.activo && p.diasSemana.includes(diaSemana)
  );

  let creadas = 0;
  const batch = writeBatch(db);

  for (const prog of programacionesDelDia) {
    const instanciaId = generarIdInstancia(prog.id, fechaNormalizada);
    const docRef = doc(getInstanciasRef(), instanciaId);

    // Verificar si ya existe
    const existente = await getDoc(docRef);
    if (existente.exists()) continue;

    const tipo =
      prog.modalidad === 'definida'
        ? prog.actividadDefinida!.tipo
        : prog.slotAbierto!.tipo;

    batch.set(docRef, {
      pacienteId: PACIENTE_ID,
      programacionId: prog.id,
      modalidad: prog.modalidad,
      tipo,
      turno: prog.turno,
      fecha: Timestamp.fromDate(fechaNormalizada),
      horaPreferida: prog.horaPreferida,
      actividadDefinida:
        prog.modalidad === 'definida' ? prog.actividadDefinida : null,
      slotAbierto:
        prog.modalidad === 'slot_abierto' ? prog.slotAbierto : null,
      estado: 'pendiente',
      generadaAutomaticamente: true,
      creadoEn: Timestamp.now(),
      actualizadoEn: Timestamp.now(),
    });

    creadas++;
  }

  if (creadas > 0) {
    await batch.commit();
  }

  return creadas;
}

/**
 * Completa una instancia de actividad definida
 */
export async function completarInstanciaDefinida(
  instanciaId: string,
  completadaPor: string,
  completadaPorNombre: string,
  duracionReal: number,
  participacion?: ParticipacionActividad,
  estadoAnimo?: string,
  notas?: string
): Promise<void> {
  const docRef = doc(getInstanciasRef(), instanciaId);

  const ejecucion: EjecucionActividad = {
    completadaPor,
    completadaPorNombre,
    completadaEn: new Date(),
    duracionReal,
    participacion,
    estadoAnimo,
    notas,
  };

  await updateDoc(docRef, {
    estado: 'completada' as EstadoInstancia,
    ejecucion: {
      ...ejecucion,
      completadaEn: Timestamp.now(),
    },
    actualizadoEn: Timestamp.now(),
  });
}

/**
 * Completa un slot abierto con la actividad elegida
 */
export async function completarSlotAbierto(
  instanciaId: string,
  actividadElegida: ActividadElegida,
  completadaPor: string,
  completadaPorNombre: string,
  duracionReal: number,
  participacion?: ParticipacionActividad,
  estadoAnimo?: string,
  notas?: string
): Promise<void> {
  const docRef = doc(getInstanciasRef(), instanciaId);

  const ejecucion: EjecucionActividad = {
    completadaPor,
    completadaPorNombre,
    completadaEn: new Date(),
    duracionReal,
    participacion,
    estadoAnimo,
    notas,
  };

  await updateDoc(docRef, {
    estado: 'completada' as EstadoInstancia,
    actividadElegida,
    ejecucion: {
      ...ejecucion,
      completadaEn: Timestamp.now(),
    },
    actualizadoEn: Timestamp.now(),
  });
}

/**
 * Marca una instancia como omitida
 */
export async function omitirInstancia(
  instanciaId: string,
  motivo: string,
  omitidaPor: string,
  omitidaPorNombre: string
): Promise<void> {
  const docRef = doc(getInstanciasRef(), instanciaId);

  const omision: OmisionActividad = {
    motivo,
    omitidaPor,
    omitidaPorNombre,
    omitidaEn: new Date(),
  };

  await updateDoc(docRef, {
    estado: 'omitida' as EstadoInstancia,
    omision: {
      ...omision,
      omitidaEn: Timestamp.now(),
    },
    actualizadoEn: Timestamp.now(),
  });
}

/**
 * Cancela una instancia
 */
export async function cancelarInstancia(instanciaId: string): Promise<void> {
  const docRef = doc(getInstanciasRef(), instanciaId);

  await updateDoc(docRef, {
    estado: 'cancelada' as EstadoInstancia,
    actualizadoEn: Timestamp.now(),
  });
}

/**
 * Obtiene estadísticas de cumplimiento para un rango de fechas
 */
export async function getEstadisticasCumplimiento(
  fechaInicio: Date,
  fechaFin: Date
): Promise<{
  total: number;
  completadas: number;
  omitidas: number;
  pendientes: number;
  porcentajeCumplimiento: number;
  porTipo: { fisica: { completadas: number; total: number }; cognitiva: { completadas: number; total: number } };
}> {
  const instancias = await getInstanciasPorRango(fechaInicio, fechaFin);

  let total = 0;
  let completadas = 0;
  let omitidas = 0;
  let pendientes = 0;

  const porTipo = {
    fisica: { completadas: 0, total: 0 },
    cognitiva: { completadas: 0, total: 0 },
  };

  instancias.forEach((inst) => {
    total++;
    porTipo[inst.tipo].total++;

    switch (inst.estado) {
      case 'completada':
        completadas++;
        porTipo[inst.tipo].completadas++;
        break;
      case 'omitida':
        omitidas++;
        break;
      case 'pendiente':
        pendientes++;
        break;
    }
  });

  const porcentajeCumplimiento =
    total > 0 ? Math.round((completadas / total) * 100) : 0;

  return {
    total,
    completadas,
    omitidas,
    pendientes,
    porcentajeCumplimiento,
    porTipo,
  };
}

/**
 * Obtiene las instancias pendientes para hoy ordenadas por hora
 */
export async function getInstanciasPendientesHoy(): Promise<InstanciaActividad[]> {
  const hoy = normalizarFecha(new Date());
  const instancias = await getInstanciasPorFecha(hoy);
  return instancias.filter((i) => i.estado === 'pendiente');
}

/**
 * Verifica si una instancia específica ya existe
 */
export async function existeInstancia(
  programacionId: string,
  fecha: Date
): Promise<boolean> {
  const fechaNormalizada = normalizarFecha(fecha);
  const instanciaId = generarIdInstancia(programacionId, fechaNormalizada);
  const docRef = doc(getInstanciasRef(), instanciaId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists();
}

/**
 * Obtiene las instancias por turno para una fecha
 */
export async function getInstanciasPorTurno(
  fecha: Date,
  turno: TurnoActividad
): Promise<InstanciaActividad[]> {
  const instancias = await getInstanciasPorFecha(fecha);
  return instancias.filter((i) => i.turno === turno);
}

/**
 * Elimina las instancias futuras pendientes de una programación específica
 * Esto permite que se regeneren con los nuevos datos de la programación
 * Solo elimina instancias PENDIENTES con fecha >= hoy
 */
export async function eliminarInstanciasFuturasPendientes(
  programacionId: string
): Promise<number> {
  const hoy = normalizarFecha(new Date());

  // Query para obtener instancias pendientes de esta programación desde hoy
  const q = query(
    getInstanciasRef(),
    where('programacionId', '==', programacionId),
    where('estado', '==', 'pendiente'),
    where('fecha', '>=', Timestamp.fromDate(hoy))
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  await batch.commit();
  return snapshot.size;
}
