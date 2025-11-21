import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Medicamento, RegistroMedicamento, EstadoMedicamento } from '../types';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';

const PACIENTE_ID = 'paciente-principal';

interface DosisDelDia {
  medicamento: Medicamento;
  horario: string;
  registro?: RegistroMedicamento;
  retrasoMinutos?: number;
}

export default function PastilleroDiario() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dosisDelDia, setDosisDelDia] = useState<DosisDelDia[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [dosisSeleccionada, setDosisSeleccionada] = useState<DosisDelDia | null>(null);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<EstadoMedicamento>('tomado');
  const [notas, setNotas] = useState('');
  const [vistaActual, setVistaActual] = useState<'hoy' | 'historial'>('hoy');
  const [historialRegistros, setHistorialRegistros] = useState<RegistroMedicamento[]>([]);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [filtroMedicamento, setFiltroMedicamento] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  useEffect(() => {
    cargarDosisDelDia();
  }, []);

  async function cargarDosisDelDia() {
    try {
      setLoading(true);

      // Obtener medicamentos activos
      const qMeds = query(
        collection(db, 'pacientes', PACIENTE_ID, 'medicamentos'),
        where('activo', '==', true)
      );
      const medSnapshot = await getDocs(qMeds);
      const medicamentosActivos: Medicamento[] = [];

      medSnapshot.forEach((doc) => {
        const data = doc.data();
        medicamentosActivos.push({
          id: doc.id,
          ...data,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Medicamento);
      });

      setMedicamentos(medicamentosActivos);

      // Obtener registros del día
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      const qRegs = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', hoy),
        where('fechaHoraProgramada', '<', manana)
      );
      const regSnapshot = await getDocs(qRegs);
      const registrosMap = new Map<string, RegistroMedicamento>();

      regSnapshot.forEach((doc) => {
        const data = doc.data();
        const registro: RegistroMedicamento = {
          id: doc.id,
          ...data,
          fechaHoraProgramada: data.fechaHoraProgramada?.toDate() || new Date(),
          fechaHoraReal: data.fechaHoraReal?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
        } as RegistroMedicamento;
        const key = `${registro.medicamentoId}-${data.horario}`;
        registrosMap.set(key, registro);
      });

      // Generar dosis del día
      const dosis: DosisDelDia[] = [];
      const ahora = new Date();

      for (const med of medicamentosActivos) {
        // Verificar si hoy es un día válido para este medicamento
        const diaHoy = hoy.getDay();
        if (
          med.frecuencia.tipo === 'dias_especificos' &&
          !med.frecuencia.diasSemana?.includes(diaHoy)
        ) {
          continue;
        }

        for (const horario of med.horarios) {
          const [hora, minuto] = horario.split(':').map(Number);
          const fechaHoraProgramada = new Date(hoy);
          fechaHoraProgramada.setHours(hora, minuto, 0, 0);

          const key = `${med.id}-${horario}`;
          const registro = registrosMap.get(key);

          // Calcular retraso si es necesario
          let retrasoMinutos: number | undefined;
          if (!registro && ahora > fechaHoraProgramada) {
            retrasoMinutos = Math.floor((ahora.getTime() - fechaHoraProgramada.getTime()) / 60000);
          }

          dosis.push({
            medicamento: med,
            horario,
            registro,
            retrasoMinutos,
          });
        }
      }

      // Ordenar por horario
      dosis.sort((a, b) => a.horario.localeCompare(b.horario));
      setDosisDelDia(dosis);
    } catch (error) {
      console.error('Error cargando dosis del día:', error);
      alert('Error al cargar medicamentos del día');
    } finally {
      setLoading(false);
    }
  }

  async function cargarHistorial() {
    try {
      setLoading(true);

      // Obtener registros de los últimos 30 días
      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);
      hace30Dias.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', hace30Dias),
        orderBy('fechaHoraProgramada', 'desc')
      );

      const snapshot = await getDocs(q);
      const registros: RegistroMedicamento[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        registros.push({
          id: doc.id,
          ...data,
          fechaHoraProgramada: data.fechaHoraProgramada?.toDate() || new Date(),
          fechaHoraReal: data.fechaHoraReal?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
        } as RegistroMedicamento);
      });

      setHistorialRegistros(registros);
    } catch (error) {
      console.error('Error cargando historial:', error);
      alert('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }

  async function abrirModal(dosis: DosisDelDia) {
    setDosisSeleccionada(dosis);
    setEstadoSeleccionado('tomado');
    setNotas('');
    setModalAbierto(true);
  }

  async function registrarAdministracion() {
    if (!dosisSeleccionada || !usuario) return;

    try {
      setLoading(true);

      const ahora = new Date();
      const [hora, minuto] = dosisSeleccionada.horario.split(':').map(Number);
      const fechaHoraProgramada = new Date();
      fechaHoraProgramada.setHours(hora, minuto, 0, 0);

      // Calcular retraso
      let retrasoMinutos: number | undefined;
      if (estadoSeleccionado === 'tomado') {
        retrasoMinutos = Math.floor((ahora.getTime() - fechaHoraProgramada.getTime()) / 60000);
      }

      const registroData = {
        pacienteId: PACIENTE_ID,
        medicamentoId: dosisSeleccionada.medicamento.id,
        medicamentoNombre: dosisSeleccionada.medicamento.nombre,
        fechaHoraProgramada,
        fechaHoraReal: estadoSeleccionado === 'tomado' ? ahora : undefined,
        estado: estadoSeleccionado,
        retrasoMinutos,
        notas: notas || undefined,
        administradoPor: usuario.uid,
        horario: dosisSeleccionada.horario,
        creadoEn: ahora,
      };

      if (dosisSeleccionada.registro) {
        // Actualizar registro existente
        const regRef = doc(
          db,
          'pacientes',
          PACIENTE_ID,
          'registroMedicamentos',
          dosisSeleccionada.registro.id
        );
        await updateDoc(regRef, {
          ...registroData,
          actualizadoEn: ahora,
        });
      } else {
        // Crear nuevo registro
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'), registroData);
      }

      alert('Administración registrada exitosamente');
      setModalAbierto(false);
      setDosisSeleccionada(null);
      setNotas('');
      cargarDosisDelDia();
    } catch (error) {
      console.error('Error registrando administración:', error);
      alert('Error al registrar administración');
    } finally {
      setLoading(false);
    }
  }

  function getEstadoColor(estado?: EstadoMedicamento) {
    if (!estado) return 'bg-gray-100 text-gray-800';
    switch (estado) {
      case 'tomado':
        return 'bg-green-100 text-green-800';
      case 'rechazado':
        return 'bg-red-100 text-red-800';
      case 'omitido':
        return 'bg-yellow-100 text-yellow-800';
      case 'pendiente':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getEstadoLabel(estado?: EstadoMedicamento) {
    if (!estado) return 'Pendiente';
    switch (estado) {
      case 'tomado':
        return 'Tomado';
      case 'rechazado':
        return 'Rechazado';
      case 'omitido':
        return 'Omitido';
      case 'pendiente':
        return 'Pendiente';
      default:
        return estado;
    }
  }

  function renderVistaDia() {
    return (
      <div className="space-y-4">
        {dosisDelDia.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
            <p className="text-gray-500 text-lg">No hay medicamentos programados para hoy</p>
          </div>
        ) : (
          dosisDelDia.map((dosis, index) => {
            const estado = dosis.registro?.estado || 'pendiente';
            const tieneRetraso = dosis.retrasoMinutos && dosis.retrasoMinutos > 30;

            return (
              <div
                key={index}
                className={`bg-white rounded-lg border p-6 shadow-sm ${
                  tieneRetraso ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                }`}
              >
                <div className="flex gap-4">
                  {/* Foto */}
                  {dosis.medicamento.foto && (
                    <div className="flex-shrink-0">
                      <img
                        src={dosis.medicamento.foto}
                        alt={dosis.medicamento.nombre}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    </div>
                  )}

                  {/* Información */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {dosis.medicamento.nombre}
                        </h3>
                        <p className="text-gray-600">
                          {dosis.medicamento.dosis} - {dosis.medicamento.presentacion}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEstadoColor(estado)}`}>
                        {getEstadoLabel(estado)}
                      </span>
                    </div>

                    {/* Horario */}
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-2xl font-bold text-blue-600">{dosis.horario}</span>
                      {tieneRetraso && (
                        <span className="px-2 py-1 bg-yellow-200 text-yellow-800 text-xs font-medium rounded">
                          Retraso: {dosis.retrasoMinutos} min
                        </span>
                      )}
                    </div>

                    {/* Instrucciones */}
                    {dosis.medicamento.instrucciones && (
                      <div className="mb-3">
                        <span className="text-sm font-medium text-gray-700">Instrucciones: </span>
                        <span className="text-sm text-gray-600">{dosis.medicamento.instrucciones}</span>
                      </div>
                    )}

                    {/* Información del registro */}
                    {dosis.registro && (
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                        {dosis.registro.fechaHoraReal && (
                          <p className="text-sm text-gray-600">
                            <strong>Hora real:</strong>{' '}
                            {dosis.registro.fechaHoraReal.toLocaleTimeString('es-MX', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                        {dosis.registro.retrasoMinutos !== undefined && dosis.registro.retrasoMinutos > 0 && (
                          <p className="text-sm text-gray-600">
                            <strong>Retraso:</strong> {dosis.registro.retrasoMinutos} minutos
                          </p>
                        )}
                        {dosis.registro.notas && (
                          <p className="text-sm text-gray-600">
                            <strong>Notas:</strong> {dosis.registro.notas}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Botones */}
                    {!dosis.registro && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => abrirModal(dosis)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Registrar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  function renderHistorial() {
    const registrosFiltrados = historialRegistros.filter((reg) => {
      if (filtroMedicamento !== 'todos' && reg.medicamentoId !== filtroMedicamento) return false;
      if (filtroEstado !== 'todos' && reg.estado !== filtroEstado) return false;
      return true;
    });

    return (
      <div className="space-y-6">
        {/* Filtros */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medicamento:</label>
              <select
                value={filtroMedicamento}
                onChange={(e) => setFiltroMedicamento(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos</option>
                {medicamentos.map((med) => (
                  <option key={med.id} value={med.id}>
                    {med.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado:</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos</option>
                <option value="tomado">Tomado</option>
                <option value="rechazado">Rechazado</option>
                <option value="omitido">Omitido</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista */}
        {registrosFiltrados.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
            <p className="text-gray-500 text-lg">No hay registros en el historial</p>
          </div>
        ) : (
          <div className="space-y-4">
            {registrosFiltrados.map((reg) => (
              <div key={reg.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900">{reg.medicamentoNombre}</h4>
                    <p className="text-sm text-gray-600">
                      <strong>Programado:</strong>{' '}
                      {reg.fechaHoraProgramada.toLocaleString('es-MX', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {reg.fechaHoraReal && (
                      <p className="text-sm text-gray-600">
                        <strong>Real:</strong>{' '}
                        {reg.fechaHoraReal.toLocaleString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                    {reg.retrasoMinutos !== undefined && reg.retrasoMinutos > 0 && (
                      <p className="text-sm text-gray-600">
                        <strong>Retraso:</strong> {reg.retrasoMinutos} minutos
                      </p>
                    )}
                    {reg.notas && (
                      <p className="text-sm text-gray-600">
                        <strong>Notas:</strong> {reg.notas}
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEstadoColor(reg.estado)}`}>
                    {getEstadoLabel(reg.estado)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pastillero Diario</h1>
            <p className="text-gray-600 mt-1">Control de administración de medicamentos</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setVistaActual('hoy');
                cargarDosisDelDia();
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                vistaActual === 'hoy'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => {
                setVistaActual('historial');
                cargarHistorial();
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                vistaActual === 'historial'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Historial
            </button>
          </div>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Cargando...</p>
          </div>
        ) : vistaActual === 'hoy' ? (
          renderVistaDia()
        ) : (
          renderHistorial()
        )}

        {/* Modal de Registro */}
        {modalAbierto && dosisSeleccionada && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Registrar Administración</h2>

              <div className="mb-4">
                <p className="text-lg font-semibold text-gray-900">
                  {dosisSeleccionada.medicamento.nombre}
                </p>
                <p className="text-gray-600">
                  {dosisSeleccionada.medicamento.dosis} - {dosisSeleccionada.horario}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado *</label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setEstadoSeleccionado('tomado')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      estadoSeleccionado === 'tomado'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Tomado
                  </button>
                  <button
                    onClick={() => setEstadoSeleccionado('rechazado')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      estadoSeleccionado === 'rechazado'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Rechazado
                  </button>
                  <button
                    onClick={() => setEstadoSeleccionado('omitido')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      estadoSeleccionado === 'omitido'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Omitido
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Observaciones o motivo..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={registrarAdministracion}
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => {
                    setModalAbierto(false);
                    setDosisSeleccionada(null);
                  }}
                  disabled={loading}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
