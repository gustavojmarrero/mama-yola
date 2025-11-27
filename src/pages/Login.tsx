import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-warm-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Logo y título */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-lavender-100 rounded-3xl mb-6 shadow-soft-md">
          <span className="text-4xl">🏥</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-warm-800 font-display mb-2">
          Mama Yola
        </h1>
        <p className="text-warm-500 text-lg">
          Sistema de Gestión de Cuidado
        </p>
      </div>

      {/* Card de login */}
      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-soft-lg rounded-2xl sm:px-10">
          <h2 className="text-xl font-semibold text-warm-800 mb-6 text-center font-display">
            Iniciar Sesión
          </h2>

          {error && (
            <div className="bg-error-light border border-error/20 text-error-dark px-4 py-3 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-warm-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-4 py-3 border border-warm-200 rounded-xl shadow-soft-sm placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-lavender-500 focus:border-lavender-500 transition-all"
                placeholder="usuario@ejemplo.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-warm-700 mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-3 border border-warm-200 rounded-xl shadow-soft-sm placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-lavender-500 focus:border-lavender-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-soft-md text-sm font-semibold text-white bg-lavender-600 hover:bg-lavender-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lavender-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-warm-500">
            Si no tienes acceso, contacta al administrador del sistema.
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-xs text-warm-400">
        © 2024 Mama Yola. Sistema de cuidado integral.
      </p>
    </div>
  );
}
