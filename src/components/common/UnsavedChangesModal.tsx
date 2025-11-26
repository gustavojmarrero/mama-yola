interface UnsavedChangesModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onSaveAndContinue?: () => void;
}

export default function UnsavedChangesModal({
  isOpen,
  onConfirm,
  onCancel,
  onSaveAndContinue
}: UnsavedChangesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          Cambios sin guardar
        </h3>
        <p className="text-gray-600 mb-4">
          Tienes cambios que no se han guardado. ¿Qué deseas hacer?
        </p>
        <div className="flex flex-col gap-2">
          {onSaveAndContinue && (
            <button
              onClick={onSaveAndContinue}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Guardar y continuar
            </button>
          )}
          <button
            onClick={onConfirm}
            className="w-full py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            Salir sin guardar
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
