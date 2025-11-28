/**
 * Script de migración para agregar campos de tránsito a items de inventario existentes
 *
 * Este script actualiza todos los items de inventario que están vinculados al pastillero
 * (vinculadoPastillero: true) para agregar los campos:
 * - cantidadTransito: 0
 * - nivelMinimoTransito: 7 (una semana de stock)
 *
 * Para ejecutar:
 * 1. Asegúrate de tener las credenciales de Firebase configuradas
 * 2. Ejecuta: npx ts-node scripts/migracion-transito.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';

// Configuración de Firebase (usa tus variables de entorno o config)
const firebaseConfig = {
  // Copiar de tu archivo de configuración
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const PACIENTE_ID = 'paciente-principal';

async function migrarItemsTransito() {
  console.log('Iniciando migración de tránsito...');

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    // 1. Obtener todos los items vinculados al pastillero
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'inventario'),
      where('vinculadoPastillero', '==', true)
    );

    const snapshot = await getDocs(q);
    console.log(`Encontrados ${snapshot.size} items vinculados al pastillero`);

    let actualizados = 0;
    let yaExistentes = 0;

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();

      // Verificar si ya tiene los campos de tránsito
      if (data.cantidadTransito !== undefined) {
        console.log(`  ⏭️ ${data.nombre}: Ya tiene campos de tránsito`);
        yaExistentes++;
        continue;
      }

      // Actualizar el documento
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'inventario', docSnapshot.id), {
        cantidadTransito: 0, // Iniciar en 0
        nivelMinimoTransito: 7, // Una semana de stock mínimo
      });

      console.log(`  ✅ ${data.nombre}: Actualizado con campos de tránsito`);
      actualizados++;
    }

    console.log('\n--- Resumen de migración ---');
    console.log(`Total items procesados: ${snapshot.size}`);
    console.log(`Items actualizados: ${actualizados}`);
    console.log(`Items ya existentes: ${yaExistentes}`);
    console.log('Migración completada exitosamente.');

  } catch (error) {
    console.error('Error en la migración:', error);
    process.exit(1);
  }
}

migrarItemsTransito();
