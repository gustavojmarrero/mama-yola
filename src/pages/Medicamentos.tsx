import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Medicamento, FrecuenciaTipo } from '../types';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';

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
  const [frecuenciaTipo, setFrecuenciaTipo] = useState<FrecuenciaTipo>('horas');
  const [frecuenciaValor, setFrecuenciaValor] = useState(8);
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const [horarios, setHorarios] = useState<string[]>(['']);
  const [instrucciones, setInstrucciones] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoURL, setFotoURL] = useState('');

  useEffect(() => {
    cargarMedicamentos();
  }, []);

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

      const medicamentoData = {
        pacienteId: PACIENTE_ID,
        nombre,
        dosis,
        presentacion,
        frecuencia: {
          tipo: frecuenciaTipo,
          valor: frecuenciaValor,
          ...(frecuenciaTipo === 'dias_especificos' && { diasSemana }),
        },
        horarios: horariosLimpios,
        instrucciones: instrucciones || undefined,
        foto: fotoURLFinal || undefined,
        activo: true,
        actualizadoEn: new Date(),
      };

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
        alert('Medicamento actualizado exitosamente');
      } else {
        // Crear nuevo
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'medicamentos'), {
          ...medicamentoData,
          creadoEn: new Date(),
        });
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
    setFrecuenciaTipo(med.frecuencia.tipo);
    setFrecuenciaValor(med.frecuencia.valor);
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
    setFrecuenciaTipo('horas');
    setFrecuenciaValor(8);
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
          <button
            onClick={() => {
              limpiarFormulario();
              setMostrarFormulario(!mostrarFormulario);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            {mostrarFormulario ? 'Cancelar' : '+ Nuevo Medicamento'}
          </button>
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

              {/* Frecuencia */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Frecuencia</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Frecuencia
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="horas"
                          checked={frecuenciaTipo === 'horas'}
                          onChange={(e) => setFrecuenciaTipo(e.target.value as FrecuenciaTipo)}
                          className="mr-2"
                        />
                        Cada X horas
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="dias_especificos"
                          checked={frecuenciaTipo === 'dias_especificos'}
                          onChange={(e) => setFrecuenciaTipo(e.target.value as FrecuenciaTipo)}
                          className="mr-2"
                        />
                        Días específicos
                      </label>
                    </div>
                  </div>

                  {frecuenciaTipo === 'horas' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cada cuántas horas
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={frecuenciaValor}
                        onChange={(e) => setFrecuenciaValor(parseInt(e.target.value))}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-600">horas</span>
                    </div>
                  )}

                  {frecuenciaTipo === 'dias_especificos' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Días de la semana
                      </label>
                      <div className="flex gap-2">
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
                  )}
                </div>
              </div>

              {/* Horarios */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Horarios *</h3>
                <div className="space-y-2">
                  {horarios.map((horario, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="time"
                        value={horario}
                        onChange={(e) => actualizarHorario(index, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Foto del medicamento
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {(fotoURL || fotoFile) && (
                  <div className="mt-2">
                    <img
                      src={fotoFile ? URL.createObjectURL(fotoFile) : fotoURL}
                      alt="Preview"
                      className="w-32 h-32 object-cover rounded-lg"
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
                    limpiarFormulario();
                    setMostrarFormulario(false);
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

                    {/* Frecuencia */}
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-700">Frecuencia: </span>
                      <span className="text-sm text-gray-600">
                        {med.frecuencia.tipo === 'horas'
                          ? `Cada ${med.frecuencia.valor} horas`
                          : `Días: ${med.frecuencia.diasSemana
                              ?.map((d) => diasSemanaLabels[d])
                              .join(', ')}`}
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
