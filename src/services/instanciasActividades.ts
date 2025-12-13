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
  deleteField,
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

  if (programacionesDelDia.length === 0) return 0;

  // Obtener todas las instancias existentes del día en UNA sola query
  const instanciasExistentes = await getInstanciasPorFecha(fecha);
  const idsExistentes = new Set(instanciasExistentes.map((i) => i.id));

  let creadas = 0;
  const batch = writeBatch(db);

  for (const prog of programacionesDelDia) {
    const instanciaId = generarIdInstancia(prog.id, fechaNormalizada);

    // Verificar si ya existe usando el Set (sin query adicional)
    if (idsExistentes.has(instanciaId)) continue;

    const docRef = doc(getInstanciasRef(), instanciaId);
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

  // Construir objeto de ejecución sin campos undefined (Firestore no los acepta)
  const ejecucion: Record<string, unknown> = {
    completadaPor,
    completadaPorNombre,
    completadaEn: Timestamp.now(),
    duracionReal,
  };

  if (participacion) ejecucion.participacion = participacion;
  if (estadoAnimo) ejecucion.estadoAnimo = estadoAnimo;
  if (notas) ejecucion.notas = notas;

  await updateDoc(docRef, {
    estado: 'completada' as EstadoInstancia,
    ejecucion,
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

  // Construir objeto de ejecución sin campos undefined (Firestore no los acepta)
  const ejecucion: Record<string, unknown> = {
    completadaPor,
    completadaPorNombre,
    completadaEn: Timestamp.now(),
    duracionReal,
  };

  if (participacion) ejecucion.participacion = participacion;
  if (estadoAnimo) ejecucion.estadoAnimo = estadoAnimo;
  if (notas) ejecucion.notas = notas;

  await updateDoc(docRef, {
    estado: 'completada' as EstadoInstancia,
    actividadElegida,
    ejecucion,
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

/**
 * Elimina todas las instancias PENDIENTES de una lista de programaciones.
 * Se usa después de desactivar programaciones duplicadas para limpiar
 * las instancias huérfanas.
 */
export async function eliminarInstanciasPendientesDeProgramaciones(
  programacionIds: string[]
): Promise<number> {
  if (programacionIds.length === 0) return 0;

  let totalEliminadas = 0;

  // Procesar en lotes de 10 para evitar límites de Firestore
  for (let i = 0; i < programacionIds.length; i += 10) {
    const batch = writeBatch(db);
    const lote = programacionIds.slice(i, i + 10);

    for (const progId of lote) {
      const q = query(
        getInstanciasRef(),
        where('programacionId', '==', progId),
        where('estado', '==', 'pendiente')
      );

      const snapshot = await getDocs(q);
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        totalEliminadas++;
      });
    }

    await batch.commit();
  }

  return totalEliminadas;
}

/**
 * Limpia instancias huérfanas y duplicadas para un rango de fechas.
 *
 * Elimina:
 * 1. Instancias de programaciones que ya no están activas (huérfanas)
 * 2. Para slots: si hay una completada y una pendiente del mismo tipo+hora, elimina la pendiente
 * 3. Actividades definidas duplicadas del mismo nombre+hora (mantiene la de programación activa)
 *
 * @param programacionesActivas - IDs de programaciones activas actuales
 */
export async function limpiarInstanciasHuerfanas(
  fechaInicio: Date,
  fechaFin: Date,
  programacionesActivasIds: Set<string>
): Promise<{
  eliminadas: number;
  instanciasEliminadas: string[];
}> {
  const instancias = await getInstanciasPorRango(fechaInicio, fechaFin);
  const instanciasEliminadas: string[] = [];

  // Agrupar por fecha + hora
  const porFechaHora = new Map<string, InstanciaActividad[]>();
  instancias.forEach(inst => {
    const fechaStr = inst.fecha.toISOString().split('T')[0];
    const key = `${fechaStr}_${inst.horaPreferida}`;
    if (!porFechaHora.has(key)) porFechaHora.set(key, []);
    porFechaHora.get(key)!.push(inst);
  });

  for (const [, grupo] of porFechaHora) {
    // Si solo hay una instancia, verificar si es huérfana
    if (grupo.length === 1) {
      const inst = grupo[0];
      // Solo eliminar huérfanas PENDIENTES (las completadas se mantienen como histórico)
      if (!programacionesActivasIds.has(inst.programacionId) && inst.estado === 'pendiente') {
        instanciasEliminadas.push(inst.id);
      }
      continue;
    }

    // Hay múltiples instancias para esta fecha+hora
    const activas = grupo.filter(i => programacionesActivasIds.has(i.programacionId));
    const huerfanas = grupo.filter(i => !programacionesActivasIds.has(i.programacionId));
    const completadas = grupo.filter(i => i.estado === 'completada');
    const pendientes = grupo.filter(i => i.estado === 'pendiente');

    // 1. Eliminar huérfanas PENDIENTES
    huerfanas.forEach(h => {
      if (h.estado === 'pendiente' && !instanciasEliminadas.includes(h.id)) {
        instanciasEliminadas.push(h.id);
      }
    });

    // 2. Si hay completadas, eliminar pendientes del mismo tipo (son redundantes)
    if (completadas.length > 0 && pendientes.length > 0) {
      const tiposCompletados = new Set(completadas.map(c => c.tipo));
      pendientes.forEach(p => {
        if (tiposCompletados.has(p.tipo) && !instanciasEliminadas.includes(p.id)) {
          instanciasEliminadas.push(p.id);
        }
      });
    }

    // 3. Si hay múltiples activas del mismo tipo, mantener solo una
    const activasPorTipo = new Map<string, InstanciaActividad[]>();
    activas.forEach(a => {
      const tipoKey = a.modalidad === 'definida'
        ? `definida_${a.actividadDefinida?.nombre}`
        : `slot_${a.tipo}`;
      if (!activasPorTipo.has(tipoKey)) activasPorTipo.set(tipoKey, []);
      activasPorTipo.get(tipoKey)!.push(a);
    });

    for (const [, duplicadas] of activasPorTipo) {
      if (duplicadas.length > 1) {
        // Ordenar: completadas primero, luego por fecha de creación
        const ordenadas = duplicadas.sort((a, b) => {
          if (a.estado === 'completada' && b.estado !== 'completada') return -1;
          if (b.estado === 'completada' && a.estado !== 'completada') return 1;
          return a.creadoEn.getTime() - b.creadoEn.getTime();
        });
        // Eliminar todas excepto la primera
        ordenadas.slice(1).forEach(dup => {
          if (!instanciasEliminadas.includes(dup.id)) {
            instanciasEliminadas.push(dup.id);
          }
        });
      }
    }
  }

  // Eliminar en batches
  if (instanciasEliminadas.length > 0) {
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const id of instanciasEliminadas) {
      const docRef = doc(getInstanciasRef(), id);
      batch.delete(docRef);
      batchCount++;

      if (batchCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  }

  return {
    eliminadas: instanciasEliminadas.length,
    instanciasEliminadas,
  };
}

/**
 * @deprecated Usar limpiarInstanciasHuerfanas en su lugar
 */
export async function limpiarInstanciasDuplicadas(
  fechaInicio: Date,
  fechaFin: Date
): Promise<{
  duplicadosEncontrados: number;
  instanciasEliminadas: string[];
}> {
  // Función legacy - redirige a la nueva
  const result = await limpiarInstanciasHuerfanas(fechaInicio, fechaFin, new Set());
  return {
    duplicadosEncontrados: result.eliminadas,
    instanciasEliminadas: result.instanciasEliminadas,
  };
}

/**
 * Actualiza una instancia de slot completada (cambiar actividad elegida y/o detalles)
 */
export async function actualizarInstanciaCompletada(
  instanciaId: string,
  actividadElegida: ActividadElegida,
  duracionReal: number,
  participacion?: ParticipacionActividad,
  estadoAnimo?: string,
  notas?: string
): Promise<void> {
  const docRef = doc(getInstanciasRef(), instanciaId);

  // Construir objeto de ejecución sin campos undefined (Firestore no los acepta)
  const ejecucion: Record<string, unknown> = {
    duracionReal,
  };

  if (participacion) ejecucion.participacion = participacion;
  if (estadoAnimo) ejecucion.estadoAnimo = estadoAnimo;
  if (notas) ejecucion.notas = notas;

  // Obtener la instancia actual para preservar datos de completado originales
  const instanciaDoc = await getDoc(docRef);
  if (!instanciaDoc.exists()) {
    throw new Error('Instancia no encontrada');
  }

  const instanciaActual = instanciaDoc.data();
  const ejecucionActual = instanciaActual.ejecucion || {};

  await updateDoc(docRef, {
    actividadElegida,
    ejecucion: {
      ...ejecucionActual,
      ...ejecucion,
    },
    actualizadoEn: Timestamp.now(),
  });
}

/**
 * Vacía una instancia completada, eliminando la actividad elegida y volviendo a estado pendiente
 */
export async function vaciarInstanciaCompletada(instanciaId: string): Promise<void> {
  const docRef = doc(getInstanciasRef(), instanciaId);

  await updateDoc(docRef, {
    estado: 'pendiente' as EstadoInstancia,
    actividadElegida: deleteField(),
    ejecucion: deleteField(),
    actualizadoEn: Timestamp.now(),
  });
}
