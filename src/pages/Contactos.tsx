import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import Layout from '../components/common/Layout';
import { Contacto, CategoriaContacto } from '../types';

const PACIENTE_ID = 'paciente-principal';

const categorias: { value: CategoriaContacto; label: string; icon: string }[] = [
  { value: 'medico', label: 'Médico', icon: '👨‍⚕️' },
  { value: 'cuidador', label: 'Cuidador', icon: '👤' },
  { value: 'familiar', label: 'Familiar', icon: '👨‍👩‍👧' },
  { value: 'emergencia', label: 'Emergencia', icon: '🚨' },
  { value: 'servicio', label: 'Servicio', icon: '🔧' },
  { value: 'otro', label: 'Otro', icon: '📋' },
];

export default function Contactos() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Contacto | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaContacto | 'todos'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [mostrarSoloFavoritos, setMostrarSoloFavoritos] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    categoria: 'medico' as CategoriaContacto,
    especialidad: '',
    cedulaProfesional: '',
    telefonoPrincipal: '',
    telefonoAlternativo: '',
    email: '',
    direccion: '',
    coordenadas: { lat: 0, lng: 0 },
    horarioAtencion: '',
    consultorioHospital: '',
    segurosAcepta: [] as string[],
    notas: '',
    favorito: false,
    foto: '',
  });

  // Cargar contactos
  useEffect(() => {
    cargarContactos();
  }, []);

  async function cargarContactos() {
    try {
      // Consulta simple sin índice compuesto - filtramos y ordenamos en el cliente
      const querySnapshot = await getDocs(
        collection(db, 'pacientes', PACIENTE_ID, 'contactos')
      );
      const contactosData: Contacto[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Filtrar solo activos
        if (data.activo !== false) {
          contactosData.push({
            id: docSnap.id,
            ...data,
            creadoEn: data.creadoEn?.toDate() || new Date(),
            actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
          } as Contacto);
        }
      });

      // Ordenar: favoritos primero, luego por nombre
      contactosData.sort((a, b) => {
        if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
        return a.nombre.localeCompare(b.nombre);
      });

      setContactos(contactosData);
    } catch (error) {
      console.error('Error al cargar contactos:', error);
      alert('Error al cargar los contactos');
    } finally {
      setLoading(false);
    }
  }

  function abrirModal(contacto?: Contacto) {
    if (contacto) {
      setEditando(contacto);
      setFormData({
        nombre: contacto.nombre,
        categoria: contacto.categoria,
        especialidad: contacto.especialidad || '',
        cedulaProfesional: contacto.cedulaProfesional || '',
        telefonoPrincipal: contacto.telefonoPrincipal,
        telefonoAlternativo: contacto.telefonoAlternativo || '',
        email: contacto.email || '',
        direccion: contacto.direccion || '',
        coordenadas: contacto.coordenadas || { lat: 0, lng: 0 },
        horarioAtencion: contacto.horarioAtencion || '',
        consultorioHospital: contacto.consultorioHospital || '',
        segurosAcepta: contacto.segurosAcepta || [],
        notas: contacto.notas || '',
        favorito: contacto.favorito,
        foto: contacto.foto || '',
      });
    } else {
      setEditando(null);
      setFormData({
        nombre: '',
        categoria: 'medico',
        especialidad: '',
        cedulaProfesional: '',
        telefonoPrincipal: '',
        telefonoAlternativo: '',
        email: '',
        direccion: '',
        coordenadas: { lat: 0, lng: 0 },
        horarioAtencion: '',
        consultorioHospital: '',
        segurosAcepta: [],
        notas: '',
        favorito: false,
        foto: '',
      });
    }
    setShowModal(true);
  }

  function cerrarModal() {
    setShowModal(false);
    setEditando(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.nombre || !formData.telefonoPrincipal) {
      alert('Por favor completa los campos obligatorios');
      return;
    }

    try {
      const ahora = Timestamp.now();

      const contactoData = {
        pacienteId: PACIENTE_ID,
        nombre: formData.nombre,
        categoria: formData.categoria,
        especialidad: formData.especialidad || undefined,
        cedulaProfesional: formData.cedulaProfesional || undefined,
        telefonoPrincipal: formData.telefonoPrincipal,
        telefonoAlternativo: formData.telefonoAlternativo || undefined,
        email: formData.email || undefined,
        direccion: formData.direccion || undefined,
        coordenadas:
          formData.coordenadas.lat !== 0 || formData.coordenadas.lng !== 0
            ? formData.coordenadas
            : undefined,
        horarioAtencion: formData.horarioAtencion || undefined,
        consultorioHospital: formData.consultorioHospital || undefined,
        segurosAcepta: formData.segurosAcepta.length > 0 ? formData.segurosAcepta : undefined,
        notas: formData.notas || undefined,
        favorito: formData.favorito,
        foto: formData.foto || undefined,
        activo: true,
        actualizadoEn: ahora,
      };

      if (editando) {
        await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'contactos', editando.id), contactoData);
        alert('Contacto actualizado correctamente');
      } else {
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'contactos'), {
          ...contactoData,
          creadoEn: ahora,
        });
        alert('Contacto creado correctamente');
      }

      cerrarModal();
      cargarContactos();
    } catch (error) {
      console.error('Error al guardar contacto:', error);
      alert('Error al guardar el contacto');
    }
  }

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFoto(true);
      const storageRef = ref(storage, `contactos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFormData({ ...formData, foto: url });
      alert('Foto subida correctamente');
    } catch (error) {
      console.error('Error al subir foto:', error);
      alert('Error al subir la foto');
    } finally {
      setUploadingFoto(false);
    }
  }

  async function toggleFavorito(contacto: Contacto) {
    try {
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'contactos', contacto.id), {
        favorito: !contacto.favorito,
        actualizadoEn: Timestamp.now(),
      });
      cargarContactos();
    } catch (error) {
      console.error('Error al cambiar favorito:', error);
      alert('Error al cambiar favorito');
    }
  }

  async function desactivarContacto(contacto: Contacto) {
    if (!confirm(`¿Desactivar contacto "${contacto.nombre}"?`)) return;

    try {
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'contactos', contacto.id), {
        activo: false,
        actualizadoEn: Timestamp.now(),
      });
      cargarContactos();
      alert('Contacto desactivado');
    } catch (error) {
      console.error('Error al desactivar contacto:', error);
      alert('Error al desactivar el contacto');
    }
  }

  function agregarSeguro() {
    const seguro = prompt('Nombre del seguro médico:');
    if (seguro) {
      setFormData({
        ...formData,
        segurosAcepta: [...formData.segurosAcepta, seguro],
      });
    }
  }

  function eliminarSeguro(index: number) {
    setFormData({
      ...formData,
      segurosAcepta: formData.segurosAcepta.filter((_, i) => i !== index),
    });
  }

  // Filtrar contactos
  const contactosFiltrados = contactos.filter((contacto) => {
    const matchCategoria = filtroCategoria === 'todos' || contacto.categoria === filtroCategoria;
    const matchBusqueda =
      busqueda === '' ||
      contacto.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      contacto.especialidad?.toLowerCase().includes(busqueda.toLowerCase()) ||
      contacto.consultorioHospital?.toLowerCase().includes(busqueda.toLowerCase());
    const matchFavorito = !mostrarSoloFavoritos || contacto.favorito;
    return matchCategoria && matchBusqueda && matchFavorito;
  });

  const getCategoriaInfo = (categoria: CategoriaContacto) => {
    return categorias.find((c) => c.value === categoria);
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-8 flex justify-center items-center">
          <p className="text-gray-600">Cargando contactos...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">📇 Agenda de Contactos</h1>
            <p className="text-gray-600 mt-2">Gestiona los contactos del paciente</p>
          </div>

          {/* Filtros y búsqueda */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Búsqueda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre, especialidad..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Filtro categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value as CategoriaContacto | 'todos')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todas</option>
                  {categorias.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Favoritos */}
              <div className="flex items-end">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mostrarSoloFavoritos}
                    onChange={(e) => setMostrarSoloFavoritos(e.target.checked)}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">⭐ Solo favoritos</span>
                </label>
              </div>

              {/* Botón agregar */}
              <div className="flex items-end">
                <button
                  onClick={() => abrirModal()}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  + Nuevo Contacto
                </button>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              Mostrando <strong>{contactosFiltrados.length}</strong> de{' '}
              <strong>{contactos.length}</strong> contactos
            </p>
          </div>

          {/* Lista de contactos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contactosFiltrados.map((contacto) => {
              const catInfo = getCategoriaInfo(contacto.categoria);
              return (
                <div
                  key={contacto.id}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200"
                >
                  {/* Header con foto y favorito */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {contacto.foto ? (
                          <img
                            src={contacto.foto}
                            alt={contacto.nombre}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-2xl">
                            {catInfo?.icon}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-gray-900">{contacto.nombre}</h3>
                          <p className="text-xs text-gray-500">
                            {catInfo?.icon} {catInfo?.label}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleFavorito(contacto)}
                        className="text-2xl hover:scale-110 transition-transform"
                      >
                        {contacto.favorito ? '⭐' : '☆'}
                      </button>
                    </div>

                    {contacto.especialidad && (
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Especialidad:</strong> {contacto.especialidad}
                      </p>
                    )}
                  </div>

                  {/* Información de contacto */}
                  <div className="p-4 space-y-2">
                    {/* Teléfono principal */}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">📞</span>
                      <a
                        href={`tel:${contacto.telefonoPrincipal}`}
                        className="text-blue-600 hover:underline"
                      >
                        {contacto.telefonoPrincipal}
                      </a>
                    </div>

                    {/* Teléfono alternativo */}
                    {contacto.telefonoAlternativo && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">📱</span>
                        <a
                          href={`tel:${contacto.telefonoAlternativo}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contacto.telefonoAlternativo}
                        </a>
                      </div>
                    )}

                    {/* Email */}
                    {contacto.email && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">✉️</span>
                        <a
                          href={`mailto:${contacto.email}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {contacto.email}
                        </a>
                      </div>
                    )}

                    {/* Consultorio */}
                    {contacto.consultorioHospital && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-400">🏥</span>
                        <span className="text-sm text-gray-700">{contacto.consultorioHospital}</span>
                      </div>
                    )}

                    {/* Dirección */}
                    {contacto.direccion && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-400">📍</span>
                        <div className="flex-1">
                          <span className="text-sm text-gray-700">{contacto.direccion}</span>
                          {contacto.coordenadas && (contacto.coordenadas.lat !== 0 || contacto.coordenadas.lng !== 0) && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${contacto.coordenadas.lat},${contacto.coordenadas.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-blue-600 hover:underline mt-1"
                            >
                              Ver en Google Maps →
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Horario */}
                    {contacto.horarioAtencion && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">🕒</span>
                        <span className="text-sm text-gray-700">{contacto.horarioAtencion}</span>
                      </div>
                    )}

                    {/* Seguros */}
                    {contacto.segurosAcepta && contacto.segurosAcepta.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-400">💳</span>
                        <span className="text-sm text-gray-700">
                          {contacto.segurosAcepta.join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Notas */}
                    {contacto.notas && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-600 italic">{contacto.notas}</p>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="p-4 border-t border-gray-200 flex gap-2">
                    <button
                      onClick={() => abrirModal(contacto)}
                      className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => desactivarContacto(contacto)}
                      className="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded-lg transition-colors"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {contactosFiltrados.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No se encontraron contactos</p>
              <p className="text-gray-400 text-sm mt-2">Intenta cambiar los filtros de búsqueda</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {editando ? 'Editar Contacto' : 'Nuevo Contacto'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Información básica */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Información Básica</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoría *
                    </label>
                    <select
                      required
                      value={formData.categoria}
                      onChange={(e) =>
                        setFormData({ ...formData, categoria: e.target.value as CategoriaContacto })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {categorias.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.categoria === 'medico' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Especialidad
                        </label>
                        <input
                          type="text"
                          value={formData.especialidad}
                          onChange={(e) =>
                            setFormData({ ...formData, especialidad: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cédula Profesional
                        </label>
                        <input
                          type="text"
                          value={formData.cedulaProfesional}
                          onChange={(e) =>
                            setFormData({ ...formData, cedulaProfesional: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.favorito}
                        onChange={(e) => setFormData({ ...formData, favorito: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">⭐ Marcar como favorito</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Información de Contacto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono Principal *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.telefonoPrincipal}
                      onChange={(e) =>
                        setFormData({ ...formData, telefonoPrincipal: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono Alternativo
                    </label>
                    <input
                      type="tel"
                      value={formData.telefonoAlternativo}
                      onChange={(e) =>
                        setFormData({ ...formData, telefonoAlternativo: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Ubicación */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Ubicación</h3>
                <div className="space-y-4">
                  {formData.categoria === 'medico' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Consultorio / Hospital
                      </label>
                      <input
                        type="text"
                        value={formData.consultorioHospital}
                        onChange={(e) =>
                          setFormData({ ...formData, consultorioHospital: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
                    <textarea
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Latitud (opcional)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.coordenadas.lat}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            coordenadas: {
                              ...formData.coordenadas,
                              lat: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Longitud (opcional)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.coordenadas.lng}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            coordenadas: {
                              ...formData.coordenadas,
                              lng: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {formData.categoria === 'medico' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Horario de Atención
                      </label>
                      <input
                        type="text"
                        value={formData.horarioAtencion}
                        onChange={(e) =>
                          setFormData({ ...formData, horarioAtencion: e.target.value })
                        }
                        placeholder="Ej: Lunes a Viernes 9:00 - 18:00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Seguros médicos */}
              {formData.categoria === 'medico' && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Seguros que Acepta</h3>
                  <div className="space-y-2">
                    {formData.segurosAcepta.map((seguro, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                          {seguro}
                        </span>
                        <button
                          type="button"
                          onClick={() => eliminarSeguro(index)}
                          className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={agregarSeguro}
                      className="w-full px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors"
                    >
                      + Agregar Seguro
                    </button>
                  </div>
                </div>
              )}

              {/* Foto */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Foto</h3>
                <div className="space-y-4">
                  {formData.foto && (
                    <div className="flex justify-center">
                      <img
                        src={formData.foto}
                        alt="Foto del contacto"
                        className="w-32 h-32 rounded-full object-cover"
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFotoUpload}
                    disabled={uploadingFoto}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {uploadingFoto && <p className="text-sm text-gray-600">Subiendo foto...</p>}
                </div>
              </div>

              {/* Notas */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Notas</h3>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  rows={3}
                  placeholder="Información adicional relevante..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Botones */}
              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  {editando ? 'Actualizar' : 'Crear'} Contacto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
