import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

// Tipos para actividades
type TipoActividadV2 = 'fisica' | 'cognitiva';
type ModalidadProgramacion = 'definida' | 'slot_abierto';
type TurnoActividad = 'manana' | 'tarde' | 'noche';

interface ProgramacionActividad {
  id: string;
  pacienteId: string;
  modalidad: ModalidadProgramacion;
  diasSemana: number[];
  turno: TurnoActividad;
  horaPreferida: string;
  activo: boolean;
  actividadDefinida?: {
    tipo: TipoActividadV2;
    nombre: string;
    descripcion: string;
    duracionMinutos: number;
    ubicacion?: string;
  };
  slotAbierto?: {
    tipo: TipoActividadV2;
    duracionMinutos: number;
    plantillasPermitidas: string[];
  };
}

/**
 * Cloud Function que descuenta automáticamente el porcentaje diario
 * de items con vida útil del inventario operativo.
 *
 * Se ejecuta todos los días a la medianoche (America/Mexico_City)
 */
export const descontarVidaUtilDiaria = onSchedule(
  {
    schedule: '0 0 * * *',
    timeZone: 'America/Mexico_City',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async (_event) => {
    console.log('Iniciando descuento de vida útil diaria...');

    try {
      // Obtener todos los pacientes
      const pacientesSnapshot = await db.collection('pacientes').get();

      for (const pacienteDoc of pacientesSnapshot.docs) {
        const pacienteId = pacienteDoc.id;
        console.log(`Procesando paciente: ${pacienteId}`);

        // Buscar items con vida útil activa y cantidad operativo > 0
        const itemsSnapshot = await db
          .collection('pacientes')
          .doc(pacienteId)
          .collection('inventario')
          .where('tieneVidaUtil', '==', true)
          .where('cantidadOperativo', '>', 0)
          .get();

        console.log(`Items con vida útil encontrados: ${itemsSnapshot.size}`);

        for (const itemDoc of itemsSnapshot.docs) {
          const item = itemDoc.data();
          const itemId = itemDoc.id;

          // Solo procesar si tiene porcentaje diario y fecha de inicio
          if (!item.porcentajeDiario || item.porcentajeDiario <= 0) {
            console.log(`Item ${item.nombre}: sin porcentaje diario configurado`);
            continue;
          }

          if (!item.fechaInicioConsumo) {
            console.log(`Item ${item.nombre}: sin fecha de inicio de consumo`);
            continue;
          }

          // Calcular el descuento
          const cantidadActual = item.cantidadOperativo || 0;
          const descuento = cantidadActual * (item.porcentajeDiario / 100);
          const nuevaCantidad = Math.max(0, cantidadActual - descuento);

          console.log(`Item ${item.nombre}: ${cantidadActual.toFixed(2)} - ${descuento.toFixed(2)} = ${nuevaCantidad.toFixed(2)}`);

          const ahora = Timestamp.now();

          // Actualizar el item
          await db
            .collection('pacientes')
            .doc(pacienteId)
            .collection('inventario')
            .doc(itemId)
            .update({
              cantidadOperativo: nuevaCantidad,
              actualizadoEn: ahora,
            });

          // Registrar movimiento
          await db
            .collection('pacientes')
            .doc(pacienteId)
            .collection('movimientosInventario')
            .add({
              pacienteId,
              tipo: 'consumo_automatico',
              itemId,
              itemNombre: item.nombre,
              origen: 'operativo',
              destino: 'consumido',
              cantidad: descuento,
              usuarioId: 'sistema',
              usuarioNombre: 'Sistema (Vida Útil)',
              motivo: `Consumo automático diario (${item.porcentajeDiario.toFixed(2)}%)`,
              fecha: ahora,
              creadoEn: ahora,
            });

          // Si la cantidad llegó a 0, limpiar la fecha de inicio
          if (nuevaCantidad <= 0) {
            await db
              .collection('pacientes')
              .doc(pacienteId)
              .collection('inventario')
              .doc(itemId)
              .update({
                fechaInicioConsumo: FieldValue.delete(),
              });
            console.log(`Item ${item.nombre}: consumido completamente, limpiando fecha de inicio`);
          }
        }
      }

      console.log('Descuento de vida útil completado exitosamente');
    } catch (error) {
      console.error('Error en descuento de vida útil:', error);
      throw error;
    }
  });

/**
 * Cloud Function que genera instancias de actividades diariamente
 * basándose en las programaciones activas.
 *
 * Se ejecuta todos los días a las 5:00 AM (America/Mexico_City)
 * para tener las instancias listas antes de que comience el día.
 */
export const generarInstanciasActividadesDiarias = onSchedule(
  {
    schedule: '0 5 * * *',
    timeZone: 'America/Mexico_City',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async (_event) => {
    console.log('Iniciando generación de instancias de actividades...');

    // Fecha de hoy normalizada a medianoche
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diaSemana = hoy.getDay(); // 0 = Domingo, 1 = Lunes, etc.

    try {
      // Obtener todos los pacientes
      const pacientesSnapshot = await db.collection('pacientes').get();

      for (const pacienteDoc of pacientesSnapshot.docs) {
        const pacienteId = pacienteDoc.id;
        console.log(`Procesando paciente: ${pacienteId}`);

        // Obtener programaciones activas para este día de la semana
        const programacionesSnapshot = await db
          .collection('pacientes')
          .doc(pacienteId)
          .collection('programacionesActividades')
          .where('activo', '==', true)
          .where('diasSemana', 'array-contains', diaSemana)
          .get();

        console.log(`Programaciones activas para ${pacienteId}: ${programacionesSnapshot.size}`);

        for (const progDoc of programacionesSnapshot.docs) {
          const prog = { id: progDoc.id, ...progDoc.data() } as ProgramacionActividad;

          // Generar ID de instancia: programacionId_YYYY-MM-DD
          const fechaStr = hoy.toISOString().split('T')[0];
          const instanciaId = `${prog.id}_${fechaStr}`;

          // Verificar si ya existe la instancia
          const instanciaRef = db
            .collection('pacientes')
            .doc(pacienteId)
            .collection('instanciasActividades')
            .doc(instanciaId);

          const instanciaExistente = await instanciaRef.get();
          if (instanciaExistente.exists) {
            console.log(`Instancia ${instanciaId} ya existe, omitiendo...`);
            continue;
          }

          // Determinar el tipo según la modalidad
          const tipo =
            prog.modalidad === 'definida'
              ? prog.actividadDefinida?.tipo
              : prog.slotAbierto?.tipo;

          // Crear la instancia
          const ahora = Timestamp.now();
          const fechaTimestamp = Timestamp.fromDate(hoy);

          const instanciaData = {
            pacienteId,
            programacionId: prog.id,
            modalidad: prog.modalidad,
            tipo,
            turno: prog.turno,
            fecha: fechaTimestamp,
            horaPreferida: prog.horaPreferida,
            actividadDefinida:
              prog.modalidad === 'definida' ? prog.actividadDefinida : null,
            slotAbierto:
              prog.modalidad === 'slot_abierto' ? prog.slotAbierto : null,
            estado: 'pendiente',
            generadaAutomaticamente: true,
            creadoEn: ahora,
            actualizadoEn: ahora,
          };

          await instanciaRef.set(instanciaData);
          console.log(`Instancia creada: ${instanciaId}`);
        }
      }

      console.log('Generación de instancias completada exitosamente');
    } catch (error) {
      console.error('Error generando instancias de actividades:', error);
      throw error;
    }
  });
