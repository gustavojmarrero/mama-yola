# 🏥 Mama Yola - Sistema de Gestión de Cuidado de Adultos Mayores

Sistema web privado para coordinar y gestionar el cuidado integral de adultos mayores, facilitando la colaboración entre cuidadores, supervisores y familiares.

## 📋 Descripción

Aplicación web que digitaliza y centraliza la gestión del cuidado de adultos mayores, reemplazando los reportes por WhatsApp con un sistema estructurado que incluye:

- ✅ **Chequeo Diario Digital**: Registro completo de signos vitales, alimentación, funciones corporales y estado general
- 💊 **Pastillero Virtual**: Control de medicamentos con adherencia y alertas
- 📞 **Agenda de Contactos**: Directorio de médicos, emergencias y servicios
- 📅 **Calendario de Eventos**: Gestión de citas médicas y actividades
- 📦 **Control de Inventarios**: Sistema dual (operativo/maestro) de suministros
- 👥 **Gestión de Turnos**: Control de horarios y entrega de turno de cuidadores
- 🍽️ **Menú de Alimentación**: Planificación nutricional con restricciones
- 📊 **Reportes y Analytics**: Gráficas de tendencias de salud exportables

## 🚀 Stack Tecnológico

- **Frontend**: Vite + React 18 + TypeScript
- **Estilos**: TailwindCSS
- **Estado**: Zustand
- **Routing**: React Router DOM
- **Backend**: Firebase
  - Authentication
  - Firestore Database
  - Storage
  - Cloud Messaging (FCM)
  - Hosting

## 📁 Estructura del Proyecto

```
mama-yola/
├── src/
│   ├── components/       # Componentes React
│   │   ├── common/      # Componentes reutilizables
│   │   └── modules/     # Componentes por módulo
│   ├── pages/           # Páginas/vistas principales
│   ├── hooks/           # Custom React hooks
│   ├── services/        # Servicios (Firebase, API calls)
│   ├── context/         # Context providers
│   ├── types/           # TypeScript types & interfaces
│   ├── utils/           # Utilidades y helpers
│   ├── config/          # Configuraciones (Firebase, etc.)
│   └── assets/          # Imágenes, iconos, etc.
├── public/              # Archivos estáticos
├── prd.md              # Product Requirements Document
├── roadmap.md          # Roadmap de implementación
└── README.md           # Este archivo
```

## 🛠️ Instalación y Configuración

### Requisitos Previos

- Node.js 18+ y npm
- Cuenta de Firebase (gratuita)
- Git

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd mama-yola
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Crea un nuevo proyecto
3. Habilita los siguientes servicios:
   - **Authentication** → Email/Password
   - **Firestore Database** → Modo producción
   - **Storage** → Modo producción
   - **Cloud Messaging** (para notificaciones push)
4. En Project Settings > General > Your apps:
   - Registra una aplicación web
   - Copia la configuración de Firebase

### 4. Variables de Entorno

Copia el archivo de ejemplo y configura tus credenciales:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de Firebase:

```env
VITE_FIREBASE_API_KEY=tu-api-key-aqui
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
VITE_FIREBASE_APP_ID=tu-app-id
```

### 5. Configurar Firestore Security Rules

En Firebase Console > Firestore Database > Rules, pega las reglas de seguridad del archivo `roadmap.md` sección "Fase 0.3".

### 6. Ejecutar en desarrollo

```bash
npm run dev
```

El proyecto estará disponible en `http://localhost:5173`

## 📜 Scripts Disponibles

```bash
npm run dev        # Inicia servidor de desarrollo
npm run build      # Compila para producción
npm run preview    # Preview del build de producción
npm run lint       # Ejecuta ESLint
```

## 🎯 Roadmap de Desarrollo

El proyecto se desarrolla en 7 fases (ver `roadmap.md` para detalle completo):

### ✅ Fase 0: Setup y Fundaciones (1 semana) - **COMPLETADA**
- Proyecto Vite + React + TypeScript inicializado
- Estructura de carpetas creada
- Firebase configurado
- Tipos TypeScript base creados
- TailwindCSS configurado

### 📍 Fase 1: MVP Core - Chequeo Diario (4 semanas) - **SIGUIENTE**
- Sistema de autenticación
- Gestión de usuarios y roles
- Dashboard por rol
- Registro de signos vitales
- Chequeo diario completo
- Sistema de alertas
- Exportar a PDF

### Fases Futuras
- **Fase 2**: Pastillero Virtual (3 semanas)
- **Fase 3**: Contactos + Calendario (3 semanas)
- **Fase 4**: Inventarios (2 semanas)
- **Fase 5**: Operación Diaria (2 semanas)
- **Fase 6**: Menú + Analytics (2 semanas)
- **Fase 7**: Refinamiento (1 semana)

**Duración total estimada**: 17 semanas (4.5 meses)

## 👥 Roles del Sistema

| Rol | Permisos | Responsabilidades |
|-----|----------|-------------------|
| **Familiar (Admin)** | Control total | Gestión de usuarios, configuración, supervisión general |
| **Supervisor** | Lectura completa, edición limitada | Revisión de actividades, validación de registros |
| **Cuidador** | Lectura y edición operativa | Registro diario de actividades, medicamentos, chequeos |

## 🔐 Seguridad

- Autenticación con Firebase Auth
- Firestore Security Rules por rol
- Todas las acciones auditadas
- Datos sensibles encriptados
- Variables de entorno para credenciales

## 📱 Funcionalidades Principales (Planificadas)

### 1. Chequeo Diario (Fase 1)
Registro completo del estado del paciente:
- Signos vitales con alertas automáticas
- Estado general y ánimo
- Alimentación real consumida
- Funciones corporales
- Actividades realizadas
- Medicación
- Incidentes
- Resumen del día

### 2. Pastillero Virtual (Fase 2)
- Configuración de medicamentos y horarios
- Notificaciones 15 min antes de cada dosis
- Registro de administración (tomado/rechazado/omitido)
- Dashboard de adherencia
- Alertas de dosis omitidas

### 3. Agenda de Contactos (Fase 3)
- Directorio completo (médicos, emergencias, servicios)
- Click-to-call, email y mapas
- Historial de interacciones

### 4. Calendario de Eventos (Fase 3)
- Gestión de citas médicas completas (pre/durante/post)
- Checklist de preparación
- Registro de resultados
- Integración con pastillero

### 5. Inventarios (Fase 4)
- Sistema dual: operativo y maestro
- Alertas de nivel bajo
- Transferencias automáticas
- Vinculación con pastillero

### 6. Turnos de Cuidadores (Fase 5)
- Check-in/out con GPS
- Entrega de turno estructurada
- Reporte de horas

### 7. Menú de Comida (Fase 6)
- Planificación con restricciones dietéticas
- Registro de consumo real
- Análisis nutricional

### 8. Reportes y Analytics (Fase 6)
- Gráficas de tendencias de signos vitales
- Reporte médico exportable
- Dashboard de métricas

## 📊 Métricas de Éxito (Objetivos)

- Adherencia a medicamentos > 95%
- 100% chequeos diarios completados
- Tiempo de registro de chequeo < 10 min
- Detección de alertas en < 5 min
- Reducción 90% uso de WhatsApp para reportes

## 🤝 Contribución

Este es un proyecto privado para uso interno. Para cambios:

1. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
2. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
3. Push a la rama (`git push origin feature/nueva-funcionalidad`)
4. Abre un Pull Request

## 📝 Documentación Adicional

- `prd.md` - Product Requirements Document completo
- `roadmap.md` - Roadmap detallado de implementación por fases

## 🐛 Reporte de Bugs

Para reportar bugs, crea un issue en el repositorio con:
- Descripción del problema
- Pasos para reproducir
- Comportamiento esperado vs actual
- Screenshots si aplica
- Versión del navegador

## 📄 Licencia

Uso privado - Todos los derechos reservados

## 📧 Contacto

Para preguntas o soporte, contacta al equipo de desarrollo.

---

**Fase actual**: Fase 0 ✅ (Setup completado)
**Siguiente fase**: Fase 1 - MVP Core (Chequeo Diario)
**Fecha de inicio**: 2025-11-20
