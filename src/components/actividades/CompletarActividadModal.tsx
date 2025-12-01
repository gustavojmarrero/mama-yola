import { useState } from 'react';
import {
  InstanciaActividad,
  TIPOS_ACTIVIDAD_CONFIG,
  getNombreInstancia,
  getDuracionInstancia,
} from '../../types/actividades';
import { completarInstanciaDefinida, omitirInstancia } from '../../services/instanciasActividades';
import type { ParticipacionActividad } from '../../types';

interface CompletarActividadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  instancia: InstanciaActividad | null;
  userId: string;
  userNombre: string;
}

interface FormState {
  duracionReal: number;
  participacion: ParticipacionActividad;
  estadoAnimo: string;
  notas: string;
}

const ESTADOS_ANIMO = [
  { value: 'alegre', label: 'Alegre', emoji: '😊' },
  { value: 'neutral', label: 'Neutral', emoji: '😐' },
  { value: 'tranquila', label: 'Tranquila', emoji: '😌' },
  { value: 'cansada', label: 'Cansada', emoji: '😴' },
  { value: 'frustrada', label: 'Frustrada', emoji: '😤' },
  { value: 'triste', label: 'Triste', emoji: '😢' },
];

export default function CompletarActividadModal({
  isOpen,
  onClose,
  onSuccess,
  instancia,
  userId,
  userNombre,
}: CompletarActividadModalProps) {
  const [form, setForm] = useState<FormState>({
    duracionReal: instancia ? getDuracionInstancia(instancia) : 30,
    participacion: 'activa',
    estadoAnimo: '',
    notas: '',
  });
  const [modo, setModo] = useState<'completar' | 'omitir'>('completar');
  const [motivoOmision, setMotivoOmision] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Actualizar duración cuando cambia la instancia
  useState(() => {
    if (instancia) {
      setForm((prev) => ({
        ...prev,
        duracionReal: getDuracionInstancia(instancia),
      }));
    }
  });

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleCompletar = async () => {
    if (!instancia) return;

    setSaving(true);
    setError(null);

    try {
      await completarInstanciaDefinida(
        instancia.id,
        userId,
        userNombre,
        form.duracionReal,
        form.participacion,
        form.estadoAnimo || undefined,
        form.notas || undefined
      );

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error completando actividad:', err);
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleOmitir = async () => {
    if (!instancia) return;

    if (!motivoOmision.trim()) {
      setError('Por favor indica el motivo de omisión');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await omitirInstancia(
        instancia.id,
        motivoOmision.trim(),
        userId,
        userNombre
      );

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error omitiendo actividad:', err);
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !instancia) return null;

  const tipoConfig = TIPOS_ACTIVIDAD_CONFIG[instancia.tipo];
  const nombre = getNombreInstancia(instancia);
  const duracionProgramada = getDuracionInstancia(instancia);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
          {/* Handle de arrastre móvil */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">
                {modo === 'completar' ? 'Completar Actividad' : 'Omitir Actividad'}
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

            {/* Info de la actividad */}
            <div className={`mt-3 p-3 rounded-xl ${tipoConfig.bgColor}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{tipoConfig.icon}</span>
                <div>
                  <h3 className="font-medium text-gray-800">{nombre}</h3>
                  <p className="text-sm text-gray-600">
                    {instancia.horaPreferida} • {duracionProgramada} min
                    {instancia.actividadDefinida?.ubicacion && (
                      <> • {instancia.actividadDefinida.ubicacion}</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Toggle Completar/Omitir */}
            <div className="flex rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setModo('completar')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  modo === 'completar'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                ✓ Completar
              </button>
              <button
                type="button"
                onClick={() => setModo('omitir')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  modo === 'omitir'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                ⊘ Omitir
              </button>
            </div>

            {modo === 'completar' ? (
              <>
                {/* Duración Real */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duración Real (minutos)
                  </label>
                  <input
                    type="number"
                    value={form.duracionReal}
                    onChange={(e) => handleChange('duracionReal', parseInt(e.target.value) || 0)}
                    min={1}
                    max={180}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                  />
                </div>

                {/* Nivel de Participación */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nivel de Participación
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'activa', label: 'Activa', desc: 'Participó con gusto' },
                      { value: 'pasiva', label: 'Pasiva', desc: 'Con ayuda' },
                      { value: 'minima', label: 'Mínima', desc: 'Poca participación' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleChange('participacion', opt.value as ParticipacionActividad)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          form.participacion === opt.value
                            ? 'border-lavender-500 bg-lavender-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-sm">{opt.label}</div>
                        <div className="text-xs text-gray-500">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Estado de Ánimo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado de Ánimo (opcional)
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {ESTADOS_ANIMO.map((estado) => (
                      <button
                        key={estado.value}
                        type="button"
                        onClick={() =>
                          handleChange(
                            'estadoAnimo',
                            form.estadoAnimo === estado.value ? '' : estado.value
                          )
                        }
                        className={`flex-shrink-0 px-3 py-2 rounded-xl border-2 transition-all ${
                          form.estadoAnimo === estado.value
                            ? 'border-lavender-500 bg-lavender-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-lg">{estado.emoji}</span>
                        <span className="ml-1 text-sm">{estado.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={form.notas}
                    onChange={(e) => handleChange('notas', e.target.value)}
                    placeholder="Observaciones sobre la actividad..."
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent resize-none"
                  />
                </div>
              </>
            ) : (
              /* Modo Omitir */
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo de Omisión *
                </label>
                <textarea
                  value={motivoOmision}
                  onChange={(e) => setMotivoOmision(e.target.value)}
                  placeholder="¿Por qué no se realizó la actividad?"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent resize-none"
                />
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    Al omitir la actividad, quedará registrada como no realizada junto con el motivo indicado.
                  </p>
                </div>
              </div>
            )}

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
              onClick={modo === 'completar' ? handleCompletar : handleOmitir}
              disabled={saving}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                modo === 'completar'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : modo === 'completar' ? (
                'Marcar Completada'
              ) : (
                'Confirmar Omisión'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
