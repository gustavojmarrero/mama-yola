interface ViewToggleProps {
  view: 'grid' | 'list';
  onChange: (view: 'grid' | 'list') => void;
  className?: string;
}

export default function ViewToggle({ view, onChange, className = '' }: ViewToggleProps) {
  return (
    <div
      className={`inline-flex rounded-lg bg-gray-100 p-1 ${className}`}
      role="radiogroup"
      aria-label="Cambiar vista"
    >
      <button
        type="button"
        role="radio"
        aria-checked={view === 'list'}
        onClick={() => onChange('list')}
        className={`px-3 py-2 rounded-md transition-all duration-200 ${
          view === 'list'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="Vista de lista"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={view === 'grid'}
        onClick={() => onChange('grid')}
        className={`px-3 py-2 rounded-md transition-all duration-200 ${
          view === 'grid'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="Vista de cuadrícula"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      </button>
    </div>
  );
}
