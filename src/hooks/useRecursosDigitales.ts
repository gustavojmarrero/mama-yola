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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { CategoriaRecurso, RecursoDigital } from '../types';

const PACIENTE_ID = 'paciente-principal';

// Categorías predeterminadas
const CATEGORIAS_DEFAULT = [
  { nombre: 'Fotos', icono: '📷', color: '#3B82F6', orden: 1 },
  { nombre: 'Música', icono: '🎵', color: '#10B981', orden: 2 },
  { nombre: 'Videos', icono: '🎬', color: '#EF4444', orden: 3 },
];

// Datos para crear un nuevo recurso
export interface CrearRecursoData {
  titulo: string;
  descripcion: string;
  url: string;
  categoriaId: string;
  categoriaNombre: string;
  thumbnail?: string;
  notasPrivadas?: string;
  creadoPor: string;
  creadoPorNombre: string;
}

// Datos para editar un recurso
export interface EditarRecursoData {
  titulo?: string;
  descripcion?: string;
  url?: string;
  categoriaId?: string;
  categoriaNombre?: string;
  thumbnail?: string;
  notasPrivadas?: string;
}

// Datos para crear una categoría
export interface CrearCategoriaData {
  nombre: string;
  icono: string;
  color: string;
  creadoPor: string;
}

// Datos para editar una categoría
export interface EditarCategoriaData {
  nombre?: string;
  icono?: string;
  color?: string;
}

interface UseRecursosDigitalesReturn {
  // Datos
  recursos: RecursoDigital[];
  categorias: CategoriaRecurso[];
  loading: boolean;
  error: string | null;

  // Acciones de recursos
  crearRecurso: (data: CrearRecursoData) => Promise<void>;
  editarRecurso: (id: string, data: EditarRecursoData) => Promise<void>;
  eliminarRecurso: (id: string) => Promise<void>;
  toggleFavorito: (id: string) => Promise<void>;

  // Acciones de categorías
  crearCategoria: (data: CrearCategoriaData) => Promise<void>;
  editarCategoria: (id: string, data: EditarCategoriaData) => Promise<void>;
  eliminarCategoria: (id: string) => Promise<void>;
  reordenarCategorias: (nuevasOrden: { id: string; orden: number }[]) => Promise<void>;

  // Helpers
  getCategoriaById: (id: string) => CategoriaRecurso | undefined;
  recargarDatos: () => Promise<void>;
}

// Helper para convertir documento de Firestore a CategoriaRecurso
function docToCategoria(docSnap: { id: string; data: () => Record<string, unknown> }): CategoriaRecurso {
  const data = docSnap.data() as Record<string, unknown>;
  return {
    id: docSnap.id,
    pacienteId: data.pacienteId as string,
    nombre: data.nombre as string,
    icono: data.icono as string,
    color: data.color as string,
    orden: data.orden as number,
    predeterminada: data.predeterminada as boolean,
    activo: data.activo as boolean,
    creadoPor: data.creadoPor as string,
    creadoEn: (data.creadoEn as { toDate: () => Date })?.toDate() || new Date(),
    actualizadoEn: (data.actualizadoEn as { toDate: () => Date })?.toDate() || new Date(),
  };
}

// Helper para convertir documento de Firestore a RecursoDigital
function docToRecurso(docSnap: { id: string; data: () => Record<string, unknown> }): RecursoDigital {
  const data = docSnap.data() as Record<string, unknown>;
  return {
    id: docSnap.id,
    pacienteId: data.pacienteId as string,
    titulo: data.titulo as string,
    descripcion: data.descripcion as string,
    url: data.url as string,
    categoriaId: data.categoriaId as string,
    categoriaNombre: data.categoriaNombre as string,
    thumbnail: data.thumbnail as string | undefined,
    notasPrivadas: data.notasPrivadas as string | undefined,
    favorito: data.favorito as boolean,
    activo: data.activo as boolean,
    creadoPor: data.creadoPor as string,
    creadoPorNombre: data.creadoPorNombre as string,
    creadoEn: (data.creadoEn as { toDate: () => Date })?.toDate() || new Date(),
    actualizadoEn: (data.actualizadoEn as { toDate: () => Date })?.toDate() || new Date(),
  };
}

export function useRecursosDigitales(): UseRecursosDigitalesReturn {
  const [recursos, setRecursos] = useState<RecursoDigital[]>([]);
  const [categorias, setCategorias] = useState<CategoriaRecurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inicializar categorías predeterminadas si no existen
  const inicializarCategoriasPredeterminadas = useCallback(async () => {
    try {
      // Verificar si ya existen categorías activas (de cualquier tipo)
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'categoriasRecursos'),
        where('activo', '==', true)
      );
      const snapshot = await getDocs(q);

      // Si ya hay categorías, no crear más
      if (!snapshot.empty) {
        return;
      }

      // Crear categorías predeterminadas solo si no hay ninguna
      const batch = writeBatch(db);
      const ahora = Timestamp.now();

      CATEGORIAS_DEFAULT.forEach((cat) => {
        const docRef = doc(collection(db, 'pacientes', PACIENTE_ID, 'categoriasRecursos'));
        batch.set(docRef, {
          pacienteId: PACIENTE_ID,
          nombre: cat.nombre,
          icono: cat.icono,
          color: cat.color,
          orden: cat.orden,
          predeterminada: true,
          activo: true,
          creadoPor: 'sistema',
          creadoEn: ahora,
          actualizadoEn: ahora,
        });
      });

      await batch.commit();
    } catch (err) {
      console.error('Error al inicializar categorías:', err);
    }
  }, []);

  // Cargar categorías
  const cargarCategorias = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'categoriasRecursos'),
        where('activo', '==', true),
        orderBy('orden', 'asc')
      );
      const snapshot = await getDocs(q);
      const lista: CategoriaRecurso[] = [];

      snapshot.forEach((docSnap) => {
        lista.push(docToCategoria(docSnap));
      });

      // Eliminar duplicados por nombre (mantener el primero de cada nombre)
      const nombresVistos = new Set<string>();
      const listaSinDuplicados = lista.filter((cat) => {
        if (nombresVistos.has(cat.nombre)) {
          return false;
        }
        nombresVistos.add(cat.nombre);
        return true;
      });

      return listaSinDuplicados;
    } catch (err) {
      console.error('Error al cargar categorías:', err);
      throw err;
    }
  }, []);

  // Cargar recursos
  const cargarRecursos = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'recursosDigitales'),
        where('activo', '==', true),
        orderBy('creadoEn', 'desc')
      );
      const snapshot = await getDocs(q);
      const lista: RecursoDigital[] = [];

      snapshot.forEach((docSnap) => {
        lista.push(docToRecurso(docSnap));
      });

      // Ordenar: favoritos primero, luego por fecha
      lista.sort((a, b) => {
        if (a.favorito && !b.favorito) return -1;
        if (!a.favorito && b.favorito) return 1;
        return b.creadoEn.getTime() - a.creadoEn.getTime();
      });

      return lista;
    } catch (err) {
      console.error('Error al cargar recursos:', err);
      throw err;
    }
  }, []);

  // Función principal para recargar datos
  const recargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await inicializarCategoriasPredeterminadas();
      const [listaCategorias, listaRecursos] = await Promise.all([
        cargarCategorias(),
        cargarRecursos(),
      ]);
      setCategorias(listaCategorias);
      setRecursos(listaRecursos);
    } catch (err) {
      setError('Error al cargar recursos digitales');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [inicializarCategoriasPredeterminadas, cargarCategorias, cargarRecursos]);

  // ===== ACCIONES DE RECURSOS =====

  // Crear nuevo recurso
  const crearRecurso = useCallback(async (data: CrearRecursoData): Promise<void> => {
    try {
      const ahora = Timestamp.now();

      const nuevoRecurso: Record<string, unknown> = {
        pacienteId: PACIENTE_ID,
        titulo: data.titulo,
        descripcion: data.descripcion,
        url: data.url,
        categoriaId: data.categoriaId,
        categoriaNombre: data.categoriaNombre,
        favorito: false,
        activo: true,
        creadoPor: data.creadoPor,
        creadoPorNombre: data.creadoPorNombre,
        creadoEn: ahora,
        actualizadoEn: ahora,
      };

      // Solo agregar campos opcionales si tienen valor
      if (data.thumbnail) {
        nuevoRecurso.thumbnail = data.thumbnail;
      }
      if (data.notasPrivadas) {
        nuevoRecurso.notasPrivadas = data.notasPrivadas;
      }

      await addDoc(
        collection(db, 'pacientes', PACIENTE_ID, 'recursosDigitales'),
        nuevoRecurso
      );

      await recargarDatos();
    } catch (err) {
      console.error('Error al crear recurso:', err);
      throw err;
    }
  }, [recargarDatos]);

  // Editar recurso
  const editarRecurso = useCallback(async (id: string, data: EditarRecursoData): Promise<void> => {
    try {
      const ahora = Timestamp.now();
      const recursoRef = doc(db, 'pacientes', PACIENTE_ID, 'recursosDigitales', id);

      const actualizacion: Record<string, unknown> = {
        actualizadoEn: ahora,
      };

      if (data.titulo !== undefined) actualizacion.titulo = data.titulo;
      if (data.descripcion !== undefined) actualizacion.descripcion = data.descripcion;
      if (data.url !== undefined) actualizacion.url = data.url;
      if (data.categoriaId !== undefined) actualizacion.categoriaId = data.categoriaId;
      if (data.categoriaNombre !== undefined) actualizacion.categoriaNombre = data.categoriaNombre;
      if (data.thumbnail !== undefined) actualizacion.thumbnail = data.thumbnail;
      if (data.notasPrivadas !== undefined) actualizacion.notasPrivadas = data.notasPrivadas;

      await updateDoc(recursoRef, actualizacion);
      await recargarDatos();
    } catch (err) {
      console.error('Error al editar recurso:', err);
      throw err;
    }
  }, [recargarDatos]);

  // Eliminar recurso (soft delete)
  const eliminarRecurso = useCallback(async (id: string): Promise<void> => {
    try {
      const ahora = Timestamp.now();
      const recursoRef = doc(db, 'pacientes', PACIENTE_ID, 'recursosDigitales', id);

      await updateDoc(recursoRef, {
        activo: false,
        actualizadoEn: ahora,
      });

      await recargarDatos();
    } catch (err) {
      console.error('Error al eliminar recurso:', err);
      throw err;
    }
  }, [recargarDatos]);

  // Toggle favorito
  const toggleFavorito = useCallback(async (id: string): Promise<void> => {
    try {
      const recurso = recursos.find(r => r.id === id);
      if (!recurso) throw new Error('Recurso no encontrado');

      const ahora = Timestamp.now();
      const recursoRef = doc(db, 'pacientes', PACIENTE_ID, 'recursosDigitales', id);

      await updateDoc(recursoRef, {
        favorito: !recurso.favorito,
        actualizadoEn: ahora,
      });

      await recargarDatos();
    } catch (err) {
      console.error('Error al cambiar favorito:', err);
      throw err;
    }
  }, [recursos, recargarDatos]);

  // ===== ACCIONES DE CATEGORÍAS =====

  // Crear nueva categoría
  const crearCategoria = useCallback(async (data: CrearCategoriaData): Promise<void> => {
    try {
      const ahora = Timestamp.now();

      // Obtener el mayor orden actual
      const maxOrden = categorias.reduce((max, cat) => Math.max(max, cat.orden), 0);

      const nuevaCategoria = {
        pacienteId: PACIENTE_ID,
        nombre: data.nombre,
        icono: data.icono,
        color: data.color,
        orden: maxOrden + 1,
        predeterminada: false,
        activo: true,
        creadoPor: data.creadoPor,
        creadoEn: ahora,
        actualizadoEn: ahora,
      };

      await addDoc(
        collection(db, 'pacientes', PACIENTE_ID, 'categoriasRecursos'),
        nuevaCategoria
      );

      await recargarDatos();
    } catch (err) {
      console.error('Error al crear categoría:', err);
      throw err;
    }
  }, [categorias, recargarDatos]);

  // Editar categoría
  const editarCategoria = useCallback(async (id: string, data: EditarCategoriaData): Promise<void> => {
    try {
      const ahora = Timestamp.now();
      const categoriaRef = doc(db, 'pacientes', PACIENTE_ID, 'categoriasRecursos', id);

      const actualizacion: Record<string, unknown> = {
        actualizadoEn: ahora,
      };

      if (data.nombre !== undefined) actualizacion.nombre = data.nombre;
      if (data.icono !== undefined) actualizacion.icono = data.icono;
      if (data.color !== undefined) actualizacion.color = data.color;

      await updateDoc(categoriaRef, actualizacion);

      // Si se cambió el nombre, actualizar los recursos que usan esta categoría
      if (data.nombre !== undefined) {
        const categoria = categorias.find(c => c.id === id);
        if (categoria) {
          const recursosDeCategoria = recursos.filter(r => r.categoriaId === id);
          if (recursosDeCategoria.length > 0) {
            const batch = writeBatch(db);
            recursosDeCategoria.forEach(recurso => {
              const recursoRef = doc(db, 'pacientes', PACIENTE_ID, 'recursosDigitales', recurso.id);
              batch.update(recursoRef, {
                categoriaNombre: data.nombre,
                actualizadoEn: ahora,
              });
            });
            await batch.commit();
          }
        }
      }

      await recargarDatos();
    } catch (err) {
      console.error('Error al editar categoría:', err);
      throw err;
    }
  }, [categorias, recursos, recargarDatos]);

  // Eliminar categoría (soft delete)
  const eliminarCategoria = useCallback(async (id: string): Promise<void> => {
    try {
      const categoria = categorias.find(c => c.id === id);
      if (!categoria) throw new Error('Categoría no encontrada');
      if (categoria.predeterminada) throw new Error('No se pueden eliminar categorías predeterminadas');

      // Verificar si hay recursos usando esta categoría
      const recursosDeCategoria = recursos.filter(r => r.categoriaId === id);
      if (recursosDeCategoria.length > 0) {
        throw new Error('No se puede eliminar una categoría que tiene recursos asociados');
      }

      const ahora = Timestamp.now();
      const categoriaRef = doc(db, 'pacientes', PACIENTE_ID, 'categoriasRecursos', id);

      await updateDoc(categoriaRef, {
        activo: false,
        actualizadoEn: ahora,
      });

      await recargarDatos();
    } catch (err) {
      console.error('Error al eliminar categoría:', err);
      throw err;
    }
  }, [categorias, recursos, recargarDatos]);

  // Reordenar categorías
  const reordenarCategorias = useCallback(async (nuevasOrden: { id: string; orden: number }[]): Promise<void> => {
    try {
      const ahora = Timestamp.now();
      const batch = writeBatch(db);

      nuevasOrden.forEach(({ id, orden }) => {
        const categoriaRef = doc(db, 'pacientes', PACIENTE_ID, 'categoriasRecursos', id);
        batch.update(categoriaRef, {
          orden,
          actualizadoEn: ahora,
        });
      });

      await batch.commit();
      await recargarDatos();
    } catch (err) {
      console.error('Error al reordenar categorías:', err);
      throw err;
    }
  }, [recargarDatos]);

  // Helper para obtener categoría por ID
  const getCategoriaById = useCallback((id: string): CategoriaRecurso | undefined => {
    return categorias.find(c => c.id === id);
  }, [categorias]);

  // Cargar datos al montar
  useEffect(() => {
    recargarDatos();
  }, [recargarDatos]);

  return {
    recursos,
    categorias,
    loading,
    error,
    crearRecurso,
    editarRecurso,
    eliminarRecurso,
    toggleFavorito,
    crearCategoria,
    editarCategoria,
    eliminarCategoria,
    reordenarCategorias,
    getCategoriaById,
    recargarDatos,
  };
}
