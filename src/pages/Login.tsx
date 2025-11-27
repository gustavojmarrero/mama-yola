import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      setError('Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-50 via-lavender-50/30 to-warm-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-lavender-200/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-lavender-300/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-lavender-100/30 rounded-full blur-2xl" />

      {/* Logo y título */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 animate-slide-up">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-lavender-400 to-lavender-600 rounded-3xl mb-8 shadow-xl shadow-lavender-500/30 transform hover:scale-105 transition-transform duration-300">
          <span className="text-5xl">🏥</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-warm-800 font-display tracking-tight mb-3">
          Mama Yola
        </h1>
        <p className="text-warm-500 text-lg font-medium">
          Sistema de Gestión de Cuidado
        </p>
      </div>

      {/* Card de login */}
      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/80 glass py-10 px-8 shadow-xl shadow-warm-900/5 rounded-3xl sm:px-12 border border-white/50 animate-scale-in">
          <h2 className="text-2xl font-bold text-warm-800 mb-8 text-center font-display">
            Iniciar Sesión
          </h2>

          {error && (
            <div className="bg-error-light border-l-4 border-error text-error-dark px-4 py-3.5 rounded-xl mb-6 text-sm font-medium flex items-center gap-3 animate-shake">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className={`block text-sm font-semibold mb-2 transition-colors duration-200 ${
                  focusedField === 'email' ? 'text-lavender-600' : 'text-warm-700'
                }`}
              >
                Correo electrónico
              </label>
              <div className="relative">
                <div
                  className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
                    focusedField === 'email' ? 'text-lavender-500' : 'text-warm-400'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border-2 border-warm-200 rounded-xl text-warm-800 placeholder-warm-400 focus:outline-none focus:border-lavender-400 focus:ring-4 focus:ring-lavender-100 transition-all duration-200 hover:border-warm-300"
                  placeholder="usuario@ejemplo.com"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className={`block text-sm font-semibold mb-2 transition-colors duration-200 ${
                  focusedField === 'password' ? 'text-lavender-600' : 'text-warm-700'
                }`}
              >
                Contraseña
              </label>
              <div className="relative">
                <div
                  className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
                    focusedField === 'password' ? 'text-lavender-500' : 'text-warm-400'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border-2 border-warm-200 rounded-xl text-warm-800 placeholder-warm-400 focus:outline-none focus:border-lavender-400 focus:ring-4 focus:ring-lavender-100 transition-all duration-200 hover:border-warm-300"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-4 px-6 bg-lavender-600 hover:bg-lavender-700 text-white text-base font-semibold rounded-xl shadow-btn-primary hover:shadow-btn-primary-hover focus:outline-none focus:ring-4 focus:ring-lavender-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Iniciando sesión...
                </>
              ) : (
                <>
                  Iniciar Sesión
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-warm-500">
            Si no tienes acceso, contacta al administrador del sistema.
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-10 text-center text-sm text-warm-400 relative z-10">
        © {new Date().getFullYear()} Mama Yola. Sistema de cuidado integral.
      </p>
    </div>
  );
}
