import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  SolicitudMaterial,
  ItemSolicitudMaterial,
  EstadoSolicitudMaterial,
  UrgenciaMaterial,
  Rol,
} from '../types';

const PACIENTE_ID = 'paciente-principal';

// Datos para crear una nueva solicitud
export interface CrearSolicitudData {
  items: ItemSolicitudMaterial[];
  urgencia: UrgenciaMaterial;
  motivoGeneral?: string;
  fechaNecesaria?: Date;
  solicitadoPor: string;
  solicitadoPorNombre: string;
  solicitadoPorRol: Rol;
}

interface UseSolicitudesMaterialesReturn {
  solicitudes: SolicitudMaterial[];
  solicitudesPendientes: SolicitudMaterial[];
  solicitudesAprobadas: SolicitudMaterial[];
  loading: boolean;
  error: string | null;
  contadorPendientes: number;
  contadorUrgentes: number;

  // Acciones
  crearSolicitud: (data: CrearSolicitudData) => Promise<void>;
  aprobarSolicitud: (
    solicitudId: string,
    usuarioId: string,
    usuarioNombre: string,
    notas?: string
  ) => Promise<void>;
  rechazarSolicitud: (
    solicitudId: string,
    motivoRechazo: string,
    usuarioId: string,
    usuarioNombre: string
  ) => Promise<void>;
  marcarComoComprada: (
    solicitudId: string,
    usuarioId: string,
    usuarioNombre: string,
    notasCompra?: string,
    costoTotal?: number
  ) => Promise<void>;
  marcarComoEntregada: (
    solicitudId: string,
    usuarioId: string,
    usuarioNombre: string,
    notasEntrega?: string
  ) => Promise<void>;
  cancelarSolicitud: (solicitudId: string) => Promise<void>;
  recargarDatos: () => Promise<void>;
}

// Helper para convertir documento de Firestore a SolicitudMaterial
function docToSolicitud(docSnap: { id: string; data: () => Record<string, unknown> }): SolicitudMaterial {
  const data = docSnap.data() as Record<string, unknown>;
  return {
    id: docSnap.id,
    pacienteId: data.pacienteId as string,
    solicitadoPor: data.solicitadoPor as string,
    solicitadoPorNombre: data.solicitadoPorNombre as string,
    solicitadoPorRol: data.solicitadoPorRol as Rol,
    items: data.items as ItemSolicitudMaterial[],
    estado: data.estado as EstadoSolicitudMaterial,
    urgencia: data.urgencia as UrgenciaMaterial,
    motivoGeneral: data.motivoGeneral as string | undefined,
    fechaNecesaria: (data.fechaNecesaria as { toDate: () => Date } | undefined)?.toDate(),
    revisadoPor: data.revisadoPor as string | undefined,
    revisadoPorNombre: data.revisadoPorNombre as string | undefined,
    revisadoEn: (data.revisadoEn as { toDate: () => Date } | undefined)?.toDate(),
    motivoRechazo: data.motivoRechazo as string | undefined,
    compradoPor: data.compradoPor as string | undefined,
    compradoPorNombre: data.compradoPorNombre as string | undefined,
    compradoEn: (data.compradoEn as { toDate: () => Date } | undefined)?.toDate(),
    notasCompra: data.notasCompra as string | undefined,
    costoTotal: data.costoTotal as number | undefined,
    entregadoPor: data.entregadoPor as string | undefined,
    entregadoPorNombre: data.entregadoPorNombre as string | undefined,
    entregadoEn: (data.entregadoEn as { toDate: () => Date } | undefined)?.toDate(),
    notasEntrega: data.notasEntrega as string | undefined,
    creadoEn: (data.creadoEn as { toDate: () => Date })?.toDate() || new Date(),
    actualizadoEn: (data.actualizadoEn as { toDate: () => Date })?.toDate() || new Date(),
  };
}

export function useSolicitudesMateriales(): UseSolicitudesMaterialesReturn {
  const [solicitudes, setSolicitudes] = useState<SolicitudMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar todas las solicitudes
  const cargarSolicitudes = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'solicitudesMateriales'),
        orderBy('creadoEn', 'desc')
      );
      const snapshot = await getDocs(q);
      const lista: SolicitudMaterial[] = [];

      snapshot.forEach((docSnap) => {
        lista.push(docToSolicitud(docSnap));
      });

      return lista;
    } catch (err) {
      console.error('Error al cargar solicitudes:', err);
      throw err;
    }
  }, []);

  // Función principal para recargar datos
  const recargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const lista = await cargarSolicitudes();
      setSolicitudes(lista);
    } catch (err) {
      setError('Error al cargar solicitudes de materiales');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [cargarSolicitudes]);

  // Crear nueva solicitud
  const crearSolicitud = useCallback(async (data: CrearSolicitudData): Promise<void> => {
    try {
      const ahora = Timestamp.now();

      const nuevaSolicitud = {
        pacienteId: PACIENTE_ID,
        solicitadoPor: data.solicitadoPor,
        solicitadoPorNombre: data.solicitadoPorNombre,
        solicitadoPorRol: data.solicitadoPorRol,
        items: data.items,
        estado: 'pendiente' as EstadoSolicitudMaterial,
        urgencia: data.urgencia,
        motivoGeneral: data.motivoGeneral || undefined,
        fechaNecesaria: data.fechaNecesaria ? Timestamp.fromDate(data.fechaNecesaria) : undefined,
        creadoEn: ahora,
        actualizadoEn: ahora,
      };

      await addDoc(
        collection(db, 'pacientes', PACIENTE_ID, 'solicitudesMateriales'),
        nuevaSolicitud
      );

      await recargarDatos();
    } catch (err) {
      console.error('Error al crear solicitud:', err);
      throw err;
    }
  }, [recargarDatos]);

  // Aprobar solicitud
  const aprobarSolicitud = useCallback(async (
    solicitudId: string,
    usuarioId: string,
    usuarioNombre: string,
    notas?: string
  ): Promise<void> => {
    try {
      const ahora = Timestamp.now();
      const solicitudRef = doc(db, 'pacientes', PACIENTE_ID, 'solicitudesMateriales', solicitudId);

      await updateDoc(solicitudRef, {
        estado: 'aprobada',
        revisadoPor: usuarioId,
        revisadoPorNombre: usuarioNombre,
        revisadoEn: ahora,
        ...(notas && { notasCompra: notas }),
        actualizadoEn: ahora,
      });

      await recargarDatos();
    } catch (err) {
      console.error('Error al aprobar solicitud:', err);
      throw err;
    }
  }, [recargarDatos]);

  // Rechazar solicitud
  const rechazarSolicitud = useCallback(async (
    solicitudId: string,
    motivoRechazo: string,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<void> => {
    try {
      const ahora = Timestamp.now();
      const solicitudRef = doc(db, 'pacientes', PACIENTE_ID, 'solicitudesMateriales', solicitudId);

      await updateDoc(solicitudRef, {
        estado: 'rechazada',
        revisadoPor: usuarioId,
        revisadoPorNombre: usuarioNombre,
        revisadoEn: ahora,
        motivoRechazo,
        actualizadoEn: ahora,
      });

      await recargarDatos();
    } catch (err) {
      console.error('Error al rechazar solicitud:', err);
      throw err;
    }
  }, [recargarDatos]);

  // Marcar como comprada
  const marcarComoComprada = useCallback(async (
    solicitudId: string,
    usuarioId: string,
    usuarioNombre: string,
    notasCompra?: string,
    costoTotal?: number
  ): Promise<void> => {
    try {
      const ahora = Timestamp.now();
      const solicitudRef = doc(db, 'pacientes', PACIENTE_ID, 'solicitudesMateriales', solicitudId);

      await updateDoc(solicitudRef, {
        estado: 'comprada',
        compradoPor: usuarioId,
        compradoPorNombre: usuarioNombre,
        compradoEn: ahora,
        ...(notasCompra && { notasCompra }),
        ...(costoTotal !== undefined && { costoTotal }),
        actualizadoEn: ahora,
      });

      await recargarDatos();
    } catch (err) {
      console.error('Error al marcar como comprada:', err);
      throw err;
    }
  }, [recargarDatos]);

  // Marcar como entregada
  const marcarComoEntregada = useCallback(async (
    solicitudId: string,
    usuarioId: string,
    usuarioNombre: string,
    notasEntrega?: string
  ): Promise<void> => {
    try {
      const ahora = Timestamp.now();
      const solicitudRef = doc(db, 'pacientes', PACIENTE_ID, 'solicitudesMateriales', solicitudId);

      await updateDoc(solicitudRef, {
        estado: 'entregada',
        entregadoPor: usuarioId,
        entregadoPorNombre: usuarioNombre,
        entregadoEn: ahora,
        ...(notasEntrega && { notasEntrega }),
        actualizadoEn: ahora,
      });

      await recargarDatos();
    } catch (err) {
      console.error('Error al marcar como entregada:', err);
      throw err;
    }
  }, [recargarDatos]);

  // Cancelar solicitud (solo si está pendiente)
  const cancelarSolicitud = useCallback(async (solicitudId: string): Promise<void> => {
    try {
      const solicitud = solicitudes.find(s => s.id === solicitudId);
      if (!solicitud) throw new Error('Solicitud no encontrada');
      if (solicitud.estado !== 'pendiente') {
        throw new Error('Solo se pueden cancelar solicitudes pendientes');
      }

      const ahora = Timestamp.now();
      const solicitudRef = doc(db, 'pacientes', PACIENTE_ID, 'solicitudesMateriales', solicitudId);

      await updateDoc(solicitudRef, {
        estado: 'rechazada',
        motivoRechazo: 'Cancelada por el solicitante',
        actualizadoEn: ahora,
      });

      await recargarDatos();
    } catch (err) {
      console.error('Error al cancelar solicitud:', err);
      throw err;
    }
  }, [solicitudes, recargarDatos]);

  // Cargar datos al montar
  useEffect(() => {
    recargarDatos();
  }, [recargarDatos]);

  // Calcular listas filtradas
  const solicitudesPendientes = solicitudes.filter(s => s.estado === 'pendiente');
  const solicitudesAprobadas = solicitudes.filter(s => s.estado === 'aprobada');
  const contadorUrgentes = solicitudesPendientes.filter(
    s => s.urgencia === 'urgente' || s.urgencia === 'alta'
  ).length;

  return {
    solicitudes,
    solicitudesPendientes,
    solicitudesAprobadas,
    loading,
    error,
    contadorPendientes: solicitudesPendientes.length,
    contadorUrgentes,
    crearSolicitud,
    aprobarSolicitud,
    rechazarSolicitud,
    marcarComoComprada,
    marcarComoEntregada,
    cancelarSolicitud,
    recargarDatos,
  };
}
