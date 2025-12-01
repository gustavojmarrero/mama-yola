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
  ReporteDiferencia,
  EstadoReporteDiferencia,
  TipoInventarioAfectado,
  Rol,
  ItemInventario,
} from '../types';

const PACIENTE_ID = 'paciente-principal';

interface UseReportesDiferenciaReturn {
  reportesPendientes: ReporteDiferencia[];
  reportesHistorial: ReporteDiferencia[];
  loading: boolean;
  error: string | null;
  contadorPendientes: number;

  // Acciones
  crearReporte: (
    item: ItemInventario,
    tipoInventario: TipoInventarioAfectado,
    cantidadReal: number,
    motivo: string,
    usuarioId: string,
    usuarioNombre: string,
    usuarioRol: Rol
  ) => Promise<void>;
  aprobarReporte: (
    reporteId: string,
    notas: string,
    ajustarInventario: boolean,
    usuarioId: string,
    usuarioNombre: string
  ) => Promise<void>;
  rechazarReporte: (
    reporteId: string,
    notas: string,
    usuarioId: string,
    usuarioNombre: string
  ) => Promise<void>;
  recargarDatos: () => Promise<void>;
}

export function useReportesDiferencia(): UseReportesDiferenciaReturn {
  const [reportesPendientes, setReportesPendientes] = useState<ReporteDiferencia[]>([]);
  const [reportesHistorial, setReportesHistorial] = useState<ReporteDiferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar reportes pendientes
  const cargarReportesPendientes = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'reportesDiferencias'),
        where('estado', '==', 'pendiente'),
        orderBy('creadoEn', 'desc')
      );
      const snapshot = await getDocs(q);
      const reportes: ReporteDiferencia[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        reportes.push({
          id: docSnap.id,
          pacienteId: data.pacienteId,
          itemId: data.itemId,
          itemNombre: data.itemNombre,
          tipoInventario: data.tipoInventario,
          cantidadRegistrada: data.cantidadRegistrada,
          cantidadReal: data.cantidadReal,
          diferencia: data.diferencia,
          reportadoPor: data.reportadoPor,
          reportadoPorNombre: data.reportadoPorNombre,
          reportadoPorRol: data.reportadoPorRol,
          estado: data.estado,
          motivo: data.motivo,
          resueltoPor: data.resueltoPor,
          resueltoPorNombre: data.resueltoPorNombre,
          resueltoEn: data.resueltoEn?.toDate(),
          notasResolucion: data.notasResolucion,
          ajusteRealizado: data.ajusteRealizado,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        });
      });

      return reportes;
    } catch (err) {
      console.error('Error al cargar reportes pendientes:', err);
      throw err;
    }
  }, []);

  // Cargar historial de reportes (últimos 50)
  const cargarHistorial = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'reportesDiferencias'),
        where('estado', 'in', ['aprobado', 'rechazado']),
        orderBy('creadoEn', 'desc')
      );
      const snapshot = await getDocs(q);
      const reportes: ReporteDiferencia[] = [];

      snapshot.forEach((docSnap) => {
        if (reportes.length >= 50) return; // Limitar a 50
        const data = docSnap.data();
        reportes.push({
          id: docSnap.id,
          pacienteId: data.pacienteId,
          itemId: data.itemId,
          itemNombre: data.itemNombre,
          tipoInventario: data.tipoInventario,
          cantidadRegistrada: data.cantidadRegistrada,
          cantidadReal: data.cantidadReal,
          diferencia: data.diferencia,
          reportadoPor: data.reportadoPor,
          reportadoPorNombre: data.reportadoPorNombre,
          reportadoPorRol: data.reportadoPorRol,
          estado: data.estado,
          motivo: data.motivo,
          resueltoPor: data.resueltoPor,
          resueltoPorNombre: data.resueltoPorNombre,
          resueltoEn: data.resueltoEn?.toDate(),
          notasResolucion: data.notasResolucion,
          ajusteRealizado: data.ajusteRealizado,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        });
      });

      return reportes;
    } catch (err) {
      console.error('Error al cargar historial:', err);
      throw err;
    }
  }, []);

  // Función principal para recargar todos los datos
  const recargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [pendientes, historial] = await Promise.all([
        cargarReportesPendientes(),
        cargarHistorial(),
      ]);

      setReportesPendientes(pendientes);
      setReportesHistorial(historial);
    } catch (err) {
      setError('Error al cargar reportes de diferencias');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [cargarReportesPendientes, cargarHistorial]);

  // Crear nuevo reporte
  const crearReporte = useCallback(async (
    item: ItemInventario,
    tipoInventario: TipoInventarioAfectado,
    cantidadReal: number,
    motivo: string,
    usuarioId: string,
    usuarioNombre: string,
    usuarioRol: Rol
  ): Promise<void> => {
    try {
      // Obtener cantidad registrada según el tipo de inventario
      let cantidadRegistrada = 0;
      if (tipoInventario === 'maestro') {
        cantidadRegistrada = item.cantidadMaestro || 0;
      } else if (tipoInventario === 'transito') {
        cantidadRegistrada = item.cantidadTransito || 0;
      } else {
        cantidadRegistrada = item.cantidadOperativo || 0;
      }

      const diferencia = cantidadReal - cantidadRegistrada;
      const ahora = Timestamp.now();

      const nuevoReporte = {
        pacienteId: PACIENTE_ID,
        itemId: item.id,
        itemNombre: item.nombre,
        tipoInventario,
        cantidadRegistrada,
        cantidadReal,
        diferencia,
        reportadoPor: usuarioId,
        reportadoPorNombre: usuarioNombre,
        reportadoPorRol: usuarioRol,
        estado: 'pendiente' as EstadoReporteDiferencia,
        motivo,
        creadoEn: ahora,
        actualizadoEn: ahora,
      };

      await addDoc(
        collection(db, 'pacientes', PACIENTE_ID, 'reportesDiferencias'),
        nuevoReporte
      );

      await recargarDatos();
    } catch (err) {
      console.error('Error al crear reporte de diferencia:', err);
      throw err;
    }
  }, [recargarDatos]);

  // Aprobar reporte
  const aprobarReporte = useCallback(async (
    reporteId: string,
    notas: string,
    ajustarInventario: boolean,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<void> => {
    try {
      const ahora = Timestamp.now();
      const reporteRef = doc(db, 'pacientes', PACIENTE_ID, 'reportesDiferencias', reporteId);

      // Buscar el reporte en la lista
      const reporte = reportesPendientes.find((r) => r.id === reporteId);
      if (!reporte) throw new Error('Reporte no encontrado');

      // Actualizar el reporte
      await updateDoc(reporteRef, {
        estado: 'aprobado',
        resueltoPor: usuarioId,
        resueltoPorNombre: usuarioNombre,
        resueltoEn: ahora,
        notasResolucion: notas,
        ajusteRealizado: ajustarInventario,
        actualizadoEn: ahora,
      });

      // Si se debe ajustar el inventario
      if (ajustarInventario) {
        const itemRef = doc(db, 'pacientes', PACIENTE_ID, 'inventario', reporte.itemId);

        // Determinar qué campo actualizar
        const campoActualizar =
          reporte.tipoInventario === 'maestro'
            ? 'cantidadMaestro'
            : reporte.tipoInventario === 'transito'
            ? 'cantidadTransito'
            : 'cantidadOperativo';

        await updateDoc(itemRef, {
          [campoActualizar]: reporte.cantidadReal,
          actualizadoEn: ahora,
        });

        // Registrar movimiento de ajuste
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'movimientosInventario'), {
          pacienteId: PACIENTE_ID,
          tipo: 'ajuste',
          itemId: reporte.itemId,
          itemNombre: reporte.itemNombre,
          origen: reporte.tipoInventario,
          destino: reporte.tipoInventario,
          cantidad: reporte.cantidadReal,
          motivo: `Ajuste por reporte de diferencia: ${reporte.motivo}`,
          usuarioId,
          usuarioNombre,
          fecha: ahora,
          notas: notas || undefined,
          creadoEn: ahora,
        });
      }

      await recargarDatos();
    } catch (err) {
      console.error('Error al aprobar reporte:', err);
      throw err;
    }
  }, [reportesPendientes, recargarDatos]);

  // Rechazar reporte
  const rechazarReporte = useCallback(async (
    reporteId: string,
    notas: string,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<void> => {
    try {
      const ahora = Timestamp.now();
      const reporteRef = doc(db, 'pacientes', PACIENTE_ID, 'reportesDiferencias', reporteId);

      await updateDoc(reporteRef, {
        estado: 'rechazado',
        resueltoPor: usuarioId,
        resueltoPorNombre: usuarioNombre,
        resueltoEn: ahora,
        notasResolucion: notas,
        ajusteRealizado: false,
        actualizadoEn: ahora,
      });

      await recargarDatos();
    } catch (err) {
      console.error('Error al rechazar reporte:', err);
      throw err;
    }
  }, [recargarDatos]);

  // Cargar datos al montar
  useEffect(() => {
    recargarDatos();
  }, [recargarDatos]);

  return {
    reportesPendientes,
    reportesHistorial,
    loading,
    error,
    contadorPendientes: reportesPendientes.length,
    crearReporte,
    aprobarReporte,
    rechazarReporte,
    recargarDatos,
  };
}
