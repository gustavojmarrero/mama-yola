import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, createUserWithoutSignIn } from '../config/firebase';
import { Usuario } from '../types';
import Layout from '../components/common/Layout';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'cuidador' as 'familiar' | 'supervisor' | 'cuidador',
    telefono: '',
    activo: true
  });

  // Hook para detectar cambios sin guardar
  const { isDirty, setIsDirty, markAsSaved, confirmNavigation } = useUnsavedChanges();
  const isInitialLoad = useRef(true);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  // Detectar cambios en el formulario cuando el modal está abierto
  useEffect(() => {
    if (showModal && !isInitialLoad.current) {
      setIsDirty(true);
    }
  }, [formData, showModal]);

  // Resetear el flag cuando se abre/cierra el modal
  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 100);
    } else {
      isInitialLoad.current = true;
      setIsDirty(false);
    }
  }, [showModal]);

  async function cargarUsuarios() {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'usuarios'));
      const usuariosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Usuario[];
      setUsuarios(usuariosData);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      alert('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }

  function abrirModal(usuario?: Usuario) {
    if (usuario) {
      setEditingUser(usuario);
      setFormData({
        nombre: usuario.nombre,
        email: usuario.email,
        password: '',
        rol: usuario.rol,
        telefono: usuario.telefono || '',
        activo: usuario.activo
      });
    } else {
      setEditingUser(null);
      setFormData({
        nombre: '',
        email: '',
        password: '',
        rol: 'cuidador',
        telefono: '',
        activo: true
      });
    }
    setShowModal(true);
  }

  function cerrarModal() {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      nombre: '',
      email: '',
      password: '',
      rol: 'cuidador',
      telefono: '',
      activo: true
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingUser) {
        // Actualizar usuario existente
        const userRef = doc(db, 'usuarios', editingUser.id);
        await updateDoc(userRef, {
          nombre: formData.nombre,
          rol: formData.rol,
          telefono: formData.telefono,
          activo: formData.activo,
          actualizadoEn: new Date()
        });
        alert('Usuario actualizado exitosamente');
      } else {
        // Crear nuevo usuario
        if (!formData.password || formData.password.length < 6) {
          alert('La contraseña debe tener al menos 6 caracteres');
          return;
        }

        // Crear usuario en Firebase Auth (sin cambiar la sesión actual)
        const uid = await createUserWithoutSignIn(formData.email, formData.password);

        // Crear perfil en Firestore usando el UID como ID del documento
        const userDocRef = doc(db, 'usuarios', uid);
        await setDoc(userDocRef, {
          uid: uid,
          nombre: formData.nombre,
          email: formData.email,
          rol: formData.rol,
          telefono: formData.telefono,
          activo: formData.activo,
          creadoEn: new Date(),
          actualizadoEn: new Date()
        });

        alert('Usuario creado exitosamente');
      }

      markAsSaved();
      cerrarModal();
      cargarUsuarios();
    } catch (error: any) {
      console.error('Error guardando usuario:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('Este email ya está en uso');
      } else if (error.code === 'auth/invalid-email') {
        alert('Email inválido');
      } else {
        alert('Error al guardar usuario: ' + error.message);
      }
    }
  }

  async function eliminarUsuario(usuario: Usuario) {
    if (!confirm(`¿Estás seguro de eliminar a ${usuario.nombre}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'usuarios', usuario.id));
      alert('Usuario eliminado exitosamente');
      cargarUsuarios();
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      alert('Error al eliminar usuario');
    }
  }

  const roleColors = {
    familiar: 'bg-purple-100 text-purple-800',
    supervisor: 'bg-blue-100 text-blue-800',
    cuidador: 'bg-green-100 text-green-800'
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Gestión de Usuarios
              </h1>
              <p className="text-gray-600 mt-1">
                Administra los usuarios del sistema
              </p>
            </div>
            <button
              onClick={() => abrirModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              + Nuevo Usuario
            </button>
          </div>

          {/* Tabla de usuarios */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Cargando usuarios...</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teléfono
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {usuario.nombre}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {usuario.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColors[usuario.rol]}`}>
                          {usuario.rol}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {usuario.telefono || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          usuario.activo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {usuario.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => abrirModal(usuario)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarUsuario(usuario)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {usuarios.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No hay usuarios registrados</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de crear/editar usuario */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              {/* Indicador de cambios sin guardar */}
              {isDirty && (
                <span className="text-sm text-orange-600 flex items-center gap-1">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                  Sin guardar
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    disabled={!!editingUser}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      minLength={6}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Mínimo 6 caracteres
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rol
                  </label>
                  <select
                    value={formData.rol}
                    onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="cuidador">Cuidador</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="familiar">Familiar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono (opcional)
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="activo" className="ml-2 block text-sm text-gray-700">
                    Usuario activo
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    confirmNavigation(() => {
                      cerrarModal();
                    });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingUser ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
