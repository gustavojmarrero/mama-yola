/**
 * Script de migración para ejecutar desde la consola del navegador
 *
 * Instrucciones:
 * 1. Abre la aplicación en el navegador
 * 2. Abre las DevTools (F12)
 * 3. Ve a la pestaña "Console"
 * 4. Copia y pega todo este código
 * 5. Presiona Enter para ejecutar
 *
 * Este script actualizará todos los items de inventario vinculados al pastillero
 * agregándoles los campos cantidadTransito y nivelMinimoTransito
 */

(async function migrarTransito() {
  // Importar Firebase desde el window (ya cargado por la app)
  const { collection, getDocs, updateDoc, doc, query, where, getFirestore } = await import('firebase/firestore');

  // Obtener la instancia de Firestore de la app
  const db = getFirestore();
  const PACIENTE_ID = 'paciente-principal';

  console.log('🚀 Iniciando migración de tránsito...\n');

  try {
    // 1. Obtener todos los items vinculados al pastillero
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'inventario'),
      where('vinculadoPastillero', '==', true)
    );

    const snapshot = await getDocs(q);
    console.log(`📦 Encontrados ${snapshot.size} items vinculados al pastillero\n`);

    let actualizados = 0;
    let yaExistentes = 0;

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();

      // Verificar si ya tiene los campos de tránsito
      if (data.cantidadTransito !== undefined) {
        console.log(`⏭️ ${data.nombre}: Ya tiene campos de tránsito (cantidadTransito: ${data.cantidadTransito})`);
        yaExistentes++;
        continue;
      }

      // Actualizar el documento
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'inventario', docSnapshot.id), {
        cantidadTransito: 0, // Iniciar en 0
        nivelMinimoTransito: 7, // Una semana de stock mínimo
      });

      console.log(`✅ ${data.nombre}: Actualizado con campos de tránsito`);
      actualizados++;
    }

    console.log('\n========== RESUMEN ==========');
    console.log(`📊 Total items procesados: ${snapshot.size}`);
    console.log(`✅ Items actualizados: ${actualizados}`);
    console.log(`⏭️ Items ya existentes: ${yaExistentes}`);
    console.log('🎉 Migración completada exitosamente!');
    console.log('==============================\n');

    // Retornar resumen
    return {
      total: snapshot.size,
      actualizados,
      yaExistentes,
      exito: true
    };

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    return {
      exito: false,
      error: error.message
    };
  }
})();
