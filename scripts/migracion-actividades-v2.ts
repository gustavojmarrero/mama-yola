/**
 * Script de migración para el nuevo sistema de actividades V2
 *
 * Este script realiza las siguientes migraciones:
 * 1. Crea plantillas a partir de las actividades existentes
 * 2. Migra las actividades completadas a la nueva estructura de instancias
 *
 * Mapeo de tipos:
 * - 'salida' -> 'fisica'
 * - 'recreativa' -> 'cognitiva'
 * - 'terapeutica' -> 'fisica'
 * - 'social' -> 'cognitiva'
 * - 'cognitiva' -> 'cognitiva'
 * - 'fisica' -> 'fisica'
 *
 * Para ejecutar:
 * 1. Asegúrate de tener las credenciales de Firebase configuradas
 * 2. Ejecuta: npx ts-node scripts/migracion-actividades-v2.ts
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  setDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const PACIENTE_ID = 'paciente-principal';

// Mapeo de tipos legados a tipos V2
type TipoLegado = 'salida' | 'recreativa' | 'terapeutica' | 'social' | 'cognitiva' | 'fisica';
type TipoV2 = 'fisica' | 'cognitiva';

const MAPEO_TIPOS: Record<TipoLegado, TipoV2> = {
  salida: 'fisica',
  recreativa: 'cognitiva',
  terapeutica: 'fisica',
  social: 'cognitiva',
  cognitiva: 'cognitiva',
  fisica: 'fisica',
};

// Interfaz de actividad legada
interface ActividadLegada {
  id: string;
  tipo: TipoLegado;
  nombre: string;
  descripcion?: string;
  duracion?: number;
  ubicacion?: string;
  materiales?: string[];
  estado?: string;
  fecha?: Timestamp;
  participacion?: string;
  estadoAnimo?: string;
  notas?: string;
  completadaPor?: string;
  completadaPorNombre?: string;
  completadaEn?: Timestamp;
  creadoEn?: Timestamp;
}

// Contadores para reporte
let plantillasCreadas = 0;
let instanciasMigradas = 0;
let errores: string[] = [];

async function migrarActividades() {
  console.log('==============================================');
  console.log('  MIGRACIÓN DE ACTIVIDADES V2');
  console.log('==============================================\n');

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    // 1. Obtener todas las actividades existentes
    console.log('Paso 1: Obteniendo actividades existentes...');
    const actividadesRef = collection(db, 'pacientes', PACIENTE_ID, 'actividades');
    const snapshot = await getDocs(actividadesRef);
    console.log(`Encontradas ${snapshot.size} actividades\n`);

    // Agrupar actividades únicas para crear plantillas
    const actividadesUnicas = new Map<string, ActividadLegada>();
    const actividadesCompletadas: ActividadLegada[] = [];

    for (const docSnap of snapshot.docs) {
      const data = { id: docSnap.id, ...docSnap.data() } as ActividadLegada;

      // Usar nombre+tipo como clave para identificar actividades únicas
      const clave = `${data.nombre}_${data.tipo}`.toLowerCase();
      if (!actividadesUnicas.has(clave)) {
        actividadesUnicas.set(clave, data);
      }

      // Guardar actividades completadas para migrar
      if (data.estado === 'completada') {
        actividadesCompletadas.push(data);
      }
    }

    // 2. Crear plantillas
    console.log('Paso 2: Creando plantillas de actividades...');
    console.log(`Se crearán ${actividadesUnicas.size} plantillas\n`);

    for (const [, actividad] of actividadesUnicas) {
      try {
        const tipoV2 = MAPEO_TIPOS[actividad.tipo];
        const plantillaId = generarIdPlantilla(actividad.nombre, tipoV2);

        const plantillaRef = doc(
          db,
          'pacientes',
          PACIENTE_ID,
          'plantillasActividades',
          plantillaId
        );

        await setDoc(plantillaRef, {
          nombre: actividad.nombre,
          tipo: tipoV2,
          tipoOriginal: actividad.tipo,
          descripcion: actividad.descripcion || '',
          duracionMinutos: actividad.duracion || 30,
          ubicacion: actividad.ubicacion || null,
          materiales: actividad.materiales || [],
          activa: true,
          migradaDe: 'actividades_v1',
          creadoEn: Timestamp.now(),
          actualizadoEn: Timestamp.now(),
        });

        console.log(`  ✅ Plantilla creada: ${actividad.nombre} (${tipoV2})`);
        plantillasCreadas++;
      } catch (error) {
        const mensaje = `Error creando plantilla ${actividad.nombre}: ${error}`;
        console.log(`  ❌ ${mensaje}`);
        errores.push(mensaje);
      }
    }

    // 3. Migrar actividades completadas a instancias
    console.log('\nPaso 3: Migrando actividades completadas a instancias...');
    console.log(`Se migrarán ${actividadesCompletadas.length} actividades completadas\n`);

    for (const actividad of actividadesCompletadas) {
      try {
        if (!actividad.fecha) {
          console.log(`  ⏭️ ${actividad.nombre}: Sin fecha, omitiendo`);
          continue;
        }

        const tipoV2 = MAPEO_TIPOS[actividad.tipo];
        const fecha = actividad.fecha.toDate();
        const fechaStr = fecha.toISOString().split('T')[0];
        const instanciaId = `migrado_${actividad.id}_${fechaStr}`;

        const instanciaRef = doc(
          db,
          'pacientes',
          PACIENTE_ID,
          'instanciasActividades',
          instanciaId
        );

        // Determinar el turno basado en la hora
        const hora = fecha.getHours();
        let turno: 'manana' | 'tarde' | 'noche' = 'manana';
        if (hora >= 12 && hora < 17) turno = 'tarde';
        else if (hora >= 17) turno = 'noche';

        await setDoc(instanciaRef, {
          pacienteId: PACIENTE_ID,
          programacionId: null, // No tiene programación asociada
          modalidad: 'definida',
          tipo: tipoV2,
          turno,
          fecha: Timestamp.fromDate(new Date(fecha.setHours(0, 0, 0, 0))),
          horaPreferida: `${hora.toString().padStart(2, '0')}:00`,
          actividadDefinida: {
            tipo: tipoV2,
            nombre: actividad.nombre,
            descripcion: actividad.descripcion || '',
            duracionMinutos: actividad.duracion || 30,
            ubicacion: actividad.ubicacion || null,
          },
          slotAbierto: null,
          actividadElegida: null,
          estado: 'completada',
          ejecucion: {
            completadaPor: actividad.completadaPor || 'desconocido',
            completadaPorNombre: actividad.completadaPorNombre || 'Usuario migrado',
            completadaEn: actividad.completadaEn || actividad.creadoEn,
            duracionReal: actividad.duracion || 30,
            participacion: actividad.participacion || null,
            estadoAnimo: actividad.estadoAnimo || null,
            notas: actividad.notas || null,
          },
          omision: null,
          generadaAutomaticamente: false,
          migradaDe: {
            coleccion: 'actividades',
            documentoId: actividad.id,
          },
          creadoEn: actividad.creadoEn || Timestamp.now(),
          actualizadoEn: Timestamp.now(),
        });

        console.log(`  ✅ Instancia migrada: ${actividad.nombre} (${fechaStr})`);
        instanciasMigradas++;
      } catch (error) {
        const mensaje = `Error migrando ${actividad.nombre}: ${error}`;
        console.log(`  ❌ ${mensaje}`);
        errores.push(mensaje);
      }
    }

    // 4. Resumen final
    console.log('\n==============================================');
    console.log('  RESUMEN DE MIGRACIÓN');
    console.log('==============================================');
    console.log(`\nActividades procesadas: ${snapshot.size}`);
    console.log(`Plantillas creadas: ${plantillasCreadas}`);
    console.log(`Instancias migradas: ${instanciasMigradas}`);
    console.log(`Errores: ${errores.length}`);

    if (errores.length > 0) {
      console.log('\nErrores encontrados:');
      errores.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }

    console.log('\n✅ Migración completada');

  } catch (error) {
    console.error('\n❌ Error fatal en la migración:', error);
    process.exit(1);
  }
}

/**
 * Genera un ID sanitizado para la plantilla
 */
function generarIdPlantilla(nombre: string, tipo: TipoV2): string {
  const nombreSanitizado = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9]/g, '_') // Reemplazar caracteres especiales
    .replace(/_+/g, '_') // Evitar underscores consecutivos
    .replace(/^_|_$/g, ''); // Quitar underscores al inicio/fin

  return `${tipo}_${nombreSanitizado}`;
}

// Ejecutar migración
migrarActividades();
