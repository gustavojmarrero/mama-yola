import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import {
  InstanciaActividadCard,
  ProgramarActividadModal,
  CompletarSlotModal,
  EditarProgramacionModal,
} from '../components/actividades';
import {
  InstanciaActividad,
  ProgramacionActividad,
} from '../types/actividades';
import { getProgramacionesActivas } from '../services/programacionActividades';
import {
  getInstanciasPorFecha,
  getInstanciasPorRango,
  generarInstanciasParaFecha,
} from '../services/instanciasActividades';
import { ConfiguracionHorarios } from '../types';
import { CONFIG_HORARIOS_DEFAULT } from '../utils/procesosDelDia';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';

const PACIENTE_ID = 'paciente-principal';

export default function ActividadesV2() {
  const { userProfile } = useAuth();

  // Estados principales
  const [programaciones, setProgramaciones] = useState<ProgramacionActividad[]>([]);
  const [instancias, setInstancias] = useState<InstanciaActividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [configHorarios, setConfigHorarios] = useState<ConfiguracionHorarios | null>(null);

  // Navegación
  const [fechaActual, setFechaActual] = useState(new Date());
  const [vista, setVista] = useState<'dia' | 'semana'>('dia');

  // Modales
  const [modalProgramar, setModalProgramar] = useState(false);
  const [modalSlot, setModalSlot] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [instanciaSeleccionada, setInstanciaSeleccionada] = useState<InstanciaActividad | null>(null);
  const [programacionSeleccionada, setProgramacionSeleccionada] = useState<ProgramacionActividad | null>(null);


  // Permisos
  const puedeProgramar = userProfile?.rol === 'familiar' || userProfile?.rol === 'supervisor';
  // Todos los roles pueden registrar actividades
  const puedeCompletar = userProfile?.rol === 'cuidador' || userProfile?.rol === 'familiar' || userProfile?.rol === 'supervisor';
  // Solo familiares y supervisores pueden editar programaciones
  const puedeEditar = userProfile?.rol === 'familiar' || userProfile?.rol === 'supervisor';

  // Cargar configuración de horarios
  useEffect(() => {
    async function cargarConfig() {
      try {
        const configDoc = await getDoc(doc(db, 'pacientes', PACIENTE_ID, 'configuracion', 'horarios'));
        if (configDoc.exists()) {
          setConfigHorarios(configDoc.data() as ConfiguracionHorarios);
        } else {
          setConfigHorarios(CONFIG_HORARIOS_DEFAULT);
        }
      } catch (error) {
        console.error('Error cargando config:', error);
        setConfigHorarios(CONFIG_HORARIOS_DEFAULT);
      }
    }
    cargarConfig();
  }, []);

  // Cargar programaciones
  useEffect(() => {
    async function cargar() {
      try {
        const progs = await getProgramacionesActivas();
        setProgramaciones(progs);
      } catch (error) {
        console.error('Error cargando programaciones:', error);
      }
    }
    cargar();
  }, []);

  // Cargar instancias cuando cambia la fecha o programaciones
  useEffect(() => {
    // Solo cargar si hay programaciones (evita doble ejecución inicial)
    if (programaciones.length === 0) {
      setLoading(false);
      return;
    }

    async function cargarInstancias() {
      setLoading(true);
      try {
        if (vista === 'dia') {
          // Generar instancias faltantes y cargar en una sola operación
          await generarInstanciasParaFecha(fechaActual, programaciones);
          const insts = await getInstanciasPorFecha(fechaActual);
          setInstancias(insts);
        } else {
          const inicio = startOfWeek(fechaActual, { weekStartsOn: 1 });
          const fin = endOfWeek(fechaActual, { weekStartsOn: 1 });

          // Generar para cada día de la semana en paralelo
          const dias = [];
          for (let d = inicio; d <= fin; d = addDays(d, 1)) {
            dias.push(d);
          }
          await Promise.all(
            dias.map((d) => generarInstanciasParaFecha(d, programaciones))
          );

          const insts = await getInstanciasPorRango(inicio, fin);
          setInstancias(insts);
        }
      } catch (error) {
        console.error('Error cargando instancias:', error);
      } finally {
        setLoading(false);
      }
    }

    cargarInstancias();
  }, [fechaActual, vista, programaciones]);

  // Instancias del día seleccionado
  const instanciasDelDia = (fecha: Date) => {
    return instancias.filter((i) => isSameDay(new Date(i.fecha), fecha));
  };

  // Agrupar actividades: definidas (info) vs slots (interactivos)
  const agruparPorModalidad = (insts: InstanciaActividad[]) => {
    const definidas = insts.filter((i) => i.modalidad === 'definida');
    const slots = insts.filter((i) => i.modalidad === 'slot_abierto');
    const slotsCompletados = slots.filter((s) => s.estado === 'completada');
    const slotsPendientes = slots.filter((s) => s.estado === 'pendiente');
    return { definidas, slots, slotsCompletados, slotsPendientes };
  };

  // Manejar click en instancia - SOLO para slots abiertos
  const handleInstanciaClick = (instancia: InstanciaActividad) => {
    // Solo los slots son interactivos, las actividades definidas son solo informativas
    if (instancia.modalidad !== 'slot_abierto') return;
    if (instancia.estado !== 'pendiente') return;

    setInstanciaSeleccionada(instancia);
    setModalSlot(true);
  };

  // Manejar edición de programación desde una instancia
  const handleEditarInstancia = (instancia: InstanciaActividad) => {
    // Buscar la programación asociada a esta instancia
    const programacion = programaciones.find(p => p.id === instancia.programacionId);
    if (programacion) {
      setProgramacionSeleccionada(programacion);
      setModalEditar(true);
    }
  };

  // Refrescar después de completar
  const handleSuccess = async () => {
    // Recargar programaciones y las instancias se actualizarán por el listener
    const progs = await getProgramacionesActivas();
    setProgramaciones(progs);
  };

  // Navegación
  const navegarDia = (direccion: number) => {
    setFechaActual(addDays(fechaActual, direccion));
  };

  const navegarSemana = (direccion: number) => {
    setFechaActual(direccion > 0 ? addWeeks(fechaActual, 1) : subWeeks(fechaActual, 1));
  };

  const irAHoy = () => {
    setFechaActual(new Date());
  };

  const esHoy = isSameDay(fechaActual, new Date());
  const inicioSemana = startOfWeek(fechaActual, { weekStartsOn: 1 });
  const finSemana = endOfWeek(fechaActual, { weekStartsOn: 1 });
  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i));

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Actividades Programadas
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {puedeProgramar
                ? 'Programa actividades para el cuidado diario'
                : 'Completa las actividades programadas'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle vista */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setVista('dia')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  vista === 'dia'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Día
              </button>
              <button
                onClick={() => setVista('semana')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  vista === 'semana'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Semana
              </button>
            </div>

            {/* Botón programar (solo familiar/supervisor) */}
            {puedeProgramar && (
              <button
                onClick={() => setModalProgramar(true)}
                className="px-4 py-2 bg-lavender-600 text-white rounded-lg font-medium hover:bg-lavender-700 transition-colors flex items-center gap-2"
              >
                <span>+</span>
                <span className="hidden sm:inline">Programar</span>
              </button>
            )}
          </div>
        </div>

        {/* Navegación de fecha */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => (vista === 'dia' ? navegarDia(-1) : navegarSemana(-1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="text-center">
              {vista === 'dia' ? (
                <h2 className="text-lg font-semibold text-gray-800">
                  {format(fechaActual, "EEEE d 'de' MMMM", { locale: es })}
                </h2>
              ) : (
                <h2 className="text-lg font-semibold text-gray-800">
                  {format(inicioSemana, "d", { locale: es })} - {format(finSemana, "d 'de' MMMM", { locale: es })}
                </h2>
              )}
              {!esHoy && (
                <button
                  onClick={irAHoy}
                  className="text-sm text-lavender-600 hover:text-lavender-700"
                >
                  Ir a hoy
                </button>
              )}
            </div>

            <button
              onClick={() => (vista === 'dia' ? navegarDia(1) : navegarSemana(1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenido principal */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lavender-600"></div>
          </div>
        ) : vista === 'dia' ? (
          /* Vista día - lista plana sin agrupación por estado */
          <div className="space-y-4">
            {(() => {
              const insts = instanciasDelDia(fechaActual);

              if (insts.length === 0) {
                return (
                  <div className="bg-white rounded-xl shadow p-8 text-center">
                    <div className="text-4xl mb-3">📅</div>
                    <h3 className="text-lg font-medium text-gray-800 mb-1">
                      Sin actividades programadas
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {puedeProgramar
                        ? 'Programa actividades usando el botón de arriba'
                        : 'No hay actividades asignadas para este día'}
                    </p>
                  </div>
                );
              }

              return (
                <>
                  {/* Lista única cronológica - todas las actividades ordenadas por hora */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                      Actividades del día ({insts.length})
                    </h3>
                    <div className="space-y-3">
                      {insts
                        .sort((a, b) => a.horaPreferida.localeCompare(b.horaPreferida))
                        .map((inst) => (
                          <InstanciaActividadCard
                            key={inst.id}
                            instancia={inst}
                            onClick={
                              puedeCompletar && inst.modalidad === 'slot_abierto' && inst.estado === 'pendiente'
                                ? () => handleInstanciaClick(inst)
                                : undefined
                            }
                            showActions={puedeCompletar && inst.modalidad === 'slot_abierto' && inst.estado === 'pendiente'}
                            onCompletar={() => handleInstanciaClick(inst)}
                            puedeEditar={puedeEditar}
                            onEditar={() => handleEditarInstancia(inst)}
                          />
                        ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          /* Vista semana */
          <div className="bg-white rounded-xl shadow divide-y">
            {diasSemana.map((dia) => {
              const insts = instanciasDelDia(dia);
              const esHoyDia = isSameDay(dia, new Date());
              const { definidas, slotsCompletados, slotsPendientes } = agruparPorModalidad(insts);

              return (
                <div
                  key={dia.toISOString()}
                  className={`p-4 ${esHoyDia ? 'bg-lavender-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`font-medium ${esHoyDia ? 'text-lavender-700' : 'text-gray-700'}`}>
                      {format(dia, 'EEEE d', { locale: es })}
                      {esHoyDia && (
                        <span className="ml-2 text-xs bg-lavender-600 text-white px-2 py-0.5 rounded-full">
                          Hoy
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-gray-500">
                      {definidas.length} actividades
                      {(slotsPendientes.length + slotsCompletados.length) > 0 && (
                        <span className="ml-1">
                          • {slotsCompletados.length}/{slotsPendientes.length + slotsCompletados.length} opcionales
                        </span>
                      )}
                    </div>
                  </div>

                  {insts.length === 0 ? (
                    <p className="text-sm text-gray-400">Sin actividades</p>
                  ) : (
                    <div className="space-y-2">
                      {insts.map((inst) => (
                        <InstanciaActividadCard
                          key={inst.id}
                          instancia={inst}
                          compact
                          onClick={
                            puedeCompletar && inst.modalidad === 'slot_abierto' && inst.estado === 'pendiente'
                              ? () => handleInstanciaClick(inst)
                              : undefined
                          }
                          puedeEditar={puedeEditar}
                          onEditar={() => handleEditarInstancia(inst)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Modal Programar */}
      <ProgramarActividadModal
        isOpen={modalProgramar}
        onClose={() => setModalProgramar(false)}
        onSuccess={handleSuccess}
        userId={userProfile?.id || ''}
        configHorarios={configHorarios || undefined}
      />

      {/* Modal Completar Slot - para registrar qué actividad opcional se realizó */}
      <CompletarSlotModal
        isOpen={modalSlot}
        onClose={() => {
          setModalSlot(false);
          setInstanciaSeleccionada(null);
        }}
        onSuccess={handleSuccess}
        instancia={instanciaSeleccionada}
        userId={userProfile?.id || ''}
        userNombre={userProfile?.nombre || ''}
      />

      {/* Modal Editar Programación */}
      <EditarProgramacionModal
        isOpen={modalEditar}
        onClose={() => {
          setModalEditar(false);
          setProgramacionSeleccionada(null);
        }}
        onSuccess={handleSuccess}
        programacion={programacionSeleccionada}
        configHorarios={configHorarios || undefined}
      />
    </Layout>
  );
}
