import { useState, useEffect } from 'react';
import {
  TipoActividadV2,
  ModalidadProgramacion,
  ActividadDefinida,
  SlotAbierto,
  TIPOS_ACTIVIDAD_CONFIG,
} from '../../types/actividades';
import type { TurnoActividad, NivelEnergia } from '../../types';
import {
  crearProgramacionDefinida,
  crearProgramacionSlotAbierto,
} from '../../services/programacionActividades';
import SelectorTipoActividad from './SelectorTipoActividad';
import SelectorDiasSemana from './SelectorDiasSemana';
import SelectorPlantillasPermitidas from './SelectorPlantillasPermitidas';
import { calcularTurno, getTurnoInfo } from '../../utils/turnos';

interface ProgramarActividadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
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
  // Para actividad definida
  nombre: string;
  descripcion: string;
  duracion: number;
  ubicacion: string;
  materialesNecesarios: string[];
  nivelEnergia: NivelEnergia;
  // Para slot abierto
  duracionEstimada: number;
  instrucciones: string;
  plantillasPermitidas: string[];
  // Programación temporal
  horaPreferida: string;
  diasSemana: number[];
}

const initialFormState: FormState = {
  modalidad: 'definida',
  tipo: 'fisica',
  nombre: '',
  descripcion: '',
  duracion: 30,
  ubicacion: '',
  materialesNecesarios: [],
  nivelEnergia: 'medio',
  duracionEstimada: 30,
  instrucciones: '',
  plantillasPermitidas: [],
  horaPreferida: '09:00',
  diasSemana: [1, 2, 3, 4, 5], // Lunes a Viernes por defecto
};

export default function ProgramarActividadModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  configHorarios,
}: ProgramarActividadModalProps) {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [nuevoMaterial, setNuevoMaterial] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calcular turno basado en hora
  const turno: TurnoActividad = configHorarios
    ? (calcularTurno(form.horaPreferida, configHorarios) as TurnoActividad)
    : 'matutino';
  const turnoInfo = getTurnoInfo(turno);

  // Reset form cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setForm(initialFormState);
      setError(null);
    }
  }, [isOpen]);

  const handleChange = (
    field: keyof FormState,
    value: string | number | string[] | number[] | ModalidadProgramacion | TipoActividadV2 | NivelEnergia
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const agregarMaterial = () => {
    if (nuevoMaterial.trim()) {
      setForm((prev) => ({
        ...prev,
        materialesNecesarios: [...prev.materialesNecesarios, nuevoMaterial.trim()],
      }));
      setNuevoMaterial('');
    }
  };

  const eliminarMaterial = (index: number) => {
    setForm((prev) => ({
      ...prev,
      materialesNecesarios: prev.materialesNecesarios.filter((_, i) => i !== index),
    }));
  };

  const validarFormulario = (): string | null => {
    if (form.diasSemana.length === 0) {
      return 'Selecciona al menos un día de la semana';
    }

    if (form.modalidad === 'definida') {
      if (!form.nombre.trim()) {
        return 'El nombre de la actividad es requerido';
      }
      if (form.duracion < 5) {
        return 'La duración mínima es 5 minutos';
      }
    }

    if (form.modalidad === 'slot_abierto') {
      if (form.duracionEstimada < 5) {
        return 'La duración estimada mínima es 5 minutos';
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validarFormulario();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (form.modalidad === 'definida') {
        const actividad: ActividadDefinida = {
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          descripcion: form.descripcion.trim() || '',
          duracion: form.duracion,
          ubicacion: form.ubicacion.trim() || null,
          materialesNecesarios: form.materialesNecesarios.length > 0 ? form.materialesNecesarios : [],
          nivelEnergia: form.nivelEnergia,
        };

        await crearProgramacionDefinida(
          actividad,
          turno,
          form.horaPreferida,
          form.diasSemana,
          userId
        );
      } else {
        const slot: SlotAbierto = {
          tipo: form.tipo,
          duracionEstimada: form.duracionEstimada,
          instrucciones: form.instrucciones.trim() || '',
          plantillasPermitidas: form.plantillasPermitidas, // vacío = todas
        };

        await crearProgramacionSlotAbierto(
          slot,
          turno,
          form.horaPreferida,
          form.diasSemana,
          userId
        );
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error guardando programación:', err);
      setError('Error al guardar la programación. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

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
          {/* Handle de arrastre móvil */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800">
              Programar Actividad
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Selector de Modalidad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Programación
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('modalidad', 'definida')}
                  className={`
                    p-4 rounded-xl border-2 text-left transition-all
                    ${
                      form.modalidad === 'definida'
                        ? 'border-lavender-500 bg-lavender-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="text-2xl mb-1">📋</div>
                  <div className="font-medium text-gray-800">Actividad Definida</div>
                  <div className="text-xs text-gray-500">Tú defines todo</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('modalidad', 'slot_abierto')}
                  className={`
                    p-4 rounded-xl border-2 text-left transition-all
                    ${
                      form.modalidad === 'slot_abierto'
                        ? 'border-lavender-500 bg-lavender-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="text-2xl mb-1">🎯</div>
                  <div className="font-medium text-gray-800">Actividad Opcional</div>
                  <div className="text-xs text-gray-500">Cuidador elige</div>
                </button>
              </div>
            </div>

            {/* Campos para Actividad Definida */}
            {form.modalidad === 'definida' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la Actividad *
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    placeholder="Ej: Caminata matutina"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duración (min)
                    </label>
                    <input
                      type="number"
                      value={form.duracion}
                      onChange={(e) => handleChange('duracion', parseInt(e.target.value) || 0)}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ubicación
                  </label>
                  <input
                    type="text"
                    value={form.ubicacion}
                    onChange={(e) => handleChange('ubicacion', e.target.value)}
                    placeholder="Ej: Jardín, Sala, etc."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={form.descripcion}
                    onChange={(e) => handleChange('descripcion', e.target.value)}
                    placeholder="Instrucciones o detalles adicionales..."
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Materiales Necesarios
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={nuevoMaterial}
                      onChange={(e) => setNuevoMaterial(e.target.value)}
                      placeholder="Agregar material..."
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarMaterial())}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={agregarMaterial}
                      className="px-4 py-2 bg-lavender-100 text-lavender-700 rounded-xl hover:bg-lavender-200 transition-colors"
                    >
                      +
                    </button>
                  </div>
                  {form.materialesNecesarios.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.materialesNecesarios.map((mat, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-gray-100 rounded-full text-sm flex items-center gap-2"
                        >
                          {mat}
                          <button
                            type="button"
                            onClick={() => eliminarMaterial(i)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Campos para Actividad Opcional (Slot Abierto) */}
            {form.modalidad === 'slot_abierto' && (
              <>
                {/* Selector de Tipo de Actividad - solo para actividades opcionales */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Actividad
                  </label>
                  <SelectorTipoActividad
                    value={form.tipo}
                    onChange={(tipo) => handleChange('tipo', tipo)}
                  />
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{tipoConfig.icon}</span>
                    <div>
                      <p className="text-sm text-gray-700">
                        El cuidador elegirá la actividad específica de las plantillas
                        <strong className={tipoConfig.color}> {tipoConfig.label.toLowerCase()}s</strong> disponibles.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duración Estimada (min)
                  </label>
                  <input
                    type="number"
                    value={form.duracionEstimada}
                    onChange={(e) => handleChange('duracionEstimada', parseInt(e.target.value) || 0)}
                    min={5}
                    max={180}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instrucciones para el Cuidador
                  </label>
                  <textarea
                    value={form.instrucciones}
                    onChange={(e) => handleChange('instrucciones', e.target.value)}
                    placeholder="Ej: Preferir actividades al aire libre si el clima lo permite..."
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plantillas Permitidas
                  </label>
                  <SelectorPlantillasPermitidas
                    tipo={form.tipo}
                    value={form.plantillasPermitidas}
                    onChange={(ids) => handleChange('plantillasPermitidas', ids)}
                  />
                </div>
              </>
            )}

            {/* Separador */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-medium text-gray-800 mb-4">Programación</h3>

              {/* Hora */}
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
                  <div className={`px-3 py-2 rounded-lg text-sm ${turnoInfo.color}`}>
                    {turnoInfo.icon} {turnoInfo.label}
                  </div>
                </div>
              </div>

              {/* Días de la Semana */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Días de la Semana
                </label>
                <SelectorDiasSemana
                  value={form.diasSemana}
                  onChange={(dias) => handleChange('diasSemana', dias)}
                  showLabels
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
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-3 px-4 bg-lavender-600 text-white rounded-xl font-medium hover:bg-lavender-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                'Programar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
