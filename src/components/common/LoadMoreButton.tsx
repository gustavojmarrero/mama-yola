interface LoadMoreButtonProps {
  onClick: () => void;
  loading?: boolean;
  hasMore: boolean;
  loadedCount: number;
  totalCount: number;
  itemsPerLoad?: number;
}

export default function LoadMoreButton({
  onClick,
  loading = false,
  hasMore,
  loadedCount,
  totalCount,
  itemsPerLoad = 10,
}: LoadMoreButtonProps) {
  // No mostrar si no hay items o ya se cargaron todos
  if (totalCount === 0) return null;

  const remaining = totalCount - loadedCount;

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      {/* Contador */}
      <p className="text-sm text-gray-500">
        Mostrando <span className="font-semibold text-gray-700">{loadedCount}</span> de{' '}
        <span className="font-semibold text-gray-700">{totalCount}</span> items
      </p>

      {/* Botón Cargar más */}
      {hasMore && (
        <button
          onClick={onClick}
          disabled={loading}
          className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              {/* Spinner */}
              <svg
                className="animate-spin h-4 w-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Cargando...</span>
            </>
          ) : (
            <>
              <span>Cargar más</span>
              <span className="text-gray-400">({Math.min(remaining, itemsPerLoad)} más)</span>
            </>
          )}
        </button>
      )}

      {/* Mensaje cuando se han cargado todos */}
      {!hasMore && loadedCount > 0 && (
        <p className="text-xs text-gray-400">Has llegado al final de la lista</p>
      )}
    </div>
  );
}
