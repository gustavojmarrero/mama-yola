import { useState, useEffect, useRef } from 'react';
import { Medicamento } from '../../types';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

export interface MedicamentoFormData {
  nombre: string;
  dosis: string;
  presentacion: string;
  diasSemana: number[];
  horarios: string[];
  instrucciones: string;
  fotoFile: File | null;
  fotoURL: string;
}

interface MedicamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicamento?: Medicamento | null;
  onSave: (data: MedicamentoFormData, isEdit: boolean) => Promise<void>;
  loading?: boolean;
}

const diasSemanaLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function MedicamentoModal({
  isOpen,
  onClose,
  medicamento,
  onSave,
  loading = false,
}: MedicamentoModalProps) {
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

  // Inicializar formulario cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      if (medicamento) {
        // Modo edición
        setNombre(medicamento.nombre);
        setDosis(medicamento.dosis);
        setPresentacion(medicamento.presentacion);
        setDiasSemana(medicamento.frecuencia.diasSemana || []);
        setHorarios(medicamento.horarios.length > 0 ? medicamento.horarios : ['']);
        setInstrucciones(medicamento.instrucciones || '');
        setFotoURL(medicamento.foto || '');
        setFotoFile(null);
      } else {
        // Modo creación
        limpiarFormulario();
      }
      // Delay para permitir inicialización antes de detectar cambios
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 100);
    } else {
      isInitialLoad.current = true;
      setIsDirty(false);
    }
  }, [isOpen, medicamento]);

  // Detectar cambios en el formulario
  useEffect(() => {
    if (isOpen && !isInitialLoad.current) {
      setIsDirty(true);
    }
  }, [nombre, dosis, presentacion, diasSemana, horarios, instrucciones, fotoFile, isOpen]);

  // Manejar escape para cerrar
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isDirty]);

  function limpiarFormulario() {
    setNombre('');
    setDosis('');
    setPresentacion('tableta');
    setDiasSemana([]);
    setHorarios(['']);
    setInstrucciones('');
    setFotoFile(null);
    setFotoURL('');
  }

  function handleClose() {
    confirmNavigation(() => {
      limpiarFormulario();
      onClose();
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!nombre || !dosis || horarios.filter((h) => h).length === 0) {
      alert('Por favor completa los campos obligatorios: nombre, dosis y al menos un horario');
      return;
    }

    await onSave(
      {
        nombre,
        dosis,
        presentacion,
        diasSemana,
        horarios: horarios.filter((h) => h !== ''),
        instrucciones,
        fotoFile,
        fotoURL,
      },
      !!medicamento
    );

    markAsSaved();
    limpiarFormulario();
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-lg rounded-t-2xl shadow-xl max-h-[92vh] sm:max-h-[85vh] flex flex-col animate-slide-up sm:animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Handle móvil */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header sticky */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl sm:rounded-t-lg z-10">
          <div className="flex items-center gap-3">
            <h2 id="modal-title" className="text-xl font-bold text-gray-900">
              {medicamento ? 'Editar Medicamento' : 'Nuevo Medicamento'}
            </h2>
            {isDirty && (
              <span className="text-sm text-orange-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                Sin guardar
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulario scrolleable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: 50mg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Presentación</label>
              <select
                value={presentacion}
                onChange={(e) => setPresentacion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
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
                        <option key={h} value={h}>
                          {h}
                        </option>
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
                        <option key={m} value={m}>
                          {m}
                        </option>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              {fotoFile && <span className="text-sm text-gray-600">{fotoFile.name}</span>}
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
        </form>

        {/* Footer sticky con botones */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3 rounded-b-lg">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="medicamento-form"
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              const form = document.querySelector('form');
              if (form) {
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
              }
            }}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400"
          >
            {loading ? 'Guardando...' : medicamento ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}
