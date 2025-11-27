import { useState, useEffect, useRef } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Medicamento } from '../types';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

const PACIENTE_ID = 'paciente-principal';

export default function Medicamentos() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [medicamentoEditando, setMedicamentoEditando] = useState<Medicamento | null>(null);

  // Estado del formulario
  const [nombre, setNombre] = useState('');
  const [dosis, setDosis] = useState('');
  const [presentacion, setPresentacion] = useState('tableta');
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const [horarios, setHorarios] = useState<string[]>(['']);
  const [instrucciones, setInstrucciones] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoURL, setFotoURL] = useState('');

  // Hook para detectar cambios sin guardar
  const { isDirty, setIsDirty, markAsSaved, confirmNavigation } = useUnsavedChanges();
  const isInitialLoad = useRef(true);

  useEffect(() => {
    cargarMedicamentos();
  }, []);

  // Detectar cambios en el formulario cuando está visible
  useEffect(() => {
    if (mostrarFormulario && !isInitialLoad.current) {
      setIsDirty(true);
    }
  }, [nombre, dosis, presentacion, diasSemana, horarios, instrucciones, fotoFile, mostrarFormulario]);

  // Resetear el flag cuando se abre/cierra el formulario
  useEffect(() => {
    if (mostrarFormulario) {
      // Pequeño delay para permitir que los estados se inicialicen
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 100);
    } else {
      isInitialLoad.current = true;
      setIsDirty(false);
    }
  }, [mostrarFormulario]);

  async function cargarMedicamentos() {
    try {
      setLoading(true);
      // Consulta simple sin índice compuesto - ordenamos en el cliente
      const querySnapshot = await getDocs(
        collection(db, 'pacientes', PACIENTE_ID, 'medicamentos')
      );
      const meds: Medicamento[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        meds.push({
          id: docSnap.id,
          ...data,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Medicamento);
      });

      // Ordenar en el cliente: activos primero, luego por nombre
      meds.sort((a, b) => {
        if (a.activo !== b.activo) return a.activo ? -1 : 1;
        return a.nombre.localeCompare(b.nombre);
      });

      setMedicamentos(meds);
    } catch (error) {
      console.error('Error cargando medicamentos:', error);
      alert('Error al cargar medicamentos');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!nombre || !dosis || horarios.filter((h) => h).length === 0) {
      alert('Por favor completa los campos obligatorios: nombre, dosis y al menos un horario');
      return;
    }

    try {
      setLoading(true);

      let fotoURLFinal = fotoURL;

      // Subir foto si hay una nueva
      if (fotoFile) {
        const storageRef = ref(storage, `medicamentos/${Date.now()}_${fotoFile.name}`);
        await uploadBytes(storageRef, fotoFile);
        fotoURLFinal = await getDownloadURL(storageRef);
      }

      // Filtrar horarios vacíos
      const horariosLimpios = horarios.filter((h) => h !== '');

      const medicamentoData: Record<string, unknown> = {
        pacienteId: PACIENTE_ID,
        nombre,
        dosis,
        presentacion,
        frecuencia: {
          tipo: 'dias_especificos',
          diasSemana,
        },
        horarios: horariosLimpios,
        activo: true,
        actualizadoEn: new Date(),
      };

      // Solo agregar campos opcionales si tienen valor
      if (instrucciones) {
        medicamentoData.instrucciones = instrucciones;
      }
      if (fotoURLFinal) {
        medicamentoData.foto = fotoURLFinal;
      }

      if (medicamentoEditando) {
        // Actualizar
        const medicamentoRef = doc(
          db,
          'pacientes',
          PACIENTE_ID,
          'medicamentos',
          medicamentoEditando.id
        );
        await updateDoc(medicamentoRef, medicamentoData);
        markAsSaved();
        alert('Medicamento actualizado exitosamente');
      } else {
        // Crear nuevo medicamento
        const medicamentoRef = await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'medicamentos'), {
          ...medicamentoData,
          creadoEn: new Date(),
        });

        // Crear item de inventario vinculado automáticamente
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'inventario'), {
          pacienteId: PACIENTE_ID,
          nombre: `${nombre} ${dosis}`,
          categoria: 'medicamento',
          cantidadMaestro: 0,
          cantidadOperativo: 0,
          presentacion: presentacion,
          unidad: 'piezas',
          nivelMinimoMaestro: 5,
          nivelMinimoOperativo: 5,
          vinculadoPastillero: true,
          medicamentoId: medicamentoRef.id,
          creadoEn: new Date(),
          actualizadoEn: new Date(),
        });

        markAsSaved();
        alert('Medicamento creado exitosamente');
      }

      limpiarFormulario();
      setMostrarFormulario(false);
      cargarMedicamentos();
    } catch (error) {
      console.error('Error guardando medicamento:', error);
      alert('Error al guardar el medicamento');
    } finally {
      setLoading(false);
    }
  }

  async function desactivarMedicamento(medicamentoId: string) {
    if (!confirm('¿Desactivar este medicamento? No se eliminará del registro.')) {
      return;
    }

    try {
      setLoading(true);
      const medicamentoRef = doc(db, 'pacientes', PACIENTE_ID, 'medicamentos', medicamentoId);
      await updateDoc(medicamentoRef, {
        activo: false,
        actualizadoEn: new Date(),
      });
      alert('Medicamento desactivado');
      cargarMedicamentos();
    } catch (error) {
      console.error('Error desactivando medicamento:', error);
      alert('Error al desactivar medicamento');
    } finally {
      setLoading(false);
    }
  }

  async function activarMedicamento(medicamentoId: string) {
    try {
      setLoading(true);
      const medicamentoRef = doc(db, 'pacientes', PACIENTE_ID, 'medicamentos', medicamentoId);
      await updateDoc(medicamentoRef, {
        activo: true,
        actualizadoEn: new Date(),
      });
      alert('Medicamento activado');
      cargarMedicamentos();
    } catch (error) {
      console.error('Error activando medicamento:', error);
      alert('Error al activar medicamento');
    } finally {
      setLoading(false);
    }
  }

  function editarMedicamento(med: Medicamento) {
    setMedicamentoEditando(med);
    setNombre(med.nombre);
    setDosis(med.dosis);
    setPresentacion(med.presentacion);
    setDiasSemana(med.frecuencia.diasSemana || []);
    setHorarios(med.horarios.length > 0 ? med.horarios : ['']);
    setInstrucciones(med.instrucciones || '');
    setFotoURL(med.foto || '');
    setFotoFile(null);
    setMostrarFormulario(true);
  }

  function limpiarFormulario() {
    setMedicamentoEditando(null);
    setNombre('');
    setDosis('');
    setPresentacion('tableta');
    setDiasSemana([]);
    setHorarios(['']);
    setInstrucciones('');
    setFotoFile(null);
    setFotoURL('');
  }

  function agregarHorario() {
    setHorarios([...horarios, '']);
  }

  function eliminarHorario(index: number) {
    setHorarios(horarios.filter((_, i) => i !== index));
  }

  function actualizarHorario(index: number, valor: string) {
    const nuevosHorarios = [...horarios];
    nuevosHorarios[index] = valor;
    setHorarios(nuevosHorarios);
  }

  function toggleDiaSemana(dia: number) {
    if (diasSemana.includes(dia)) {
      setDiasSemana(diasSemana.filter((d) => d !== dia));
    } else {
      setDiasSemana([...diasSemana, dia].sort());
    }
  }

  const diasSemanaLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pastillero Virtual</h1>
            <p className="text-gray-600 mt-1">Control de medicamentos</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Indicador de cambios sin guardar */}
            {mostrarFormulario && isDirty && (
              <span className="text-sm text-orange-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                Cambios sin guardar
              </span>
            )}
            <button
              onClick={() => {
                if (mostrarFormulario) {
                  confirmNavigation(() => {
                    limpiarFormulario();
                    setMostrarFormulario(false);
                  });
                } else {
                  limpiarFormulario();
                  setMostrarFormulario(true);
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              {mostrarFormulario ? 'Cancelar' : '+ Nuevo Medicamento'}
            </button>
          </div>
        </div>

        {/* Formulario */}
        {mostrarFormulario && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {medicamentoEditando ? 'Editar Medicamento' : 'Nuevo Medicamento'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Información Básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Medicamento *
                  </label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Losartán"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dosis *</label>
                  <input
                    type="text"
                    value={dosis}
                    onChange={(e) => setDosis(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: 50mg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Presentación
                  </label>
                  <select
                    value={presentacion}
                    onChange={(e) => setPresentacion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tableta">Tableta</option>
                    <option value="capsula">Cápsula</option>
                    <option value="jarabe">Jarabe</option>
                    <option value="suspension">Suspensión</option>
                    <option value="gotas">Gotas</option>
                    <option value="inyectable">Inyectable</option>
                    <option value="supositorio">Supositorio</option>
                    <option value="parche">Parche</option>
                    <option value="crema">Crema</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Días de la semana */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Días de la semana</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Si no seleccionas días, el medicamento aplica todos los días
                </p>
                <div className="flex gap-2 flex-wrap">
                  {diasSemanaLabels.map((dia, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => toggleDiaSemana(index)}
                      className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                        diasSemana.includes(index)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {dia}
                    </button>
                  ))}
                </div>
              </div>

              {/* Horarios */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Horarios *</h3>
                <div className="space-y-3">
                  {horarios.map((horario, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <div className="flex items-center gap-2">
                        <select
                          value={horario.split(':')[0] || ''}
                          onChange={(e) => {
                            const minutos = horario.split(':')[1] || '00';
                            actualizarHorario(index, e.target.value ? `${e.target.value}:${minutos}` : '');
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">--</option>
                          {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span className="text-gray-500 font-medium">:</span>
                        <select
                          value={horario.split(':')[1] || ''}
                          onChange={(e) => {
                            const hora = horario.split(':')[0] || '08';
                            actualizarHorario(index, `${hora}:${e.target.value}`);
                          }}
                          disabled={!horario.split(':')[0]}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 bg-white"
                        >
                          <option value="">--</option>
                          {['00', '15', '30', '45'].map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      {horarios.length > 1 && (
                        <button
                          type="button"
                          onClick={() => eliminarHorario(index)}
                          className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={agregarHorario}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    + Agregar Horario
                  </button>
                </div>
              </div>

              {/* Instrucciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instrucciones especiales
                </label>
                <textarea
                  value={instrucciones}
                  onChange={(e) => setInstrucciones(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Ej: Tomar con alimentos, no tomar con leche, etc."
                />
              </div>

              {/* Foto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foto del medicamento
                </label>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors border border-gray-300">
                    Seleccionar imagen
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {fotoFile && (
                    <span className="text-sm text-gray-600">{fotoFile.name}</span>
                  )}
                  {!fotoFile && fotoURL && (
                    <span className="text-sm text-gray-600">Imagen actual guardada</span>
                  )}
                </div>
                {(fotoURL || fotoFile) && (
                  <div className="mt-3">
                    <img
                      src={fotoFile ? URL.createObjectURL(fotoFile) : fotoURL}
                      alt="Preview"
                      className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                    />
                  </div>
                )}
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {loading ? 'Guardando...' : medicamentoEditando ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmNavigation(() => {
                      limpiarFormulario();
                      setMostrarFormulario(false);
                    });
                  }}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Medicamentos */}
        {loading && !mostrarFormulario ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Cargando medicamentos...</p>
          </div>
        ) : medicamentos.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
            <p className="text-gray-500 text-lg">No hay medicamentos registrados</p>
            <p className="text-gray-400 text-sm mt-2">
              Haz clic en "Nuevo Medicamento" para agregar uno
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {medicamentos.map((med) => (
              <div
                key={med.id}
                className={`bg-white rounded-lg border p-6 shadow-sm ${
                  med.activo ? 'border-gray-200' : 'border-gray-300 bg-gray-50 opacity-75'
                }`}
              >
                <div className="flex gap-4">
                  {/* Foto */}
                  {med.foto && (
                    <div className="flex-shrink-0">
                      <img
                        src={med.foto}
                        alt={med.nombre}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    </div>
                  )}

                  {/* Información */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{med.nombre}</h3>
                        <p className="text-gray-600">
                          {med.dosis} - {med.presentacion}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          med.activo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {med.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    {/* Días */}
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-700">Días: </span>
                      <span className="text-sm text-gray-600">
                        {!med.frecuencia.diasSemana || med.frecuencia.diasSemana.length === 0
                          ? 'Todos los días'
                          : med.frecuencia.diasSemana.map((d) => diasSemanaLabels[d]).join(', ')}
                      </span>
                    </div>

                    {/* Horarios */}
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-700">Horarios: </span>
                      <span className="text-sm text-gray-600">{med.horarios.join(', ')}</span>
                    </div>

                    {/* Instrucciones */}
                    {med.instrucciones && (
                      <div className="mb-3">
                        <span className="text-sm font-medium text-gray-700">Instrucciones: </span>
                        <span className="text-sm text-gray-600">{med.instrucciones}</span>
                      </div>
                    )}

                    {/* Botones */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => editarMedicamento(med)}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Editar
                      </button>
                      {med.activo ? (
                        <button
                          onClick={() => desactivarMedicamento(med.id)}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          onClick={() => activarMedicamento(med.id)}
                          className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
