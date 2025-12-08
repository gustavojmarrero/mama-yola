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
  ItemInventario,
  SolicitudReposicion,
  Medicamento,
  ItemSolicitudReposicion,
  UrgenciaSolicitud,
} from '../types';

const PACIENTE_ID = 'paciente-principal';

interface ItemTransitoConDosis extends ItemInventario {
  dosisDelDia: number;
  diasEstimados: number;
}

interface UseTransitoReturn {
  itemsTransito: ItemTransitoConDosis[];
  solicitudesPendientes: SolicitudReposicion[];
  loading: boolean;
  error: string | null;

  // Funciones
  calcularDiasRestantes: (item: ItemInventario, dosisDelDia: number) => number;
  itemsConStockBajo: () => ItemTransitoConDosis[];
  crearSolicitudReposicion: (
    items: ItemSolicitudReposicion[],
    notas: string,
    urgencia: UrgenciaSolicitud,
    usuarioId: string,
    usuarioNombre: string
  ) => Promise<void>;
  registrarCargaPastillero: (
    items: Array<{ itemId: string; cantidad: number }>,
    usuarioId: string,
    usuarioNombre: string
  ) => Promise<void>;
  recargarDatos: () => Promise<void>;
}

export function useTransito(): UseTransitoReturn {
  const [itemsTransito, setItemsTransito] = useState<ItemTransitoConDosis[]>([]);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudReposicion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parsear cantidad del campo dosis (ej: "1/2" -> 0.5, "1" -> 1, "2" -> 2)
  const parsearCantidadDosis = useCallback((dosis: string): number => {
    if (!dosis) return 1;
    const dosisLower = dosis.toLowerCase().trim();

    // Detectar fracciones comunes
    if (dosisLower.includes('1/4') || dosisLower.includes('cuarto')) return 0.25;
    if (dosisLower.includes('1/2') || dosisLower.includes('media') || dosisLower.includes('medio')) return 0.5;
    if (dosisLower.includes('3/4')) return 0.75;
    if (dosisLower.includes('1 1/2') || dosisLower.includes('una y media')) return 1.5;

    // Si empieza con un número entero solo (ej: "2", "1")
    const match = dosisLower.match(/^(\d+)(?:\s|$)/);
    if (match) return parseInt(match[1], 10);

    return 1; // Por defecto 1 tableta
  }, []);

  // Calcular dosis diarias de un medicamento (cantidad por toma × tomas por día × días por semana / 7)
  const calcularDosisDiaria = useCallback((medicamento: Medicamento): number => {
    const cantidadPorToma = parsearCantidadDosis(medicamento.dosis);
    const tomasPorDia = medicamento.horarios?.length || 1;

    // Si tiene días específicos, calcular promedio diario
    const diasSemana = medicamento.frecuencia?.diasSemana;
    const diasPorSemana = diasSemana && diasSemana.length > 0 ? diasSemana.length : 7;

    // Dosis promedio por día = (cantidad × tomas × días) / 7
    return (cantidadPorToma * tomasPorDia * diasPorSemana) / 7;
  }, [parsearCantidadDosis]);

  // Calcular días restantes basado en stock en tránsito y dosis diarias
  const calcularDiasRestantes = useCallback((item: ItemInventario, dosisDelDia: number): number => {
    if (dosisDelDia <= 0) return 999; // Sin consumo diario
    const cantidadTransito = item.cantidadTransito || 0;
    return Math.floor(cantidadTransito / dosisDelDia);
  }, []);

  // Cargar items de inventario vinculados al pastillero
  const cargarItemsTransito = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'inventario'),
        where('vinculadoPastillero', '==', true)
      );
      const snapshot = await getDocs(q);
      const items: ItemInventario[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          pacienteId: data.pacienteId,
          nombre: data.nombre,
          categoria: data.categoria,
          cantidadMaestro: data.cantidadMaestro ?? 0,
          cantidadTransito: data.cantidadTransito ?? 0,
          cantidadOperativo: data.cantidadOperativo ?? 0,
          presentacion: data.presentacion,
          vinculadoPastillero: data.vinculadoPastillero,
          medicamentoId: data.medicamentoId,
          tieneVidaUtil: data.tieneVidaUtil,
          vidaUtilDias: data.vidaUtilDias,
          fechaInicioConsumo: data.fechaInicioConsumo?.toDate(),
          porcentajeDiario: data.porcentajeDiario,
          unidad: data.unidad,
          nivelMinimoMaestro: data.nivelMinimoMaestro ?? 5,
          nivelMinimoTransito: data.nivelMinimoTransito ?? 7,
          nivelMinimoOperativo: data.nivelMinimoOperativo ?? 5,
          ubicacion: data.ubicacion,
          notas: data.notas,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as ItemInventario);
      });

      return items;
    } catch (err) {
      console.error('Error al cargar items de tránsito:', err);
      throw err;
    }
  }, []);

  // Cargar medicamentos activos
  const cargarMedicamentos = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'medicamentos'),
        where('activo', '==', true)
      );
      const snapshot = await getDocs(q);
      const meds: Medicamento[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        meds.push({
          id: doc.id,
          ...data,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Medicamento);
      });

      return meds;
    } catch (err) {
      console.error('Error al cargar medicamentos:', err);
      throw err;
    }
  }, []);

  // Cargar solicitudes de reposición pendientes
  const cargarSolicitudesPendientes = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'solicitudesReposicion'),
        where('estado', '==', 'pendiente'),
        orderBy('creadoEn', 'desc')
      );
      const snapshot = await getDocs(q);
      const solicitudes: SolicitudReposicion[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        solicitudes.push({
          id: doc.id,
          ...data,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          atendidoEn: data.atendidoEn?.toDate(),
        } as SolicitudReposicion);
      });

      return solicitudes;
    } catch (err) {
      console.error('Error al cargar solicitudes:', err);
      throw err;
    }
  }, []);

  // Función principal para recargar todos los datos
  const recargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [items, meds, solicitudes] = await Promise.all([
        cargarItemsTransito(),
        cargarMedicamentos(),
        cargarSolicitudesPendientes(),
      ]);

      setMedicamentos(meds);
      setSolicitudesPendientes(solicitudes);

      // Combinar items con información de dosis diarias
      // Filtrar items cuyo medicamento vinculado esté desactivado
      const itemsConDosis: ItemTransitoConDosis[] = items
        .filter((item) => {
          // Si tiene medicamentoId, verificar que el medicamento esté activo
          if (item.medicamentoId) {
            return meds.some((m) => m.id === item.medicamentoId);
          }
          return true; // Items sin medicamentoId se incluyen
        })
        .map((item) => {
          // Buscar el medicamento vinculado
          const medicamento = meds.find((m) => m.id === item.medicamentoId);
          const dosisDelDia = medicamento ? calcularDosisDiaria(medicamento) : 1;
          const diasEstimados = calcularDiasRestantes(item, dosisDelDia);

          return {
            ...item,
            dosisDelDia,
            diasEstimados,
          };
        });

      setItemsTransito(itemsConDosis);
    } catch (err) {
      setError('Error al cargar datos de tránsito');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [cargarItemsTransito, cargarMedicamentos, cargarSolicitudesPendientes, calcularDosisDiaria, calcularDiasRestantes]);

  // Items con stock bajo en tránsito
  const itemsConStockBajo = useCallback((): ItemTransitoConDosis[] => {
    return itemsTransito.filter(
      (item) => (item.cantidadTransito || 0) <= (item.nivelMinimoTransito || 0)
    );
  }, [itemsTransito]);

  // Crear solicitud de reposición
  const crearSolicitudReposicion = useCallback(async (
    items: ItemSolicitudReposicion[],
    notas: string,
    urgencia: UrgenciaSolicitud,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<void> => {
    try {
      const solicitud: Omit<SolicitudReposicion, 'id'> = {
        pacienteId: PACIENTE_ID,
        solicitadoPor: usuarioId,
        solicitadoPorNombre: usuarioNombre,
        items,
        estado: 'pendiente',
        notas,
        urgencia,
        creadoEn: new Date(),
      };

      await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'solicitudesReposicion'), {
        ...solicitud,
        creadoEn: Timestamp.now(),
      });

      await recargarDatos();
    } catch (err) {
      console.error('Error al crear solicitud de reposición:', err);
      throw err;
    }
  }, [recargarDatos]);

  // Registrar carga del pastillero (Tránsito → Operativo)
  const registrarCargaPastillero = useCallback(async (
    items: Array<{ itemId: string; cantidad: number }>,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<void> => {
    try {
      const ahora = Timestamp.now();

      for (const { itemId, cantidad } of items) {
        const itemRef = doc(db, 'pacientes', PACIENTE_ID, 'inventario', itemId);
        const item = itemsTransito.find((i) => i.id === itemId);

        if (!item) continue;

        // Calcular nuevas cantidades
        const nuevaCantidadTransito = Math.max(0, (item.cantidadTransito || 0) - cantidad);
        const nuevaCantidadOperativo = (item.cantidadOperativo || 0) + cantidad;

        // Actualizar item
        await updateDoc(itemRef, {
          cantidadTransito: nuevaCantidadTransito,
          cantidadOperativo: nuevaCantidadOperativo,
          actualizadoEn: ahora,
        });

        // Registrar movimiento
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'movimientosInventario'), {
          pacienteId: PACIENTE_ID,
          tipo: 'transferencia',
          itemId,
          itemNombre: item.nombre,
          origen: 'transito',
          destino: 'operativo',
          cantidad,
          motivo: 'Carga de pastillero semanal',
          usuarioId,
          usuarioNombre,
          fecha: ahora,
          creadoEn: ahora,
        });
      }

      await recargarDatos();
    } catch (err) {
      console.error('Error al registrar carga de pastillero:', err);
      throw err;
    }
  }, [itemsTransito, recargarDatos]);

  // Cargar datos al montar
  useEffect(() => {
    recargarDatos();
  }, [recargarDatos]);

  return {
    itemsTransito,
    solicitudesPendientes,
    loading,
    error,
    calcularDiasRestantes,
    itemsConStockBajo,
    crearSolicitudReposicion,
    registrarCargaPastillero,
    recargarDatos,
  };
}
