import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Usuarios from './pages/Usuarios'
import Paciente from './pages/Paciente'
import SignosVitales from './pages/SignosVitales'
import ChequeoDiario from './pages/ChequeoDiario'
import Medicamentos from './pages/Medicamentos'
import PastilleroDiario from './pages/PastilleroDiario'
import Contactos from './pages/Contactos'
import Eventos from './pages/Eventos'
import Inventarios from './pages/Inventarios'
import SolicitudesMateriales from './pages/SolicitudesMateriales'
import Turnos from './pages/Turnos'
import Actividades from './pages/Actividades'
import ActividadesV2 from './pages/ActividadesV2'
import PlantillasActividades from './pages/PlantillasActividades'
import MenuComida from './pages/MenuComida'
import Analytics from './pages/Analytics'
import ConfiguracionHorarios from './pages/ConfiguracionHorarios'
import PrivateRoute from './components/common/PrivateRoute'

function App() {
  return (
    <Routes>
      {/* Ruta raíz - redirige a login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Rutas públicas */}
      <Route path="/login" element={<Login />} />

      {/* Rutas protegidas */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <PrivateRoute>
            <Usuarios />
          </PrivateRoute>
        }
      />
      <Route
        path="/paciente"
        element={
          <PrivateRoute>
            <Paciente />
          </PrivateRoute>
        }
      />
      <Route
        path="/signos-vitales"
        element={
          <PrivateRoute>
            <SignosVitales />
          </PrivateRoute>
        }
      />
      <Route
        path="/chequeo-diario"
        element={
          <PrivateRoute>
            <ChequeoDiario />
          </PrivateRoute>
        }
      />
      <Route
        path="/medicamentos"
        element={
          <PrivateRoute>
            <Medicamentos />
          </PrivateRoute>
        }
      />
      <Route
        path="/pastillero-diario"
        element={
          <PrivateRoute>
            <PastilleroDiario />
          </PrivateRoute>
        }
      />
      <Route
        path="/contactos"
        element={
          <PrivateRoute>
            <Contactos />
          </PrivateRoute>
        }
      />
      <Route
        path="/eventos"
        element={
          <PrivateRoute>
            <Eventos />
          </PrivateRoute>
        }
      />
      <Route
        path="/inventarios"
        element={
          <PrivateRoute>
            <Inventarios />
          </PrivateRoute>
        }
      />
      <Route
        path="/solicitudes"
        element={
          <PrivateRoute>
            <SolicitudesMateriales />
          </PrivateRoute>
        }
      />
      <Route
        path="/turnos"
        element={
          <PrivateRoute>
            <Turnos />
          </PrivateRoute>
        }
      />
      <Route
        path="/actividades"
        element={
          <PrivateRoute>
            <ActividadesV2 />
          </PrivateRoute>
        }
      />
      <Route
        path="/actividades-v2"
        element={
          <PrivateRoute>
            <ActividadesV2 />
          </PrivateRoute>
        }
      />
      <Route
        path="/plantillas"
        element={
          <PrivateRoute>
            <PlantillasActividades />
          </PrivateRoute>
        }
      />
      <Route
        path="/menu-comida"
        element={
          <PrivateRoute>
            <MenuComida />
          </PrivateRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <PrivateRoute>
            <Analytics />
          </PrivateRoute>
        }
      />
      <Route
        path="/configuracion-horarios"
        element={
          <PrivateRoute>
            <ConfiguracionHorarios />
          </PrivateRoute>
        }
      />

      {/* Ruta 404 - redirige a login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
