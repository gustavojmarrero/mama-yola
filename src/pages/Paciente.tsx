import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Paciente, RangoSignosVitales } from '../types';
import Layout from '../components/common/Layout';

const PACIENTE_ID = 'paciente-principal'; // ID fijo para el único paciente

export default function PacientePage() {
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    fechaNacimiento: '',
    genero: 'otro' as 'masculino' | 'femenino' | 'otro',
    numeroIdentificacion: '',
    numeroSeguro: '',
    direccion: '',
    telefonoEmergencia: '',
    telefonoEmergencia2: '',
    alergias: [] as string[],
    condicionesMedicas: [] as string[],
    grupoSanguineo: '',
    peso: '',
    altura: '',
    nivelDependencia: 'bajo' as 'bajo' | 'medio' | 'alto',
    notas: '',
    // Rangos de signos vitales
    rangoPresionSistolica: { min: 90, max: 140 },
    rangoPresionDiastolica: { min: 60, max: 90 },
    rangoFrecuenciaCardiaca: { min: 60, max: 100 },
    rangoTemperatura: { min: 36.0, max: 37.5 },
    rangoSaturacionO2: { min: 95, max: 100 }
  });

  // Estados para manejar arrays
  const [nuevaAlergia, setNuevaAlergia] = useState('');
  const [nuevaCondicion, setNuevaCondicion] = useState('');

  useEffect(() => {
    cargarPaciente();
  }, []);

  async function cargarPaciente() {
    try {
      setLoading(true);
      const docRef = doc(db, 'pacientes', PACIENTE_ID);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Paciente;
        setPaciente(data);

        // Convertir Timestamp de Firebase a string para el input
        let fechaNacimiento = '';
        if (data.fechaNacimiento) {
          // Si es un Timestamp de Firestore (tiene método toDate)
          if (typeof (data.fechaNacimiento as any).toDate === 'function') {
            fechaNacimiento = (data.fechaNacimiento as any).toDate().toISOString().split('T')[0];
          } else if (data.fechaNacimiento instanceof Date) {
            fechaNacimiento = data.fechaNacimiento.toISOString().split('T')[0];
          } else if (typeof data.fechaNacimiento === 'string') {
            fechaNacimiento = data.fechaNacimiento.split('T')[0];
          }
        }

        setFormData({
          nombre: data.nombre,
          fechaNacimiento,
          genero: data.genero,
          numeroIdentificacion: data.numeroIdentificacion || '',
          numeroSeguro: data.numeroSeguro || '',
          direccion: data.direccion || '',
          telefonoEmergencia: data.telefonoEmergencia || '',
          telefonoEmergencia2: data.telefonoEmergencia2 || '',
          alergias: data.alergias || [],
          condicionesMedicas: data.condicionesMedicas || [],
          grupoSanguineo: data.grupoSanguineo || '',
          peso: data.peso?.toString() || '',
          altura: data.altura?.toString() || '',
          nivelDependencia: data.nivelDependencia || 'bajo',
          notas: data.notas || '',
          rangoPresionSistolica: data.rangoSignosVitales?.presionSistolica || { min: 90, max: 140 },
          rangoPresionDiastolica: data.rangoSignosVitales?.presionDiastolica || { min: 60, max: 90 },
          rangoFrecuenciaCardiaca: data.rangoSignosVitales?.frecuenciaCardiaca || { min: 60, max: 100 },
          rangoTemperatura: data.rangoSignosVitales?.temperatura || { min: 36.0, max: 37.5 },
          rangoSaturacionO2: data.rangoSignosVitales?.saturacionO2 || { min: 95, max: 100 }
        });
        setEditing(false);
      } else {
        // Si no existe, activar modo edición
        setEditing(true);
      }
    } catch (error) {
      console.error('Error cargando paciente:', error);
      alert('Error al cargar información del paciente');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const rangoSignosVitales: RangoSignosVitales = {
        presionSistolica: formData.rangoPresionSistolica,
        presionDiastolica: formData.rangoPresionDiastolica,
        frecuenciaCardiaca: formData.rangoFrecuenciaCardiaca,
        temperatura: formData.rangoTemperatura,
        saturacionO2: formData.rangoSaturacionO2
      };

      const pacienteData = {
        nombre: formData.nombre,
        fechaNacimiento: new Date(formData.fechaNacimiento),
        genero: formData.genero,
        numeroIdentificacion: formData.numeroIdentificacion,
        numeroSeguro: formData.numeroSeguro,
        direccion: formData.direccion,
        telefonoEmergencia: formData.telefonoEmergencia,
        telefonoEmergencia2: formData.telefonoEmergencia2,
        alergias: formData.alergias,
        condicionesMedicas: formData.condicionesMedicas,
        grupoSanguineo: formData.grupoSanguineo,
        peso: formData.peso ? parseFloat(formData.peso) : undefined,
        altura: formData.altura ? parseFloat(formData.altura) : undefined,
        nivelDependencia: formData.nivelDependencia,
        notas: formData.notas,
        rangoSignosVitales,
        activo: true,
        creadoEn: paciente?.creadoEn || new Date(),
        actualizadoEn: new Date()
      };

      await setDoc(doc(db, 'pacientes', PACIENTE_ID), pacienteData);
      alert('Información del paciente guardada exitosamente');
      cargarPaciente();
    } catch (error) {
      console.error('Error guardando paciente:', error);
      alert('Error al guardar información del paciente');
    }
  }

  function agregarAlergia() {
    if (nuevaAlergia.trim()) {
      setFormData({
        ...formData,
        alergias: [...formData.alergias, nuevaAlergia.trim()]
      });
      setNuevaAlergia('');
    }
  }

  function eliminarAlergia(index: number) {
    setFormData({
      ...formData,
      alergias: formData.alergias.filter((_, i) => i !== index)
    });
  }

  function agregarCondicion() {
    if (nuevaCondicion.trim()) {
      setFormData({
        ...formData,
        condicionesMedicas: [...formData.condicionesMedicas, nuevaCondicion.trim()]
      });
      setNuevaCondicion('');
    }
  }

  function eliminarCondicion(index: number) {
    setFormData({
      ...formData,
      condicionesMedicas: formData.condicionesMedicas.filter((_, i) => i !== index)
    });
  }

  // Función para convertir fecha de Firestore a Date
  function convertirFecha(fecha: any): Date | null {
    if (!fecha) return null;
    if (typeof fecha.toDate === 'function') {
      return fecha.toDate();
    }
    if (fecha instanceof Date) {
      return fecha;
    }
    const parsed = new Date(fecha);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function calcularEdad(): number | null {
    if (!formData.fechaNacimiento) return null;
    const hoy = new Date();
    const nacimiento = new Date(formData.fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  }

  function formatearFechaNacimiento(): string {
    if (!paciente?.fechaNacimiento) return '-';
    const fecha = convertirFecha(paciente.fechaNacimiento);
    if (!fecha) return '-';
    return fecha.toLocaleDateString();
  }

  function formatearTelefono(telefono: string | undefined): string {
    if (!telefono) return '-';
    // Eliminar cualquier caracter no numérico
    const numeros = telefono.replace(/\D/g, '');
    // Formato: 998-109-0864
    if (numeros.length === 10) {
      return `${numeros.slice(0, 3)}-${numeros.slice(3, 6)}-${numeros.slice(6)}`;
    }
    // Si no tiene 10 dígitos, devolver el original
    return telefono;
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="text-center py-12">
            <p className="text-gray-600">Cargando información del paciente...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Perfil del Paciente
              </h1>
              <p className="text-gray-600 mt-1">
                {paciente ? 'Información completa del paciente' : 'Crear perfil del paciente'}
              </p>
            </div>
            {paciente && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Editar
              </button>
            )}
          </div>

          {/* Vista de solo lectura */}
          {!editing && paciente && (
            <div className="space-y-6">
              {/* Información básica */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Información Básica
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Nombre completo</dt>
                    <dd className="mt-1 text-sm text-gray-900">{paciente.nombre}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Fecha de nacimiento</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatearFechaNacimiento()}
                      {calcularEdad() && ` (${calcularEdad()} años)`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Género</dt>
                    <dd className="mt-1 text-sm text-gray-900 capitalize">{paciente.genero}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Identificación</dt>
                    <dd className="mt-1 text-sm text-gray-900">{paciente.numeroIdentificacion || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Nº de Seguro</dt>
                    <dd className="mt-1 text-sm text-gray-900">{paciente.numeroSeguro || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Grupo sanguíneo</dt>
                    <dd className="mt-1 text-sm text-gray-900">{paciente.grupoSanguineo || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Nivel de dependencia</dt>
                    <dd className="mt-1">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        paciente.nivelDependencia === 'alto' ? 'bg-red-100 text-red-800' :
                        paciente.nivelDependencia === 'medio' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {paciente.nivelDependencia?.toUpperCase()}
                      </span>
                    </dd>
                  </div>
                  {paciente.peso && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Peso</dt>
                      <dd className="mt-1 text-sm text-gray-900">{paciente.peso} kg</dd>
                    </div>
                  )}
                  {paciente.altura && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Altura</dt>
                      <dd className="mt-1 text-sm text-gray-900">{paciente.altura} cm</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Contacto */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Contacto
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Dirección</dt>
                    <dd className="mt-1 text-sm text-gray-900">{paciente.direccion || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Teléfono de emergencia</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatearTelefono(paciente.telefonoEmergencia)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Teléfono de emergencia (secundario)</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatearTelefono(paciente.telefonoEmergencia2)}</dd>
                  </div>
                </dl>
              </div>

              {/* Información médica */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Información Médica
                </h2>
                <div className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-2">Alergias</dt>
                    <dd>
                      {paciente.alergias && paciente.alergias.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {paciente.alergias.map((alergia, index) => (
                            <span key={index} className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full">
                              {alergia}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No hay alergias registradas</p>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-2">Condiciones médicas</dt>
                    <dd>
                      {paciente.condicionesMedicas && paciente.condicionesMedicas.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {paciente.condicionesMedicas.map((condicion, index) => (
                            <span key={index} className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full">
                              {condicion}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No hay condiciones registradas</p>
                      )}
                    </dd>
                  </div>
                  {paciente.notas && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-2">Notas adicionales</dt>
                      <dd className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{paciente.notas}</dd>
                    </div>
                  )}
                </div>
              </div>

              {/* Rangos de signos vitales */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Rangos Normales de Signos Vitales
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded p-3">
                    <p className="text-sm font-medium text-gray-700">Presión Sistólica</p>
                    <p className="text-lg text-blue-600">
                      {paciente.rangoSignosVitales?.presionSistolica?.min} - {paciente.rangoSignosVitales?.presionSistolica?.max} mmHg
                    </p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-sm font-medium text-gray-700">Presión Diastólica</p>
                    <p className="text-lg text-blue-600">
                      {paciente.rangoSignosVitales?.presionDiastolica?.min} - {paciente.rangoSignosVitales?.presionDiastolica?.max} mmHg
                    </p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-sm font-medium text-gray-700">Frecuencia Cardíaca</p>
                    <p className="text-lg text-blue-600">
                      {paciente.rangoSignosVitales?.frecuenciaCardiaca?.min} - {paciente.rangoSignosVitales?.frecuenciaCardiaca?.max} bpm
                    </p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-sm font-medium text-gray-700">Temperatura</p>
                    <p className="text-lg text-blue-600">
                      {paciente.rangoSignosVitales?.temperatura?.min} - {paciente.rangoSignosVitales?.temperatura?.max} °C
                    </p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-sm font-medium text-gray-700">Saturación O2</p>
                    <p className="text-lg text-blue-600">
                      {paciente.rangoSignosVitales?.saturacionO2?.min} - {paciente.rangoSignosVitales?.saturacionO2?.max} %
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Formulario de edición */}
          {editing && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Información básica */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Información Básica
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de nacimiento *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.fechaNacimiento}
                      onChange={(e) => setFormData({ ...formData, fechaNacimiento: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {calcularEdad() !== null && (
                      <p className="text-xs text-gray-500 mt-1">
                        Edad: {calcularEdad()} años
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Género *
                    </label>
                    <select
                      value={formData.genero}
                      onChange={(e) => setFormData({ ...formData, genero: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="masculino">Masculino</option>
                      <option value="femenino">Femenino</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de identificación
                    </label>
                    <input
                      type="text"
                      value={formData.numeroIdentificacion}
                      onChange={(e) => setFormData({ ...formData, numeroIdentificacion: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nº de Seguro
                    </label>
                    <input
                      type="text"
                      value={formData.numeroSeguro}
                      onChange={(e) => setFormData({ ...formData, numeroSeguro: e.target.value })}
                      placeholder="Número de póliza o seguro médico"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Grupo sanguíneo
                    </label>
                    <input
                      type="text"
                      value={formData.grupoSanguineo}
                      onChange={(e) => setFormData({ ...formData, grupoSanguineo: e.target.value })}
                      placeholder="Ej: O+, A-, AB+"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nivel de dependencia *
                    </label>
                    <select
                      value={formData.nivelDependencia}
                      onChange={(e) => setFormData({ ...formData, nivelDependencia: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="bajo">Bajo</option>
                      <option value="medio">Medio</option>
                      <option value="alto">Alto</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Peso (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.peso}
                      onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Altura (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.altura}
                      onChange={(e) => setFormData({ ...formData, altura: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Contacto
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dirección
                    </label>
                    <input
                      type="text"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono de emergencia
                    </label>
                    <input
                      type="tel"
                      value={formData.telefonoEmergencia}
                      onChange={(e) => setFormData({ ...formData, telefonoEmergencia: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono de emergencia (secundario)
                    </label>
                    <input
                      type="tel"
                      value={formData.telefonoEmergencia2}
                      onChange={(e) => setFormData({ ...formData, telefonoEmergencia2: e.target.value })}
                      placeholder="Teléfono alternativo para emergencias"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Información médica */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Información Médica
                </h2>
                <div className="space-y-4">
                  {/* Alergias */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alergias
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={nuevaAlergia}
                        onChange={(e) => setNuevaAlergia(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), agregarAlergia())}
                        placeholder="Agregar alergia"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={agregarAlergia}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        Agregar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.alergias.map((alergia, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full flex items-center gap-2"
                        >
                          {alergia}
                          <button
                            type="button"
                            onClick={() => eliminarAlergia(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Condiciones médicas */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Condiciones médicas
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={nuevaCondicion}
                        onChange={(e) => setNuevaCondicion(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), agregarCondicion())}
                        placeholder="Agregar condición"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={agregarCondicion}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        Agregar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.condicionesMedicas.map((condicion, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full flex items-center gap-2"
                        >
                          {condicion}
                          <button
                            type="button"
                            onClick={() => eliminarCondicion(index)}
                            className="text-orange-600 hover:text-orange-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Notas */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notas adicionales
                    </label>
                    <textarea
                      value={formData.notas}
                      onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Rangos de signos vitales */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Rangos Normales de Signos Vitales
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Presión Sistólica */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Presión Sistólica (mmHg)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Mín"
                        value={formData.rangoPresionSistolica.min}
                        onChange={(e) => setFormData({
                          ...formData,
                          rangoPresionSistolica: { ...formData.rangoPresionSistolica, min: parseInt(e.target.value) || 0 }
                        })}
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Máx"
                        value={formData.rangoPresionSistolica.max}
                        onChange={(e) => setFormData({
                          ...formData,
                          rangoPresionSistolica: { ...formData.rangoPresionSistolica, max: parseInt(e.target.value) || 0 }
                        })}
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Presión Diastólica */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Presión Diastólica (mmHg)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Mín"
                        value={formData.rangoPresionDiastolica.min}
                        onChange={(e) => setFormData({
                          ...formData,
                          rangoPresionDiastolica: { ...formData.rangoPresionDiastolica, min: parseInt(e.target.value) || 0 }
                        })}
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Máx"
                        value={formData.rangoPresionDiastolica.max}
                        onChange={(e) => setFormData({
                          ...formData,
                          rangoPresionDiastolica: { ...formData.rangoPresionDiastolica, max: parseInt(e.target.value) || 0 }
                        })}
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Frecuencia Cardíaca */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frecuencia Cardíaca (bpm)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Mín"
                        value={formData.rangoFrecuenciaCardiaca.min}
                        onChange={(e) => setFormData({
                          ...formData,
                          rangoFrecuenciaCardiaca: { ...formData.rangoFrecuenciaCardiaca, min: parseInt(e.target.value) || 0 }
                        })}
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Máx"
                        value={formData.rangoFrecuenciaCardiaca.max}
                        onChange={(e) => setFormData({
                          ...formData,
                          rangoFrecuenciaCardiaca: { ...formData.rangoFrecuenciaCardiaca, max: parseInt(e.target.value) || 0 }
                        })}
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Temperatura */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Temperatura (°C)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Mín"
                        value={formData.rangoTemperatura.min}
                        onChange={(e) => setFormData({
                          ...formData,
                          rangoTemperatura: { ...formData.rangoTemperatura, min: parseFloat(e.target.value) || 0 }
                        })}
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Máx"
                        value={formData.rangoTemperatura.max}
                        onChange={(e) => setFormData({
                          ...formData,
                          rangoTemperatura: { ...formData.rangoTemperatura, max: parseFloat(e.target.value) || 0 }
                        })}
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Saturación O2 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Saturación O2 (%)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Mín"
                        value={formData.rangoSaturacionO2.min}
                        onChange={(e) => setFormData({
                          ...formData,
                          rangoSaturacionO2: { ...formData.rangoSaturacionO2, min: parseInt(e.target.value) || 0 }
                        })}
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Máx"
                        value={formData.rangoSaturacionO2.max}
                        onChange={(e) => setFormData({
                          ...formData,
                          rangoSaturacionO2: { ...formData.rangoSaturacionO2, max: parseInt(e.target.value) || 0 }
                        })}
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                {paciente && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      cargarPaciente();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
