import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import { ComidaProgramada, TipoComida, CategoriaComida, NivelConsumo, Receta } from '../types';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

const PACIENTE_ID = 'paciente-principal';

const tiposComida: { value: TipoComida; label: string; hora: string; icon: string }[] = [
  { value: 'desayuno', label: 'Desayuno', hora: '08:00', icon: '🌅' },
  { value: 'colacion1', label: 'Colación AM', hora: '11:00', icon: '🍎' },
  { value: 'comida', label: 'Comida', hora: '14:00', icon: '🍽️' },
  { value: 'colacion2', label: 'Colación PM', hora: '17:00', icon: '🍪' },
  { value: 'cena', label: 'Cena', hora: '20:00', icon: '🌙' }
];

const categoriasComida: { value: CategoriaComida; label: string }[] = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'plato_fuerte', label: 'Plato Fuerte' },
  { value: 'postre', label: 'Postre' },
  { value: 'bebida', label: 'Bebida' },
  { value: 'snack', label: 'Snack' }
];

const nivelesConsumo: { value: NivelConsumo; label: string; porcentaje: number; color: string }[] = [
  { value: 'todo', label: 'Todo', porcentaje: 100, color: 'bg-green-500' },
  { value: 'mayor_parte', label: 'Mayor parte', porcentaje: 75, color: 'bg-green-400' },
  { value: 'mitad', label: 'Mitad', porcentaje: 50, color: 'bg-yellow-500' },
  { value: 'poco', label: 'Poco', porcentaje: 25, color: 'bg-orange-500' },
  { value: 'nada', label: 'Nada', porcentaje: 0, color: 'bg-red-500' }
];

export default function MenuComida() {
  const { userProfile } = useAuth();
  const [comidas, setComidas] = useState<ComidaProgramada[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [loading, setLoading] = useState(true);
  const [semanaActual, setSemanaActual] = useState(new Date());
  const [vista, setVista] = useState<'menu' | 'recetas'>('menu');
  const [modalComida, setModalComida] = useState(false);
  const [modalConsumo, setModalConsumo] = useState(false);
  const [modalReceta, setModalReceta] = useState(false);
  const [comidaSeleccionada, setComidaSeleccionada] = useState<ComidaProgramada | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null);
  const [tipoComidaSeleccionado, setTipoComidaSeleccionado] = useState<TipoComida>('desayuno');

  const [formComida, setFormComida] = useState({
    platillo: '',
    categoria: 'plato_fuerte' as CategoriaComida,
    ingredientes: [] as string[],
    instrucciones: '',
    calorias: 0,
    horaProgramada: '08:00'
  });

  const [formConsumo, setFormConsumo] = useState({
    nivelConsumo: 'todo' as NivelConsumo,
    motivoRechazo: '',
    notasConsumo: '',
    satisfaccion: 3
  });

  const [nuevoIngrediente, setNuevoIngrediente] = useState('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');

  // Estados para CRUD de recetas
  const [modalRecetaCRUD, setModalRecetaCRUD] = useState(false);
  const [recetaEditando, setRecetaEditando] = useState<Receta | null>(null);
  const [busquedaReceta, setBusquedaReceta] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaComida | 'todas'>('todas');
  const [mostrarSoloFavoritas, setMostrarSoloFavoritas] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [nuevoIngredienteReceta, setNuevoIngredienteReceta] = useState('');
  const [nuevaEtiquetaReceta, setNuevaEtiquetaReceta] = useState('');

  const [formReceta, setFormReceta] = useState({
    nombre: '',
    categoria: 'plato_fuerte' as CategoriaComida,
    ingredientes: [] as string[],
    instrucciones: '',
    etiquetas: [] as string[],
    favorita: false,
    foto: '',
  });

  const inicioSemana = startOfWeek(semanaActual, { weekStartsOn: 1 });
  const finSemana = endOfWeek(semanaActual, { weekStartsOn: 1 });
  const diasSemana = eachDayOfInterval({ start: inicioSemana, end: finSemana });

  // Cargar comidas
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'comidas'),
      orderBy('fecha', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comidasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha?.toDate(),
        horaServida: doc.data().horaServida?.toDate(),
        creadoEn: doc.data().creadoEn?.toDate(),
        actualizadoEn: doc.data().actualizadoEn?.toDate()
      })) as ComidaProgramada[];
      setComidas(comidasData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cargar recetas
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'recetas'),
      orderBy('nombre', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recetasData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          creadoEn: doc.data().creadoEn?.toDate(),
          actualizadoEn: doc.data().actualizadoEn?.toDate()
        }))
        .filter(r => r.activo !== false) as Receta[];
      setRecetas(recetasData);
    });

    return () => unsubscribe();
  }, []);

  // Comidas del día
  function comidasDelDia(fecha: Date): ComidaProgramada[] {
    return comidas.filter(c => c.fecha && isSameDay(c.fecha, fecha));
  }

  // Obtener comida por tipo
  function comidaPorTipo(fecha: Date, tipo: TipoComida): ComidaProgramada | undefined {
    return comidasDelDia(fecha).find(c => c.tipoComida === tipo);
  }

  // Crear comida
  async function crearComida() {
    if (!fechaSeleccionada || !formComida.platillo) return;

    const nuevaComida = {
      pacienteId: PACIENTE_ID,
      fecha: Timestamp.fromDate(fechaSeleccionada),
      tipoComida: tipoComidaSeleccionado,
      horaProgramada: formComida.horaProgramada,
      platillo: formComida.platillo,
      categoria: formComida.categoria,
      ingredientes: formComida.ingredientes.length > 0 ? formComida.ingredientes : null,
      instruccionesPreparacion: formComida.instrucciones || null,
      valorNutricional: formComida.calorias > 0 ? { calorias: formComida.calorias, proteinas: 0, carbohidratos: 0, grasas: 0 } : null,
      creadoEn: Timestamp.now(),
      actualizadoEn: Timestamp.now()
    };

    await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'comidas'), nuevaComida);
    cerrarModalComida();
  }

  // Registrar consumo
  async function registrarConsumo() {
    if (!comidaSeleccionada) return;

    const nivel = nivelesConsumo.find(n => n.value === formConsumo.nivelConsumo);

    await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'comidas', comidaSeleccionada.id), {
      nivelConsumo: formConsumo.nivelConsumo,
      porcentajeConsumido: nivel?.porcentaje || 0,
      motivoRechazo: formConsumo.motivoRechazo || null,
      notasConsumo: formConsumo.notasConsumo || null,
      satisfaccion: formConsumo.satisfaccion,
      horaServida: Timestamp.now(),
      preparadoPor: userProfile?.id,
      actualizadoEn: Timestamp.now()
    });

    setModalConsumo(false);
    setComidaSeleccionada(null);
    setFormConsumo({ nivelConsumo: 'todo', motivoRechazo: '', notasConsumo: '', satisfaccion: 3 });
  }

  // Eliminar comida
  async function eliminarComida(comida: ComidaProgramada) {
    if (!confirm('¿Eliminar esta comida?')) return;
    await deleteDoc(doc(db, 'pacientes', PACIENTE_ID, 'comidas', comida.id));
  }

  // Usar receta
  function usarReceta(receta: Receta) {
    setFormComida({
      ...formComida,
      platillo: receta.nombre,
      categoria: receta.categoria,
      ingredientes: receta.ingredientes,
      instrucciones: receta.instrucciones
    });
    setModalReceta(false);
  }

  // Agregar ingrediente
  function agregarIngrediente() {
    if (!nuevoIngrediente.trim()) return;
    setFormComida({
      ...formComida,
      ingredientes: [...formComida.ingredientes, nuevoIngrediente.trim()]
    });
    setNuevoIngrediente('');
  }

  function cerrarModalComida() {
    setModalComida(false);
    setFechaSeleccionada(null);
    setFormComida({
      platillo: '',
      categoria: 'plato_fuerte',
      ingredientes: [],
      instrucciones: '',
      calorias: 0,
      horaProgramada: '08:00'
    });
  }

  // ========== FUNCIONES CRUD DE RECETAS ==========

  function abrirModalReceta(receta?: Receta) {
    if (receta) {
      setRecetaEditando(receta);
      setFormReceta({
        nombre: receta.nombre,
        categoria: receta.categoria,
        ingredientes: receta.ingredientes || [],
        instrucciones: receta.instrucciones,
        etiquetas: receta.etiquetas || [],
        favorita: receta.favorita,
        foto: receta.foto || '',
      });
    } else {
      setRecetaEditando(null);
      setFormReceta({
        nombre: '',
        categoria: 'plato_fuerte',
        ingredientes: [],
        instrucciones: '',
        etiquetas: [],
        favorita: false,
        foto: '',
      });
    }
    setModalRecetaCRUD(true);
  }

  function cerrarModalReceta() {
    setModalRecetaCRUD(false);
    setRecetaEditando(null);
    setNuevoIngredienteReceta('');
    setNuevaEtiquetaReceta('');
  }

  async function guardarReceta() {
    if (!formReceta.nombre.trim()) {
      alert('El nombre de la receta es obligatorio');
      return;
    }

    try {
      const recetaData = {
        pacienteId: PACIENTE_ID,
        nombre: formReceta.nombre.trim(),
        categoria: formReceta.categoria,
        ingredientes: formReceta.ingredientes,
        instrucciones: formReceta.instrucciones,
        etiquetas: formReceta.etiquetas,
        favorita: formReceta.favorita,
        foto: formReceta.foto || undefined,
        activo: true,
        actualizadoEn: Timestamp.now(),
      };

      if (recetaEditando) {
        await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'recetas', recetaEditando.id), recetaData);
      } else {
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'recetas'), {
          ...recetaData,
          creadoEn: Timestamp.now(),
        });
      }

      cerrarModalReceta();
    } catch (error) {
      console.error('Error al guardar receta:', error);
      alert('Error al guardar la receta');
    }
  }

  async function eliminarReceta(receta: Receta) {
    if (!confirm(`¿Eliminar la receta "${receta.nombre}"?`)) return;

    try {
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'recetas', receta.id), {
        activo: false,
        actualizadoEn: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al eliminar receta:', error);
      alert('Error al eliminar la receta');
    }
  }

  async function duplicarReceta(receta: Receta) {
    try {
      await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'recetas'), {
        pacienteId: PACIENTE_ID,
        nombre: `${receta.nombre} (copia)`,
        categoria: receta.categoria,
        ingredientes: receta.ingredientes,
        instrucciones: receta.instrucciones,
        etiquetas: receta.etiquetas,
        favorita: false,
        foto: receta.foto,
        activo: true,
        creadoEn: Timestamp.now(),
        actualizadoEn: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al duplicar receta:', error);
      alert('Error al duplicar la receta');
    }
  }

  async function toggleFavoritaReceta(receta: Receta) {
    try {
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'recetas', receta.id), {
        favorita: !receta.favorita,
        actualizadoEn: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al cambiar favorita:', error);
    }
  }

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFoto(true);
      const storageRef = ref(storage, `recetas/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFormReceta({ ...formReceta, foto: url });
    } catch (error) {
      console.error('Error al subir foto:', error);
      alert('Error al subir la foto');
    } finally {
      setUploadingFoto(false);
    }
  }

  // Filtrado de recetas
  const recetasFiltradas = recetas
    .filter(r => filtroCategoria === 'todas' || r.categoria === filtroCategoria)
    .filter(r => !filtroEtiqueta || r.etiquetas?.includes(filtroEtiqueta))
    .filter(r => !mostrarSoloFavoritas || r.favorita)
    .filter(r => !busquedaReceta ||
      r.nombre.toLowerCase().includes(busquedaReceta.toLowerCase()) ||
      r.ingredientes?.some(i => i.toLowerCase().includes(busquedaReceta.toLowerCase()))
    );

  const todasEtiquetas = [...new Set(recetas.flatMap(r => r.etiquetas || []))];

  // Calcular estadísticas de consumo
  function estadisticasSemana() {
    const comidasSemana = comidas.filter(c =>
      c.fecha && c.fecha >= inicioSemana && c.fecha <= finSemana && c.nivelConsumo
    );

    const totalConsumo = comidasSemana.reduce((sum, c) => sum + (c.porcentajeConsumido || 0), 0);
    const promedio = comidasSemana.length > 0 ? Math.round(totalConsumo / comidasSemana.length) : 0;

    const porNivel: Record<string, number> = {};
    comidasSemana.forEach(c => {
      if (c.nivelConsumo) {
        porNivel[c.nivelConsumo] = (porNivel[c.nivelConsumo] || 0) + 1;
      }
    });

    const totalCalorias = comidasSemana.reduce((sum, c) => {
      const cal = c.valorNutricional?.calorias || 0;
      const porc = (c.porcentajeConsumido || 0) / 100;
      return sum + (cal * porc);
    }, 0);

    return {
      registradas: comidasSemana.length,
      promedioConsumo: promedio,
      porNivel,
      totalCalorias: Math.round(totalCalorias)
    };
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex justify-center items-center h-64">
          <div className="text-gray-500">Cargando menú...</div>
        </div>
      </Layout>
    );
  }

  const stats = estadisticasSemana();

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🍽️ Menú de Comidas</h1>
            <p className="text-gray-600">Planificación y registro de alimentación</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setVista(vista === 'menu' ? 'recetas' : 'menu')}
              className={`px-4 py-2 rounded-lg font-medium ${
                vista === 'recetas' ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {vista === 'menu' ? '📖 Ver Recetas' : '📅 Ver Menú'}
            </button>
          </div>
        </div>

        {vista === 'menu' ? (
          <>
            {/* Estadísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.registradas}</div>
                <div className="text-sm text-gray-500">Comidas registradas</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{stats.promedioConsumo}%</div>
                <div className="text-sm text-gray-500">Promedio consumo</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-3xl font-bold text-orange-600">{stats.totalCalorias}</div>
                <div className="text-sm text-gray-500">Calorías consumidas</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500 mb-1">Por nivel:</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(stats.porNivel).map(([nivel, count]) => {
                    const config = nivelesConsumo.find(n => n.value === nivel);
                    return (
                      <span key={nivel} className={`text-xs px-2 py-0.5 rounded text-white ${config?.color}`}>
                        {config?.label}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Navegación de semana */}
            <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-lg shadow">
              <button
                onClick={() => setSemanaActual(subWeeks(semanaActual, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ← Anterior
              </button>
              <div className="text-center">
                <h2 className="font-semibold">
                  {format(inicioSemana, "d 'de' MMMM", { locale: es })} - {format(finSemana, "d 'de' MMMM yyyy", { locale: es })}
                </h2>
                <button
                  onClick={() => setSemanaActual(new Date())}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Ir a hoy
                </button>
              </div>
              <button
                onClick={() => setSemanaActual(addWeeks(semanaActual, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                Siguiente →
              </button>
            </div>

            {/* Calendario de menú */}
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-left w-24">Comida</th>
                    {diasSemana.map((dia, idx) => {
                      const esHoy = isSameDay(dia, new Date());
                      return (
                        <th
                          key={idx}
                          className={`p-3 text-center ${esHoy ? 'bg-blue-50' : ''}`}
                        >
                          <div className="text-sm text-gray-500">{format(dia, 'EEE', { locale: es })}</div>
                          <div className={`text-lg font-semibold ${esHoy ? 'text-blue-600' : ''}`}>
                            {format(dia, 'd')}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {tiposComida.map(tipo => (
                    <tr key={tipo.value} className="border-b">
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-2">
                          <span>{tipo.icon}</span>
                          <div>
                            <div className="text-sm">{tipo.label}</div>
                            <div className="text-xs text-gray-400">{tipo.hora}</div>
                          </div>
                        </div>
                      </td>
                      {diasSemana.map((dia, idx) => {
                        const comida = comidaPorTipo(dia, tipo.value);
                        const esHoy = isSameDay(dia, new Date());

                        return (
                          <td
                            key={idx}
                            className={`p-2 ${esHoy ? 'bg-blue-50/50' : ''}`}
                          >
                            {comida ? (
                              <div
                                onClick={() => {
                                  setComidaSeleccionada(comida);
                                  if (!comida.nivelConsumo) {
                                    setModalConsumo(true);
                                  }
                                }}
                                className={`p-2 rounded-lg cursor-pointer hover:shadow-md transition-shadow text-sm ${
                                  comida.nivelConsumo
                                    ? nivelesConsumo.find(n => n.value === comida.nivelConsumo)?.color + ' text-white'
                                    : 'bg-gray-100 border border-gray-200'
                                }`}
                              >
                                <div className="font-medium truncate">{comida.platillo}</div>
                                {comida.nivelConsumo && (
                                  <div className="text-xs opacity-90">
                                    {comida.porcentajeConsumido}% consumido
                                  </div>
                                )}
                                {comida.valorNutricional?.calorias && (
                                  <div className="text-xs opacity-75">
                                    {comida.valorNutricional.calorias} cal
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setFechaSeleccionada(dia);
                                  setTipoComidaSeleccionado(tipo.value);
                                  setFormComida({ ...formComida, horaProgramada: tipo.hora });
                                  setModalComida(true);
                                }}
                                className="w-full p-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded border border-dashed border-gray-300"
                              >
                                + Agregar
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Leyenda de niveles */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              {nivelesConsumo.map(nivel => (
                <div key={nivel.value} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${nivel.color}`}></div>
                  <span>{nivel.label} ({nivel.porcentaje}%)</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Vista de Recetas */
          <div className="bg-white rounded-lg shadow p-6">
            {/* Header con botón nueva receta */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h3 className="text-lg font-semibold">Banco de Recetas</h3>
              <button
                onClick={() => abrirModalReceta()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                + Nueva Receta
              </button>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <input
                type="text"
                value={busquedaReceta}
                onChange={(e) => setBusquedaReceta(e.target.value)}
                placeholder="Buscar receta o ingrediente..."
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value as CategoriaComida | 'todas')}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="todas">Todas las categorías</option>
                {categoriasComida.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <select
                value={filtroEtiqueta}
                onChange={(e) => setFiltroEtiqueta(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todas las etiquetas</option>
                {todasEtiquetas.map(etq => (
                  <option key={etq} value={etq}>{etq}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mostrarSoloFavoritas}
                  onChange={(e) => setMostrarSoloFavoritas(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm">Solo favoritas</span>
              </label>
            </div>

            {/* Contador de resultados */}
            <p className="text-sm text-gray-500 mb-4">
              Mostrando {recetasFiltradas.length} de {recetas.length} recetas
            </p>

            {/* Grid de recetas */}
            {recetasFiltradas.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">No hay recetas</p>
                <p className="text-sm">Crea tu primera receta con el botón "+ Nueva Receta"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recetasFiltradas.map(receta => (
                  <div
                    key={receta.id}
                    className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Foto o placeholder */}
                    {receta.foto ? (
                      <img
                        src={receta.foto}
                        alt={receta.nombre}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-4xl">
                        🍽️
                      </div>
                    )}

                    <div className="p-4">
                      {/* Nombre y favorita */}
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{receta.nombre}</h4>
                        <button
                          onClick={() => toggleFavoritaReceta(receta)}
                          className="text-xl hover:scale-110 transition-transform"
                          title={receta.favorita ? 'Quitar de favoritas' : 'Agregar a favoritas'}
                        >
                          {receta.favorita ? '⭐' : '☆'}
                        </button>
                      </div>

                      {/* Categoría */}
                      <p className="text-sm text-gray-600 mb-2">
                        {categoriasComida.find(c => c.value === receta.categoria)?.label}
                      </p>

                      {/* Etiquetas */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {receta.etiquetas?.slice(0, 3).map(etq => (
                          <span key={etq} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                            {etq}
                          </span>
                        ))}
                        {receta.etiquetas?.length > 3 && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                            +{receta.etiquetas.length - 3}
                          </span>
                        )}
                      </div>


                      {/* Botones de acción */}
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <button
                          onClick={() => abrirModalReceta(receta)}
                          className="py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => duplicarReceta(receta)}
                          className="py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Duplicar
                        </button>
                        <button
                          onClick={() => eliminarReceta(receta)}
                          className="py-1.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                        >
                          Eliminar
                        </button>
                      </div>

                      {/* Botón usar en menú */}
                      <button
                        onClick={() => {
                          usarReceta(receta);
                          setModalComida(true);
                        }}
                        className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Usar en menú
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Agregar Comida */}
        {modalComida && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-lg w-full p-6 my-8">
              <h2 className="text-xl font-bold mb-4">
                🍽️ Agregar Comida - {tiposComida.find(t => t.value === tipoComidaSeleccionado)?.label}
              </h2>
              {fechaSeleccionada && (
                <p className="text-sm text-gray-500 mb-4">
                  {format(fechaSeleccionada, "EEEE d 'de' MMMM", { locale: es })}
                </p>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Seleccionar de recetas</label>
                  <button
                    onClick={() => setModalReceta(true)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    📖 Ver recetas
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platillo *</label>
                  <input
                    type="text"
                    value={formComida.platillo}
                    onChange={(e) => setFormComida({ ...formComida, platillo: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Nombre del platillo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <select
                      value={formComida.categoria}
                      onChange={(e) => setFormComida({ ...formComida, categoria: e.target.value as CategoriaComida })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      {categoriasComida.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Calorías</label>
                    <input
                      type="number"
                      value={formComida.calorias || ''}
                      onChange={(e) => setFormComida({ ...formComida, calorias: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="kcal"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ingredientes</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={nuevoIngrediente}
                      onChange={(e) => setNuevoIngrediente(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder="Agregar ingrediente..."
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarIngrediente())}
                    />
                    <button
                      type="button"
                      onClick={agregarIngrediente}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formComida.ingredientes.map((ing, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1">
                        {ing}
                        <button
                          onClick={() => setFormComida({
                            ...formComida,
                            ingredientes: formComida.ingredientes.filter((_, i) => i !== idx)
                          })}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones</label>
                  <textarea
                    value={formComida.instrucciones}
                    onChange={(e) => setFormComida({ ...formComida, instrucciones: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Instrucciones de preparación..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={cerrarModalComida}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={crearComida}
                  disabled={!formComida.platillo}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Agregar al Menú
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Registrar Consumo */}
        {modalConsumo && comidaSeleccionada && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">🍴 Registrar Consumo</h2>

              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <p className="font-medium">{comidaSeleccionada.platillo}</p>
                <p className="text-sm text-gray-600">
                  {tiposComida.find(t => t.value === comidaSeleccionada.tipoComida)?.label} - {comidaSeleccionada.horaProgramada}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Cuánto consumió?
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {nivelesConsumo.map(nivel => (
                      <button
                        key={nivel.value}
                        onClick={() => setFormConsumo({ ...formConsumo, nivelConsumo: nivel.value })}
                        className={`p-2 rounded-lg text-center text-sm ${
                          formConsumo.nivelConsumo === nivel.value
                            ? `${nivel.color} text-white`
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        <div className="font-medium">{nivel.porcentaje}%</div>
                        <div className="text-xs">{nivel.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {(formConsumo.nivelConsumo === 'poco' || formConsumo.nivelConsumo === 'nada') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Motivo del rechazo
                    </label>
                    <input
                      type="text"
                      value={formConsumo.motivoRechazo}
                      onChange={(e) => setFormConsumo({ ...formConsumo, motivoRechazo: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="¿Por qué no comió?"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Satisfacción
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setFormConsumo({ ...formConsumo, satisfaccion: n })}
                        className={`w-10 h-10 rounded-full text-xl ${
                          formConsumo.satisfaccion >= n ? 'bg-yellow-400' : 'bg-gray-200'
                        }`}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={formConsumo.notasConsumo}
                    onChange={(e) => setFormConsumo({ ...formConsumo, notasConsumo: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Observaciones adicionales..."
                  />
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <button
                  onClick={() => {
                    eliminarComida(comidaSeleccionada);
                    setModalConsumo(false);
                    setComidaSeleccionada(null);
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  🗑️ Eliminar
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setModalConsumo(false);
                      setComidaSeleccionada(null);
                      setFormConsumo({ nivelConsumo: 'todo', motivoRechazo: '', notasConsumo: '', satisfaccion: 3 });
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={registrarConsumo}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    ✓ Registrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Seleccionar Receta */}
        {modalReceta && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Seleccionar Receta</h2>
                <button
                  onClick={() => setModalReceta(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recetas.map(receta => (
                  <button
                    key={receta.id}
                    onClick={() => usarReceta(receta)}
                    className="text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300"
                  >
                    <div className="font-medium">{receta.nombre}</div>
                    <div className="text-sm text-gray-500">
                      {categoriasComida.find(c => c.value === receta.categoria)?.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal Crear/Editar Receta */}
        {modalRecetaCRUD && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
              {/* Header sticky */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">
                    {recetaEditando ? 'Editar Receta' : 'Nueva Receta'}
                  </h2>
                  <button
                    onClick={cerrarModalReceta}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Información básica */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Información Básica</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                      <input
                        type="text"
                        value={formReceta.nombre}
                        onChange={(e) => setFormReceta({ ...formReceta, nombre: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Nombre de la receta"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                      <select
                        value={formReceta.categoria}
                        onChange={(e) => setFormReceta({ ...formReceta, categoria: e.target.value as CategoriaComida })}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        {categoriasComida.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formReceta.favorita}
                          onChange={(e) => setFormReceta({ ...formReceta, favorita: e.target.checked })}
                          className="h-4 w-4 rounded"
                        />
                        <span className="text-sm">Marcar como favorita</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Ingredientes */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Ingredientes</h3>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={nuevoIngredienteReceta}
                      onChange={(e) => setNuevoIngredienteReceta(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && nuevoIngredienteReceta.trim()) {
                          e.preventDefault();
                          setFormReceta({ ...formReceta, ingredientes: [...formReceta.ingredientes, nuevoIngredienteReceta.trim()] });
                          setNuevoIngredienteReceta('');
                        }
                      }}
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder="Agregar ingrediente..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (nuevoIngredienteReceta.trim()) {
                          setFormReceta({ ...formReceta, ingredientes: [...formReceta.ingredientes, nuevoIngredienteReceta.trim()] });
                          setNuevoIngredienteReceta('');
                        }
                      }}
                      className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formReceta.ingredientes.map((ing, idx) => (
                      <span key={idx} className="px-3 py-1 bg-white border rounded-full text-sm flex items-center gap-2">
                        {ing}
                        <button
                          onClick={() => setFormReceta({
                            ...formReceta,
                            ingredientes: formReceta.ingredientes.filter((_, i) => i !== idx)
                          })}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Instrucciones */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Instrucciones</h3>
                  <textarea
                    value={formReceta.instrucciones}
                    onChange={(e) => setFormReceta({ ...formReceta, instrucciones: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={4}
                    placeholder="Pasos para preparar la receta..."
                  />
                </div>

                {/* Etiquetas */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Etiquetas</h3>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={nuevaEtiquetaReceta}
                      onChange={(e) => setNuevaEtiquetaReceta(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && nuevaEtiquetaReceta.trim()) {
                          e.preventDefault();
                          setFormReceta({ ...formReceta, etiquetas: [...formReceta.etiquetas, nuevaEtiquetaReceta.trim()] });
                          setNuevaEtiquetaReceta('');
                        }
                      }}
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder="Agregar etiqueta (ej: desayuno, proteína)..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (nuevaEtiquetaReceta.trim()) {
                          setFormReceta({ ...formReceta, etiquetas: [...formReceta.etiquetas, nuevaEtiquetaReceta.trim()] });
                          setNuevaEtiquetaReceta('');
                        }
                      }}
                      className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formReceta.etiquetas.map((etq, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                        {etq}
                        <button
                          onClick={() => setFormReceta({
                            ...formReceta,
                            etiquetas: formReceta.etiquetas.filter((_, i) => i !== idx)
                          })}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Foto */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Foto</h3>
                  {formReceta.foto ? (
                    <div className="relative inline-block">
                      <img
                        src={formReceta.foto}
                        alt="Preview"
                        className="w-48 h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => setFormReceta({ ...formReceta, foto: '' })}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFotoUpload}
                        disabled={uploadingFoto}
                        className="block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-lg file:border-0
                          file:text-sm file:font-medium
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100"
                      />
                      {uploadingFoto && (
                        <p className="text-sm text-gray-500 mt-2">Subiendo foto...</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={cerrarModalReceta}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarReceta}
                    disabled={!formReceta.nombre.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {recetaEditando ? 'Actualizar' : 'Crear'} Receta
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
