import { useState, useEffect } from 'react';
import {
  ProgramacionActividad,
  TipoActividadV2,
  TIPOS_ACTIVIDAD_CONFIG,
  DIAS_SEMANA,
  ModalidadProgramacion,
} from '../../types/actividades';
import type { TurnoActividad, NivelEnergia } from '../../types';
import {
  actualizarProgramacion,
  desactivarProgramacion,
} from '../../services/programacionActividades';
import { eliminarInstanciasFuturasPendientes } from '../../services/instanciasActividades';
import SelectorTipoActividad from './SelectorTipoActividad';
import SelectorDiasSemana from './SelectorDiasSemana';
import { calcularTurno, getTurnoInfo } from '../../utils/turnos';

interface EditarProgramacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  programacion: ProgramacionActividad | null;
  configHorarios?: {
    chequeoDiario: {
      matutino: string;
      vespertino: string;
      nocturno: string;
    };
  };
}

interface FormState {
  modalidad: ModalidadProgramacion;
  tipo: TipoActividadV2;
  nombre: string;
  descripcion: string;
  duracion: number;
  ubicacion: string;
  nivelEnergia: NivelEnergia;
  horaPreferida: string;
  diasSemana: number[];
  // Para slot abierto
  duracionEstimada: number;
  instrucciones: string;
}

export default function EditarProgramacionModal({
  isOpen,
  onClose,
  onSuccess,
  programacion,
  configHorarios,
}: EditarProgramacionModalProps) {
  const [form, setForm] = useState<FormState>({
    modalidad: 'definida',
    tipo: 'fisica',
    nombre: '',
    descripcion: '',
    duracion: 30,
    ubicacion: '',
    nivelEnergia: 'medio',
    horaPreferida: '09:00',
    diasSemana: [1, 2, 3, 4, 5],
    duracionEstimada: 30,
    instrucciones: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Cargar datos de la programación al abrir
  useEffect(() => {
    if (programacion && isOpen) {
      if (programacion.modalidad === 'definida' && programacion.actividadDefinida) {
        setForm({
          modalidad: 'definida',
          tipo: programacion.actividadDefinida.tipo,
          nombre: programacion.actividadDefinida.nombre,
          descripcion: programacion.actividadDefinida.descripcion || '',
          duracion: programacion.actividadDefinida.duracion,
          ubicacion: programacion.actividadDefinida.ubicacion || '',
          nivelEnergia: programacion.actividadDefinida.nivelEnergia,
          horaPreferida: programacion.horaPreferida,
          diasSemana: programacion.diasSemana,
          duracionEstimada: programacion.slotAbierto?.duracionEstimada || 30,
          instrucciones: programacion.slotAbierto?.instrucciones || '',
        });
      } else if (programacion.modalidad === 'slot_abierto' && programacion.slotAbierto) {
        setForm({
          modalidad: 'slot_abierto',
          tipo: programacion.slotAbierto.tipo,
          nombre: programacion.actividadDefinida?.nombre || '',
          descripcion: programacion.actividadDefinida?.descripcion || '',
          duracion: programacion.actividadDefinida?.duracion || 30,
          ubicacion: programacion.actividadDefinida?.ubicacion || '',
          nivelEnergia: programacion.actividadDefinida?.nivelEnergia || 'medio',
          horaPreferida: programacion.horaPreferida,
          diasSemana: programacion.diasSemana,
          duracionEstimada: programacion.slotAbierto.duracionEstimada,
          instrucciones: programacion.slotAbierto.instrucciones || '',
        });
      }
      setConfirmDelete(false);
      setMenuOpen(false);
      setError(null);
    }
  }, [programacion, isOpen]);

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  // Calcular turno basado en hora
  const turno = calcularTurno(form.horaPreferida, configHorarios?.chequeoDiario);
  const turnoInfo = getTurnoInfo(turno);

  const handleGuardar = async () => {
    if (!programacion) return;

    // Validaciones según la modalidad seleccionada
    if (form.modalidad === 'definida' && !form.nombre.trim()) {
      setError('El nombre de la actividad es requerido');
      return;
    }
    if (form.diasSemana.length === 0) {
      setError('Selecciona al menos un día de la semana');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Eliminar instancias futuras pendientes para que se regeneren con los nuevos datos
      await eliminarInstanciasFuturasPendientes(programacion.id);

      if (form.modalidad === 'definida') {
        // Guardar como actividad definida
        await actualizarProgramacion(programacion.id, {
          modalidad: 'definida',
          actividadDefinida: {
            nombre: form.nombre.trim(),
            tipo: form.tipo,
            descripcion: form.descripcion.trim() || '',
            duracion: form.duracion,
            ubicacion: form.ubicacion.trim() || null,
            materialesNecesarios: programacion.actividadDefinida?.materialesNecesarios || [],
            nivelEnergia: form.nivelEnergia,
          },
          slotAbierto: null,
          turno,
          horaPreferida: form.horaPreferida,
          diasSemana: form.diasSemana,
        });
      } else {
        // Guardar como slot abierto
        await actualizarProgramacion(programacion.id, {
          modalidad: 'slot_abierto',
          slotAbierto: {
            tipo: form.tipo,
            duracionEstimada: form.duracionEstimada,
            instrucciones: form.instrucciones.trim() || '',
            plantillasPermitidas: programacion.slotAbierto?.plantillasPermitidas || [],
          },
          actividadDefinida: null,
          turno,
          horaPreferida: form.horaPreferida,
          diasSemana: form.diasSemana,
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error actualizando programación:', err);
      setError('Error al guardar los cambios. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDesactivar = async () => {
    if (!programacion) return;

    setSaving(true);
    setError(null);

    try {
      // Eliminar instancias futuras pendientes
      await eliminarInstanciasFuturasPendientes(programacion.id);
      // Desactivar la programación
      await desactivarProgramacion(programacion.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error desactivando programación:', err);
      setError('Error al desactivar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !programacion) return null;

  const esDefinida = form.modalidad === 'definida';
  const tipoConfig = TIPOS_ACTIVIDAD_CONFIG[form.tipo];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
          {/* Handle móvil */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">
                Editar Programación
              </h2>
              <div className="flex items-center gap-1">
                {/* Menú de opciones */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="6" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="18" r="2" />
                    </svg>
                  </button>
                  {menuOpen && (
                    <>
                      {/* Overlay para cerrar */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpen(false)}
                      />
                      {/* Dropdown */}
                      <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-20 py-1">
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            setConfirmDelete(true);
                          }}
                          className="w-full px-4 py-2.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 text-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          Desactivar programación
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {/* Botón cerrar */}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Selector de modalidad */}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => handleChange('modalidad', 'definida')}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  form.modalidad === 'definida'
                    ? 'bg-lavender-100 text-lavender-700 ring-2 ring-lavender-500'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Definida
              </button>
              <button
                type="button"
                onClick={() => handleChange('modalidad', 'slot_abierto')}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  form.modalidad === 'slot_abierto'
                    ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-500'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
                Slot Abierto
              </button>
            </div>
          </div>

          {/* Banner de confirmación para desactivar */}
          {confirmDelete && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-800 font-medium">
                ¿Desactivar esta programación?
              </p>
              <p className="text-xs text-red-600 mt-1 mb-3">
                Las instancias futuras no se generarán. Esta acción no afecta las actividades ya completadas.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDesactivar}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Desactivando...' : 'Sí, desactivar'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={saving}
                  className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Nota informativa */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-blue-700">
                Los cambios solo afectan las <strong>instancias futuras</strong>. Las actividades ya completadas o pendientes de días anteriores no se modificarán.
              </p>
            </div>

            {/* Tipo de actividad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Actividad
              </label>
              <SelectorTipoActividad
                value={form.tipo}
                onChange={(tipo) => handleChange('tipo', tipo)}
              />
            </div>

            {esDefinida ? (
              <>
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la Actividad *
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                    placeholder="Ej: Caminata matutina"
                  />
                </div>

                {/* Duración y Nivel de Energía */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duración (min)
                    </label>
                    <input
                      type="number"
                      value={form.duracion}
                      onChange={(e) => handleChange('duracion', parseInt(e.target.value) || 30)}
                      min={5}
                      max={180}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nivel de Energía
                    </label>
                    <select
                      value={form.nivelEnergia}
                      onChange={(e) => handleChange('nivelEnergia', e.target.value as NivelEnergia)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                    >
                      <option value="bajo">🔋 Bajo</option>
                      <option value="medio">⚡ Medio</option>
                      <option value="alto">🔥 Alto</option>
                    </select>
                  </div>
                </div>

                {/* Ubicación */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ubicación
                  </label>
                  <input
                    type="text"
                    value={form.ubicacion}
                    onChange={(e) => handleChange('ubicacion', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                    placeholder="Ej: Jardín, Sala, etc."
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={form.descripcion}
                    onChange={(e) => handleChange('descripcion', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent resize-none"
                    placeholder="Instrucciones o detalles adicionales..."
                  />
                </div>
              </>
            ) : (
              <>
                {/* Slot abierto - Duración estimada */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duración Estimada (min)
                  </label>
                  <input
                    type="number"
                    value={form.duracionEstimada}
                    onChange={(e) => handleChange('duracionEstimada', parseInt(e.target.value) || 30)}
                    min={5}
                    max={180}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                  />
                </div>

                {/* Instrucciones */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instrucciones para el Cuidador
                  </label>
                  <textarea
                    value={form.instrucciones}
                    onChange={(e) => handleChange('instrucciones', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent resize-none"
                    placeholder="Indicaciones para elegir la actividad..."
                  />
                </div>
              </>
            )}

            {/* Programación */}
            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Programación</h3>

              {/* Hora preferida */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora Preferida
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={form.horaPreferida}
                    onChange={(e) => handleChange('horaPreferida', e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                  />
                  <span className={`px-3 py-2 rounded-lg text-sm ${turnoInfo.bgColor} ${turnoInfo.color}`}>
                    {turnoInfo.emoji} {turnoInfo.nombre}
                  </span>
                </div>
              </div>

              {/* Días de la semana */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Días de la Semana
                </label>
                <SelectorDiasSemana
                  value={form.diasSemana}
                  onChange={(dias) => handleChange('diasSemana', dias)}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardar}
              disabled={saving}
              className="flex-1 py-3 px-4 bg-lavender-600 text-white rounded-xl font-medium hover:bg-lavender-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
