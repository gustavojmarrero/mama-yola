"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.descontarVidaUtilDiaria = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
/**
 * Cloud Function que descuenta automáticamente el porcentaje diario
 * de items con vida útil del inventario operativo.
 *
 * Se ejecuta todos los días a la medianoche (America/Mexico_City)
 */
exports.descontarVidaUtilDiaria = (0, scheduler_1.onSchedule)({
    schedule: '0 0 * * *',
    timeZone: 'America/Mexico_City',
    timeoutSeconds: 300,
    memory: '256MiB',
}, async (_event) => {
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
                const ahora = firestore_1.Timestamp.now();
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
                        fechaInicioConsumo: firestore_1.FieldValue.delete(),
                    });
                    console.log(`Item ${item.nombre}: consumido completamente, limpiando fecha de inicio`);
                }
            }
        }
        console.log('Descuento de vida útil completado exitosamente');
    }
    catch (error) {
        console.error('Error en descuento de vida útil:', error);
        throw error;
    }
});
//# sourceMappingURL=index.js.map