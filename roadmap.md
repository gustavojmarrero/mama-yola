# 🗺️ ROADMAP DE IMPLEMENTACIÓN
## Sistema de Gestión de Cuidado de Adultos Mayores

---

## 📐 **PRINCIPIOS DEL ROADMAP**

1. **MVP Minimalista**: Lanzar rápido con lo esencial
2. **Validación Continua**: Probar con usuarios reales entre fases
3. **Valor Incremental**: Cada fase agrega valor medible
4. **Deuda Técnica Controlada**: No sacrificar calidad por velocidad

---

## 🎯 **OBJETIVOS POR FASE**

| Fase | Objetivo | Duración | Acumulado |
|------|----------|----------|-----------|
| **0. Setup** | Infraestructura base lista | 1 semana | 1 sem |
| **1. MVP Core** | Reemplazar reportes WhatsApp | 4 semanas | 5 sem |
| **2. Pastillero** | Control total de medicamentos | 3 semanas | 8 sem |
| **3. Contactos + Eventos** | Agenda médica centralizada | 3 semanas | 11 sem |
| **4. Inventarios** | Control de suministros | 2 semanas | 13 sem |
| **5. Operación Diaria** | Gestión de cuidadores | 2 semanas | 15 sem |
| **6. Menú + Analytics** | Nutrición y reportes | 2 semanas | 17 sem |
| **7. Refinamiento** | Pulir y optimizar | 1 semana | 18 sem |

**Total estimado: 18 semanas (4.5 meses)**

---

# 🚀 **FASE 0: SETUP Y FUNDACIONES**
**Duración: 1 semana**
**Objetivo**: Tener el entorno listo para desarrollar

## 📋 **Tareas**

### **0.1 Setup del Proyecto**
- [x] Inicializar proyecto Vite + React + TypeScript
- [ ] Configurar ESLint + Prettier
- [x] Setup TailwindCSS v4
- [x] Configurar estructura de carpetas:
  ```
  /src
    /components
      /common
      /modules
    /pages
    /hooks
    /services
    /context
    /types
    /utils
    /config
  ```

### **0.2 Setup Firebase**
- [x] Crear proyecto en Firebase Console
- [x] Configurar Firebase Authentication (Email/Password)
- [x] Crear base de datos Firestore
- [x] Configurar Firebase Storage
- [x] Instalar Firebase SDK
- [x] Crear archivo `firebase.config.ts`
- [x] Setup variables de entorno (`.env.local`)

### **0.3 Firebase Security Rules (v1 básica)**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserRole(pacienteId) {
      return get(/databases/$(database)/documents/pacientes/$(pacienteId)/usuarios/$(request.auth.uid)).data.rol;
    }

    // Pacientes
    match /pacientes/{pacienteId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && getUserRole(pacienteId) == 'familiar';

      // Usuarios
      match /usuarios/{userId} {
        allow read: if isAuthenticated();
        allow write: if getUserRole(pacienteId) == 'familiar';
      }

      // Chequeos diarios
      match /chequeosDiarios/{chequeoId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated() && getUserRole(pacienteId) in ['cuidador', 'familiar', 'supervisor'];
        allow update: if isAuthenticated() && getUserRole(pacienteId) in ['cuidador', 'familiar', 'supervisor'];
      }

      // Signos vitales
      match /signosVitales/{signoId} {
        allow read: if isAuthenticated();
        allow write: if isAuthenticated();
      }
    }
  }
}
```

### **0.4 Git y Deploy**
- [ ] Inicializar Git
- [ ] Crear repositorio en GitHub/GitLab
- [ ] Setup GitHub Actions o CI/CD básico
- [x] Configurar Firebase Hosting
- [x] Reglas de Firestore deployadas

### **0.5 Tipos TypeScript Base**

```typescript
// types/index.ts
export type Rol = 'familiar' | 'supervisor' | 'cuidador';

export interface Usuario {
  id: string;
  uid: string; // Firebase Auth UID
  nombre: string;
  email: string;
  telefono?: string;
  rol: Rol;
  foto?: string;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface Paciente {
  id: string;
  nombre: string;
  fechaNacimiento: Date;
  foto?: string;
  condicionesMedicas: string[];
  alergias: string[];
  rangoNormalSignosVitales: RangoSignosVitales;
  creadoEn: Date;
}

export interface RangoSignosVitales {
  temperaturaMin: number;
  temperaturaMax: number;
  spo2Min: number;
  frecuenciaCardiacaMin: number;
  frecuenciaCardiacaMax: number;
  presionSistolicaMin: number;
  presionSistolicaMax: number;
  presionDiastolicaMin: number;
  presionDiastolicaMax: number;
}
```

## ✅ **Criterios de Éxito Fase 0**
- ✅ Proyecto corre en local (`npm run dev`)
- ✅ Firebase conectado y Auth funciona
- ✅ Deployed en Firebase Hosting
- ✅ Security Rules básicas aplicadas
- ✅ Git configurado con primer commit

---

# ⭐ **FASE 1: MVP CORE - CHEQUEO DIARIO**
**Duración: 4 semanas**
**Objetivo**: Cuidadores pueden registrar el chequeo diario completo, familiares lo ven en tiempo real

## 📋 **Semana 1: Auth + Roles + Dashboard Base**

### **1.1 Sistema de Autenticación**
- [x] Página de Login (email/password)
- [x] Manejo de sesión con Context API
- [x] Protección de rutas (PrivateRoute)
- [x] Logout funcional
- [x] Auto-creación de perfil de usuario en Firestore

### **1.2 Gestión de Usuarios y Roles**
- [x] CRUD de usuarios (solo Familiar puede crear)
- [x] Asignar roles: Familiar, Supervisor, Cuidador
- [x] Lista de usuarios activos
- [x] Persistencia en Firestore: `/usuarios/{id}`
- [x] Layout con sidebar y navegación por roles

### **1.3 Dashboard Base (3 variantes por rol)**

**Dashboard Base:**
- [x] Dashboard básico con información del usuario
- [x] Sistema de navegación con sidebar colapsible
- [ ] "Chequeo de hoy" - botón grande para abrir/continuar
- [ ] Indicador de progreso del chequeo (% completado)
- [ ] Signos vitales del día
- [ ] Diferenciación por roles (pendiente)

### **1.4 Perfil del Paciente (MODIFICADO - Paciente único)**
- [x] Formulario para crear/editar paciente ÚNICO
- [x] Campos: nombre, fecha nacimiento, género, identificación, condiciones médicas, alergias
- [x] Campos adicionales: peso, altura, grupo sanguíneo, nivel dependencia
- [x] Contacto: dirección, teléfono emergencia
- [x] Configurar rangos normales de signos vitales personalizados
- [x] Vista de solo lectura y modo edición
- [x] Agregar/eliminar alergias y condiciones médicas dinámicamente

## 📋 **Semana 2: Signos Vitales + Alertas** ✅ COMPLETADA

### **2.1 Modelo de Datos Signos Vitales**

```typescript
export interface SignoVital {
  id: string;
  pacienteId: string;
  fecha: Date;
  hora: string; // "14:30"
  temperatura?: number; // °C
  spo2?: number; // %
  frecuenciaCardiaca?: number; // lpm
  presionArterialSistolica?: number; // mmHg
  presionArterialDiastolica?: number; // mmHg
  notas?: string;
  fueraDeRango: boolean; // calculado
  alertaGenerada: boolean;
  registradoPor: string; // userId
  creadoEn: Date;
}
```

### **2.2 Formulario de Toma de Signos**
- [x] Input para cada signo vital con validación en tiempo real
- [x] Indicador visual si está fuera de rango (rojo/verde)
- [x] Campo de notas opcional
- [x] Botón "Guardar Signos"
- [x] Permitir múltiples tomas en el día
- [x] Panel lateral con rangos normales del paciente

### **2.3 Sistema de Alertas**
- [x] Función que calcula si signo está fuera de rango
- [x] Si está fuera → Crear notificación en `/notificaciones`
- [x] Validación en tiempo real con feedback visual
- [ ] Mostrar badge en dashboard de Familiar/Supervisor (pendiente)
- [ ] Lista de alertas activas (pendiente)

### **2.4 Historial de Signos Vitales**
- [x] Tabla con todas las mediciones (últimos 30 registros)
- [ ] Filtrar por fecha (pendiente)
- [x] Indicador visual de valores fuera de rango
- [x] Persistencia en subcolección `/pacientes/{id}/signosVitales`

## 📋 **Semana 3: Registro de Chequeo Diario (Parte 1)** ✅ COMPLETADA

### **3.1 Modelo de Datos Chequeo Diario**

```typescript
export interface ChequeoDiario {
  id: string;
  pacienteId: string;
  fecha: Date;
  turno: 'matutino' | 'vespertino' | 'nocturno' | '24hrs';
  cuidadorId: string;
  cuidadorNombre: string;
  horaRegistro: Date;

  // Estado general
  estadoGeneral: {
    actitud: string[]; // ['tranquila', 'activa']
    nivelActividad: string;
    nivelCooperacion: string;
    estadoSueno: string;
    dolor?: {
      nivel: 'sin_dolor' | 'leve' | 'moderado' | 'severo';
      ubicacion?: string;
      descripcion?: string;
    };
    notasGenerales?: string;
  };

  // Alimentación
  alimentacion: {
    kefir?: { hora: string; cantidad: string; notas?: string };
    desayuno?: { descripcion: string; cantidad: string };
    colacion1?: { descripcion: string; cantidad: string };
    almuerzo?: { descripcion: string; cantidad: string };
    colacion2?: { descripcion: string; cantidad: string };
    cena?: { descripcion: string; cantidad: string };
    consumoAguaLitros?: number;
    otrosLiquidos?: string;
    observacionesApetito?: string;
    alimentosRechazados?: string;
  };

  // Funciones corporales
  funcionesCorporales: {
    miccionesNumero: number;
    miccionesCaracteristicas?: string;
    evacuacionesNumero: number;
    evacuacionesConsistencia?: string;
    evacuacionesColor?: string;
    dificultadEvacuar?: boolean;
    laxantesUsados?: Array<{ nombre: string; cantidad: string }>;
  };

  // Actividades realizadas
  actividadesRealizadas: {
    ejerciciosFisioterapia?: Array<{ cual: string; duracion: number }>;
    ejerciciosIntestinales?: { realizado: boolean; descripcion?: string };
    caminatas?: Array<{ tipo: 'matutina' | 'vespertina'; duracion: number }>;
    actividadesRecreativas?: string[];
    actividadesCognitivas?: string[];
    participacionActitud?: string;
  };

  // Medicación
  medicacion: {
    medicacionEnTiempoForma: boolean;
    medicamentosAdicionales?: Array<{ nombre: string; dosis: string; motivo: string; hora: string }>;
    medicamentosRechazados?: Array<{ nombre: string; motivo: string }>;
    observaciones?: string;
  };

  // Incidentes
  incidentes?: Array<{
    tipo: string;
    descripcion: string;
    hora: string;
    accionTomada: string;
    gravedad: 'leve' | 'moderada' | 'grave';
  }>;

  // Resumen
  resumen: {
    resumenGeneral?: string;
    observacionesImportantes?: string;
    recomendacionesSiguienteTurno?: string;
  };

  completado: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}
```

### **3.2 Formulario de Chequeo (Parte 1/2)**
- [x] Layout con formulario extenso
- [x] **Sección 1: Estado General**
  - [x] Multi-select para actitud (tranquila, activa, inquieta, etc.)
  - [x] Selects para nivel actividad, cooperación, sueño
  - [x] Subsección de dolor (nivel, ubicación, descripción)
  - [x] Textarea para notas generales
- [x] **Sección 2: Alimentación Completa**
  - [x] Kefir con hora, cantidad y notas
  - [x] Campos para cada comida (Desayuno, Colaciones, Almuerzo, Cena)
  - [x] Input para agua (litros) y otros líquidos
  - [x] Textareas observaciones y alimentos rechazados
- [x] **Sección 3: Funciones Corporales**
  - [x] Input numérico para micciones y evacuaciones
  - [x] Selects para características (consistencia, color)
  - [x] Checkbox dificultad para evacuar
  - [x] Lista dinámica de laxantes utilizados
- [x] **Secciones 4-7: Actividades, Medicación, Incidentes, Resumen**
  - [x] Estructura de datos implementada
  - [x] Funciones helper para manejo de arrays
  - [x] UI de secciones adicionales completa y funcional

### **3.3 Guardado Automático (Borrador)**
- [x] useEffect que guarda cada 30 segundos automáticamente
- [x] Indicador "Guardando..." / "Guardado ✓" con timestamp
- [x] Campo `completado: false` mientras es borrador
- [x] Detecta chequeo del día actual y permite continuarlo
- [x] Modo solo lectura cuando está completado

## 📋 **Semana 4: Chequeo Diario (Parte 2) + Visualización**

### **4.1 Formulario de Chequeo (Parte 2/2)** ✅ COMPLETADO
- [x] **Sección 4: Actividades Realizadas**
  - [x] Botones multi-select: Fisioterapia, Ejercicios intestinales, Caminatas, etc.
  - [x] Textarea participación/actitud
- [x] **Sección 5: Medicación**
  - [x] Checkbox "Medicación en tiempo y forma"
  - [x] Lista dinámica de medicamentos adicionales (nombre, dosis, motivo, hora)
  - [x] Lista de medicamentos rechazados (nombre, motivo)
  - [x] Textarea observaciones
- [x] **Sección 6: Incidentes**
  - [x] Botón "+ Agregar Incidente"
  - [x] Formulario dinámico: tipo, descripción, hora, acción tomada, gravedad
  - [x] Botón eliminar incidente
- [x] **Sección 7: Resumen**
  - [x] Textarea resumen general
  - [x] Textarea observaciones importantes
  - [x] Textarea recomendaciones siguiente turno
  - [x] **Botones "Guardar Borrador" y "Completar Chequeo"**

### **4.2 Lógica de Completar Chequeo** ✅ COMPLETADO
- [x] Validar secciones obligatorias
- [x] Marcar `completado: true`
- [x] Generar alertas automáticas:
  - [x] No evacuación
  - [x] Consumo agua bajo (< 1.5L)
  - [x] Múltiples incidentes (>= 2)
  - [x] Incidente grave
  - [x] Rechazó múltiples comidas (>= 2)
  - [x] Medicamentos rechazados
- [x] Crear notificación para Familiar/Supervisor

### **4.3 Vista de Chequeo (Lectura)**
- [ ] Diseño tipo "mensaje de WhatsApp"
- [ ] Mostrar todas las secciones organizadas
- [ ] Gráfica embebida de signos vitales del día
- [ ] Timestamp y nombre del cuidador
- [ ] Navegación ← → entre días

### **4.4 Historial de Chequeos** ✅ COMPLETADO
- [x] Lista de chequeos (últimos 30 días)
- [x] Card por día con resumen
- [x] Click para ver detalle
- [x] Filtro por turno/cuidador

### **4.5 Exportar a PDF** ✅ COMPLETADO
- [x] Botón "Exportar PDF"
- [x] Librería: `jsPDF` y `jspdf-autotable`
- [x] PDF con formato legible para médicos
- [ ] Incluir gráficas de signos vitales (pendiente para futuras iteraciones)

## ✅ **Criterios de Éxito Fase 1**
- ✅ Cuidador puede registrar chequeo diario completo en < 10 min
- ✅ Familiar recibe notificación cuando chequeo completado
- ✅ Alertas de signos vitales funcionan
- ✅ Historial de chequeos navegable
- ✅ Exportar a PDF funcional
- ✅ **Validación con 1 familia real durante 1 semana**

---

# 💊 **FASE 2: PASTILLERO VIRTUAL**
**Duración: 3 semanas**
**Objetivo**: Control total de medicamentos con adherencia >95%

## 📋 **Semana 5: Setup Pastillero + CRUD Medicamentos** ✅ COMPLETADA

### **5.1 Modelo de Datos Medicamento** ✅ COMPLETADO

```typescript
export interface Medicamento {
  id: string;
  pacienteId: string;
  nombre: string;
  dosis: string; // "500mg"
  presentacion: string; // "tableta", "jarabe", etc.
  frecuencia: {
    tipo: 'horas' | 'dias_especificos';
    valor: number; // cada 8 horas
    diasSemana?: number[]; // [1,3,5] = lun,mie,vie
  };
  horarios: string[]; // ["08:00", "16:00", "00:00"]
  instrucciones?: string; // "con alimentos"
  foto?: string;
  activo: boolean;
  creadoEn: Date;
}

export interface RegistroMedicamento {
  id: string;
  pacienteId: string;
  medicamentoId: string;
  medicamentoNombre: string;
  fechaHoraProgramada: Date;
  fechaHoraReal?: Date;
  estado: 'pendiente' | 'tomado' | 'rechazado' | 'omitido';
  retrasoMinutos?: number; // calculado
  notas?: string;
  administradoPor?: string; // userId
  creadoEn: Date;
}
```

### **5.2 CRUD Medicamentos** ✅ COMPLETADO
- [x] Lista de medicamentos activos
- [x] Formulario crear medicamento
  - [x] Campos básicos
  - [x] Configuración de frecuencia
  - [x] Múltiples horarios
  - [x] Upload foto (Firebase Storage)
- [x] Editar medicamento
- [x] Desactivar medicamento (no eliminar)
- [x] Página `/medicamentos` con UI completa
- [x] Activar/Desactivar medicamentos
- [x] Filtrado por estado (activo/inactivo)

### **5.3 Generación Automática de Dosis**
- [ ] Cloud Function o script que genera registros diarios
- [ ] Ejecutar cada medianoche
- [ ] Crear registros en `/registroMedicamentos` con estado `pendiente`
- [ ] Calcular horarios según configuración

## 📋 **Semana 6: Registro + Notificaciones** ✅ COMPLETADA (Parcial)

### **6.1 Vista de Medicamentos del Día (Cuidador)** ✅ COMPLETADO
- [x] Lista de medicamentos pendientes HOY
- [x] Ordenados por hora
- [x] Card por medicamento con:
  - [x] Foto
  - [x] Nombre, dosis
  - [x] Hora programada
  - [x] Botones para registrar estado
- [x] Indicador visual si hay retraso (amarillo/rojo)
- [x] Generación automática de dosis del día basada en horarios configurados
- [x] Soporte para frecuencias (cada X horas / días específicos)

### **6.2 Registrar Administración** ✅ COMPLETADO
- [x] Modal al hacer click en medicamento
- [x] Confirmar estado: tomado/rechazado/omitido
- [x] Campo de notas opcional
- [x] Calcular retraso automáticamente
- [x] Guardar timestamp real
- [x] Crear/actualizar registros en Firestore
- [ ] Reducir inventario operativo (si existe) - pendiente para Fase 4

### **6.3 Notificaciones Push (Firebase Cloud Messaging)**
- [ ] Setup FCM en Firebase Console
- [ ] Instalar `firebase/messaging`
- [ ] Solicitar permisos de notificación en el navegador
- [ ] Guardar token FCM por usuario
- [ ] Cloud Function para enviar notificaciones:
  - [ ] 15 min antes de cada dosis
  - [ ] 30 min después si no se registró (alerta de omisión)

### **6.4 Historial de Medicación (Familiar/Supervisor)** ✅ COMPLETADO
- [x] Vista cronológica con registros de últimos 30 días
- [x] Filtro por medicamento
- [x] Filtro por estado
- [x] Indicadores visuales:
  - 🟢 Tomado a tiempo
  - 🟡 Tomado con retraso
  - 🔴 Rechazado
  - 🟠 Omitido
  - ⚪ Pendiente
- [x] Información detallada: hora programada, hora real, retraso, notas

## 📋 **Semana 7: Dashboard de Adherencia** ✅ COMPLETADA

### **7.1 Métricas de Adherencia** ✅ COMPLETADO
- [x] Cálculo de adherencia:
  ```
  Adherencia = (Tomados / (Tomados + Rechazados + Omitidos)) * 100
  ```
- [x] Por medicamento
- [x] Por período (día, semana, mes)
- [x] Gráficas de barras y línea con recharts

### **7.2 Dashboard Pastillero** ✅ COMPLETADO
- [x] Card resumen:
  - [x] Adherencia total
  - [x] Dosis omitidas esta semana
  - [x] Próxima dosis
- [x] Gráfica de distribución (pie chart)
- [x] Gráfica de adherencia por medicamento (bar chart)
- [x] Tendencia de adherencia diaria (line chart)
- [x] Tabla detallada por medicamento
- [x] Filtros por período (semana/mes)
- [x] Página `/adherencia` completa

### **7.3 Integración con Chequeo Diario** ✅ COMPLETADO
- [x] En sección "Medicación" del chequeo:
  - [x] Auto-detectar si todos los medicamentos del día fueron administrados
  - [x] Pre-marcar checkbox "Medicación en tiempo y forma" si 100% adherencia
  - [x] Mostrar lista de medicamentos tomados/rechazados con estados visuales
  - [x] Indicador de adherencia 100% detectada
  - [x] Link al Pastillero Diario para más detalles

## ✅ **Criterios de Éxito Fase 2**
- ✅ Notificaciones push funcionan
- ✅ Adherencia calculada correctamente
- ✅ Cuidador puede registrar medicamento en < 30 seg
- ✅ Historial cronológico completo
- ✅ Integrado con chequeo diario

---

# 📞 **FASE 3: CONTACTOS + CALENDARIO DE EVENTOS**
**Duración: 3 semanas**
**Objetivo**: Agenda médica centralizada con gestión completa de citas

## 📋 **Semana 8: Agenda de Contactos** ✅ COMPLETADA

### **8.1 Modelo de Datos Contacto**

```typescript
export interface Contacto {
  id: string;
  pacienteId: string;
  nombre: string;
  categoria: 'medico' | 'cuidador' | 'familiar' | 'emergencia' | 'servicio' | 'otro';
  especialidad?: string; // para médicos
  cedulaProfesional?: string;
  telefonoPrincipal: string;
  telefonoAlternativo?: string;
  email?: string;
  direccion?: string;
  coordenadas?: { lat: number; lng: number };
  horarioAtencion?: string;
  consultorioHospital?: string;
  segurosAcepta?: string[];
  notas?: string;
  favorito: boolean;
  foto?: string;
  activo: boolean;
  creadoEn: Date;
}
```

### **8.2 CRUD Contactos** ✅ COMPLETADO
- [x] Lista de contactos
- [x] Filtros por categoría
- [x] Búsqueda por nombre
- [x] Formulario crear/editar contacto (todos los campos)
- [x] Upload foto
- [x] Marcar/desmarcar favorito

### **8.3 Funcionalidades** ✅ COMPLETADO
- [x] Click-to-call (link `tel:`)
- [x] Click-to-email (link `mailto:`)
- [x] Ver en mapa (Google Maps link si tiene coordenadas)
- [x] Lista de favoritos implementada (filtro en página principal)

## 📋 **Semana 9: Calendario de Eventos (Parte 1)** ✅ COMPLETADA

### **9.1 Modelo de Datos Evento**

```typescript
export interface Evento {
  id: string;
  pacienteId: string;
  titulo: string;
  tipo: 'cita_medica' | 'estudio' | 'terapia' | 'visita' | 'evento_social' | 'tramite' | 'otro';
  subtipo?: string;
  fechaInicio: Date;
  fechaFin: Date;
  ubicacion?: string;
  coordenadas?: { lat: number; lng: number };
  contactoId?: string; // vinculado a agenda
  contactoNombre?: string;
  descripcion?: string;
  motivoConsulta?: string;
  preparacion?: Array<{ item: string; completado: boolean }>;
  recordatorios: string[]; // ["1week", "1day", "2hours"]
  transporte?: string;
  acompanante?: string; // userId
  estado: 'programada' | 'confirmada' | 'en_curso' | 'completada' | 'cancelada' | 'reprogramada';
  confirmadoPor?: string;
  confirmadoEn?: Date;

  // Post-evento
  asistio?: boolean;
  horaLlegada?: Date;
  horaSalida?: Date;
  resultados?: string;
  diagnostico?: string;
  indicaciones?: string;
  recetaNueva?: boolean;
  cambioTratamiento?: boolean;
  proximaCita?: Date;
  costoConsulta?: number;

  creadoPor: string;
  creadoEn: Date;
  actualizadoEn: Date;
}
```

### **9.2 CRUD Eventos** ✅ COMPLETADO
- [x] Formulario crear evento
  - [x] Selector de tipo/subtipo
  - [x] Date/time pickers
  - [x] Selector de contacto (desde agenda)
  - [x] Auto-completar datos del contacto
  - [x] Checklist de preparación (agregar items)
  - [x] Configurar recordatorios
- [x] Editar evento
- [x] Cancelar/Reprogramar evento

### **9.3 Vista de Calendario** ✅ COMPLETADO
- [x] Integrar librería: `react-big-calendar`
- [x] Vista mensual (grid)
- [x] Color-coding por tipo de evento
- [x] Click en evento → Modal con detalles
- [x] Selector de slots para crear eventos rápidamente
- [x] Navegación por mes/semana/día
- [x] Localización en español

## 📋 **Semana 10: Eventos (Parte 2) + Integración** ✅ COMPLETADA (Parcial)

### **10.1 Flujo Pre-Evento** ✅ COMPLETADO
- [x] Lista de "Próximas Citas" en dashboard
- [x] Botón "Confirmar Cita" (cambia estado)
- [x] Checklist de preparación:
  - [x] Mostrar items pendientes
  - [x] Marcar como completado desde Dashboard
  - [x] Vista completa en modal de eventos

### **10.2 Flujo Día de la Cita** (Pendiente para iteración futura)
- [ ] Notificaciones automáticas (2hrs antes) - Requiere FCM
- [ ] Botón "Marcar Salida"
- [ ] Botón "Marcar Llegada" (registra hora)
- [ ] Durante: Agregar notas

### **10.3 Flujo Post-Evento** (Pendiente para iteración futura)
- [ ] Formulario post-cita:
  - [ ] ¿Asistió?
  - [ ] Horas real llegada/salida
  - [ ] Resultados, diagnóstico, indicaciones
  - [ ] Checkboxes: receta nueva, cambio tratamiento
  - [ ] Próxima cita (crear automáticamente)
  - [ ] Costo
  - [ ] Upload documentos (recetas, estudios)
- [ ] Guardar en Firestore
- [ ] Marcar evento como "Completado"

### **10.4 Integración Contactos ↔️ Eventos** ✅ COMPLETADO
- [x] Selector de contacto muestra todos los contactos con categoría
- [x] Auto-completar dirección del consultorio
- [x] Auto-completar coordenadas GPS
- [x] Vinculación bidireccional entre contactos y eventos

### **10.5 Integración Eventos → Pastillero** (Pendiente para iteración futura)
- [ ] Al completar cita: "¿Hubo cambio de medicamento?"
- [ ] Si sí → Botón "Actualizar Pastillero"
- [ ] Modal para desactivar medicamento viejo y crear nuevo

## ✅ **Criterios de Éxito Fase 3**
- ✅ Agenda de contactos completa y usable
- ✅ Calendario muestra todos los eventos
- ✅ Flujo completo de cita: pre → durante → post
- ✅ Notificaciones de citas funcionan
- ✅ Integración contactos ↔️ eventos fluida

---

# 📦 **FASE 4: SISTEMA DE INVENTARIOS**
**Duración: 2 semanas**
**Objetivo**: Control de suministros con inventario dual

## 📋 **Semana 11: Inventarios Operativo y Maestro** ✅ COMPLETADA

### **11.1 Modelo de Datos Inventario** ✅ COMPLETADO

```typescript
export interface ItemInventario {
  id: string;
  pacienteId: string;
  nombre: string;
  tipo: 'operativo' | 'maestro';
  categoria: 'medicamento' | 'material' | 'consumible';

  // Para medicamentos
  presentacion?: string;
  fechaVencimiento?: Date;
  lote?: string;
  vinculadoPastillero?: boolean;
  medicamentoId?: string; // si está vinculado

  // Para materiales
  estado?: 'disponible' | 'en_uso' | 'mantenimiento' | 'extraviado';
  ultimaRevision?: Date;

  // Comunes
  cantidad: number;
  unidad: string; // "piezas", "ml", "cajas"
  nivelMinimo: number;
  ubicacion?: string;
  costo?: number;
  proveedor?: string;
  notas?: string;

  creadoEn: Date;
  actualizadoEn: Date;
}
```

### **11.2 CRUD Inventarios** ✅ COMPLETADO
- [x] Vista con tabs: "Operativo" | "Maestro"
- [x] Filtro por categoría
- [x] Lista de items con indicadores:
  - 🔴 Crítico (0 unidades o vencido)
  - 🟡 Bajo (< nivel mínimo)
  - 🟠 Por vencer (< 30 días)
  - 🟢 OK
- [x] Formulario crear/editar item
- [x] Validación: no permitir cantidad negativa

### **11.3 Vinculación Pastillero ↔️ Inventario** (Pendiente para iteración futura)
- [ ] Al crear medicamento en pastillero:
  - [ ] Checkbox "Agregar a inventario"
  - [ ] Si sí → Crear automáticamente en inventario operativo
- [ ] Al registrar administración de medicamento:
  - [ ] Reducir cantidad en inventario operativo (-1)
  - [ ] Si llega a nivel mínimo → Generar alerta

## 📋 **Semana 12: Movimientos + Alertas** ✅ COMPLETADA

### **12.1 Modelo de Datos Movimiento** ✅ COMPLETADO

```typescript
export interface MovimientoInventario {
  id: string;
  pacienteId: string;
  tipo: 'entrada' | 'salida' | 'transferencia' | 'ajuste';
  itemId: string;
  itemNombre: string;
  origen?: 'maestro' | 'operativo' | 'externo';
  destino?: 'maestro' | 'operativo' | 'consumido';
  cantidad: number;
  motivo?: string;
  usuarioId: string;
  usuarioNombre: string;
  fecha: Date;
  notas?: string;
  creadoEn: Date;
}
```

### **12.2 Registrar Movimientos** ✅ COMPLETADO
- [x] Botón "Transferir de Maestro → Operativo"
  - [x] Modal: Seleccionar item, cantidad
  - [x] Validar que hay suficiente en maestro
  - [x] Reducir de maestro, aumentar en operativo
  - [x] Crear registro de movimiento
- [x] Botón "Registrar Consumo"
  - [x] Reducir de operativo
  - [x] Crear movimiento tipo "salida"
- [x] Botón "Nueva Compra"
  - [x] Aumentar maestro
  - [x] Crear movimiento tipo "entrada"
- [x] Historial de movimientos (tabla/modal)

### **12.3 Alertas de Inventario** ✅ COMPLETADO
- [x] Dashboard de alertas:
  - [x] Items críticos (0 unidades o vencidos)
  - [x] Items bajos (< nivel mínimo)
  - [x] Por vencer (< 30 días)
  - [ ] Reabastecimiento sugerido (según consumo promedio) - Pendiente
- [ ] Notificación a Familiar cuando inventario operativo bajo - Requiere FCM
- [ ] Badge en sidebar con número de alertas - Pendiente

### **12.4 Reportes de Inventario** (Pendiente para iteración futura)
- [ ] Reporte de consumo mensual por categoría
- [ ] Lista de compras (items críticos/bajos)
- [ ] Exportar a Excel/CSV

## ✅ **Criterios de Éxito Fase 4**
- ✅ Inventario dual funciona correctamente
- ✅ Transferencias maestro → operativo fluidas
- ✅ Reducción automática al administrar medicamento
- ✅ Alertas de nivel bajo funcionan
- ✅ Historial de movimientos completo

---

# 👥 **FASE 5: OPERACIÓN DIARIA - TURNOS + ACTIVIDADES**
**Duración: 2 semanas**
**Objetivo**: Gestión de cuidadores y actividades del paciente

## 📋 **Semana 13: Horario de Cuidadores** ✅ COMPLETADA

### **13.1 Modelo de Datos Turno** ✅ COMPLETADO

```typescript
export interface Turno {
  id: string;
  pacienteId: string;
  cuidadorId: string;
  cuidadorNombre: string;
  fecha: Date;
  horaEntradaProgramada: string; // "07:00"
  horaSalidaProgramada: string; // "19:00"
  tipoTurno: 'matutino' | 'vespertino' | 'nocturno' | '24hrs' | 'especial';
  duracionHoras: number;
  estado: 'programado' | 'confirmado' | 'activo' | 'completado' | 'cancelado';

  // Registro real
  horaEntradaReal?: Date;
  horaSalidaReal?: Date;
  horasReales?: number;
  retrasoMinutos?: number;

  // Entrega de turno
  notasEntrada?: string;
  notasSalida?: string;
  novedades?: Array<{
    tipo: string;
    descripcion: string;
    hora: string;
    gravedad: 'leve' | 'moderada' | 'grave';
  }>;
  tareasCompletadas?: Array<{ tarea: string; completado: boolean }>;

  creadoEn: Date;
}
```

### **13.2 CRUD Turnos** ✅ COMPLETADO
- [x] Calendario semanal con vista de turnos
- [x] Crear turno individual o patrón recurrente
- [x] Asignar cuidador (desde lista de usuarios rol=cuidador)
- [ ] Detectar conflictos de horario - Pendiente
- [x] Editar/Cancelar turno

### **13.3 Check-in / Check-out** ✅ COMPLETADO
- [x] Botón "Iniciar Turno" (check-in)
  - [x] Registrar hora real
  - [ ] Solicitar permisos de ubicación GPS (opcional) - Pendiente
  - [x] Cambiar estado a "activo"
- [x] Botón "Finalizar Turno" (check-out)
  - [x] Registrar hora salida
  - [x] Calcular horas trabajadas
  - [x] Abrir formulario de entrega de turno
  - [x] Cambiar estado a "completado"

### **13.4 Entrega de Turno** ✅ COMPLETADO
- [x] Formulario con:
  - [x] Notas de salida (textarea)
  - [x] Lista de novedades
  - [x] Checklist de tareas
  - [ ] Guardar y notificar al siguiente cuidador - Requiere FCM

## 📋 **Semana 14: Actividades + Reportes de Horas** ✅ COMPLETADA

### **14.1 Modelo de Datos Actividad** ✅ COMPLETADO

```typescript
export interface Actividad {
  id: string;
  pacienteId: string;
  nombre: string;
  tipo: 'salida' | 'recreativa' | 'terapeutica' | 'social' | 'cognitiva' | 'fisica';
  fechaInicio: Date;
  fechaFin: Date;
  duracion: number; // minutos
  ubicacion?: string;
  descripcion?: string;
  materialesNecesarios?: string[];
  responsable?: string; // userId
  estado: 'programada' | 'en_progreso' | 'completada' | 'cancelada';
  motivoCancelacion?: string;
  nivelEnergia: 'bajo' | 'medio' | 'alto';

  // Post-actividad
  completadaPor?: string;
  horaInicioReal?: Date;
  horaFinReal?: Date;
  participacion?: 'activa' | 'pasiva' | 'minima';
  estadoAnimo?: string;
  notas?: string;
  fotos?: string[]; // URLs Firebase Storage

  frecuencia?: {
    tipo: 'unica' | 'diaria' | 'semanal' | 'mensual';
    diasSemana?: number[];
  };

  creadoEn: Date;
}
```

### **14.2 CRUD Actividades** ✅ COMPLETADO
- [x] Lista de actividades del día
- [x] Calendario semanal de actividades
- [x] Crear actividad única o recurrente
- [x] Plantillas de actividades frecuentes
- [x] Editar/Cancelar actividad

### **14.3 Registrar Actividad Completada** ✅ COMPLETADO
- [x] Botón "Iniciar Actividad"
- [x] Botón "Completar Actividad"
  - [x] Formulario post-actividad (participación, estado de ánimo, notas)
  - [ ] Upload múltiples fotos - Pendiente
  - [x] Guardar

### **14.4 Integración con Chequeo Diario** (Pendiente para iteración futura)
- [ ] En sección "Actividades" del chequeo:
  - [ ] Mostrar actividades programadas del día
  - [ ] Auto-llenar con actividades completadas
  - [ ] Permitir agregar actividades no programadas

### **14.5 Reporte de Horas (Cuidadores)** ✅ COMPLETADO
- [x] Vista de horas trabajadas por cuidador
- [x] Filtro por período (semana)
- [x] Tabla con: cuidador, turnos, horas programadas, horas reales, diferencia
- [x] Total de horas
- [ ] Exportar a Excel para nómina - Pendiente

## ✅ **Criterios de Éxito Fase 5**
- ✅ Check-in/out funciona correctamente
- ✅ Entrega de turno estructurada
- ✅ Reporte de horas exportable
- ✅ Actividades se registran fácilmente
- ✅ Integración con chequeo diario

---

# 🍽️ **FASE 6: MENÚ DE COMIDA + ANALYTICS**
**Duración: 2 semanas**
**Objetivo**: Planificación nutricional y reportes avanzados

## 📋 **Semana 15: Menú de Comida** ✅ COMPLETADA

### **15.1 Modelo de Datos Menú** ✅ COMPLETADO

```typescript
export interface ComidaProgramada {
  id: string;
  pacienteId: string;
  fecha: Date;
  tipoComida: 'desayuno' | 'colacion1' | 'comida' | 'colacion2' | 'cena';
  horaProgramada: string;

  platillo: string;
  categoria: 'entrada' | 'plato_fuerte' | 'postre' | 'bebida' | 'snack';
  ingredientes?: string[];
  valorNutricional?: {
    calorias: number;
    proteinas: number;
    carbohidratos: number;
    grasas: number;
    fibra?: number;
    sodio?: number;
  };
  instruccionesPreparacion?: string;
  recetaId?: string; // vinculado a banco de recetas

  // Servido
  preparadoPor?: string;
  horaServida?: Date;
  temperaturaAdecuada?: boolean;
  foto?: string;

  // Consumo
  nivelConsumo?: 'todo' | 'mayor_parte' | 'mitad' | 'poco' | 'nada';
  porcentajeConsumido?: number;
  motivoRechazo?: string;
  notasConsumo?: string;
  satisfaccion?: number; // 1-5

  creadoEn: Date;
}

export interface RestriccionDietetica {
  pacienteId: string;
  condiciones: string[]; // ['diabetes', 'hipertension']
  alergias: string[];
  texturaRequerida: 'normal' | 'blanda' | 'molida' | 'licuada';
  restriccionLiquidos: boolean;
  maximoLiquidosMl?: number;
  alimentosEvitar: string[];
  alimentosConsumir: string[];
  suplementos?: Array<{ nombre: string; horario: string; cantidad: string }>;
}
```

### **15.2 Configurar Restricciones (Familiar)** (Pendiente para iteración futura)
- [ ] Formulario en perfil de paciente
- [ ] Multi-selects para condiciones, alergias
- [ ] Listas de alimentos evitar/consumir
- [ ] Suplementos
- [ ] Guardar en documento `/pacientes/{id}`

### **15.3 CRUD Menú** ✅ COMPLETADO
- [x] Planificación semanal (calendario tipo grid)
- [x] Crear comida programada por día
- [x] Selector de tipo de comida
- [x] Formulario: platillo, ingredientes, valor nutricional
- [x] Selector de receta (desde banco)

### **15.4 Banco de Recetas** ✅ COMPLETADO
- [x] Lista de recetas favoritas
- [x] Crear recetas base automáticamente
- [x] Etiquetar: "desayuno", "proteína", "bajo_sodio", etc.
- [x] Buscar/filtrar por etiquetas
- [x] Click en receta → Agregar a menú

## 📋 **Semana 16: Registro de Consumo + Analytics** ✅ COMPLETADA

### **16.1 Registrar Consumo (Cuidador)** ✅ COMPLETADO
- [x] Vista de menú del día
- [x] Botón "Registrar Consumo" → Registrar hora servida
  - [x] Select nivel de consumo (todo, mayor parte, mitad, poco, nada)
  - [x] Campo motivo rechazo
  - [x] Notas
  - [x] Estrellas satisfacción
- [ ] Foto de platillo - Pendiente

### **16.2 Integración con Chequeo Diario** (Pendiente para iteración futura)
- [ ] En sección "Alimentación" del chequeo:
  - [ ] Mostrar menú programado del día
  - [ ] Auto-llenar con consumo registrado
  - [ ] Permitir override manual

### **16.3 Análisis Nutricional** ✅ COMPLETADO (Parcial)
- [x] Dashboard nutricional:
  - [x] Calorías consumidas (semana)
  - [x] Promedio de consumo
  - [x] Distribución por nivel de consumo
  - [ ] Balance de macronutrientes (gráfica de dona) - Pendiente
  - [ ] Ingesta de líquidos (vs máximo permitido) - Pendiente
- [ ] Historial de aceptación - Pendiente para iteración futura

### **16.4 Analytics y Reportes Avanzados** ✅ COMPLETADO
- [x] **Dashboard de Métricas (Familiar)**:
  - [x] Adherencia a medicamentos (%)
  - [x] Chequeos completados (período)
  - [x] Tendencias de signos vitales (gráficas últimos 7/14/30 días)
  - [x] Patrón de evacuaciones (gráfica de barras)
  - [x] Consumo de agua (gráfica de área)
  - [x] Resumen de alertas
  - [x] Conteo de incidentes
- [ ] **Reporte Médico Exportable** - Pendiente para iteración futura:
  - [ ] Exportar a PDF profesional

### **16.5 Gráficas de Tendencias de Salud** ✅ COMPLETADO
- [x] Librería: `recharts`
- [x] Gráfica de presión arterial (área, últimos 30 días)
- [x] Gráfica de SpO2 y FC (línea combinada)
- [x] Gráfica de temperatura (línea con referencias)
- [x] Filtros por rango de fechas (7, 14, 30 días)
- [x] Líneas de referencia (rango normal)

## ✅ **Criterios de Éxito Fase 6**
- ✅ Menú semanal planificable
- ✅ Registro de consumo integrado con chequeo diario
- ✅ Análisis nutricional funcional
- ✅ Dashboard de métricas completo
- ✅ Reporte médico exportable

---

# 🔧 **FASE 7: REFINAMIENTO Y PULIDO**
**Duración: 1 semana**
**Objetivo**: Optimizar, corregir bugs, mejorar UX

## 📋 **Semana 17: Optimización Final** ✅ COMPLETADA (Parcial)

### **17.1 Testing Completo**
- [ ] Test de cada módulo con datos reales
- [ ] Test de integración entre módulos
- [ ] Test de notificaciones en dispositivos reales
- [ ] Test de permisos por rol
- [ ] Test de performance (tiempos de carga)

### **17.2 Corrección de Bugs**
- [ ] Revisar issues reportados en validaciones
- [ ] Corregir bugs críticos
- [ ] Corregir bugs menores

### **17.3 Mejoras de UX** ✅ COMPLETADO
- [ ] Optimizar flujos más usados
- [ ] Mejorar tiempos de carga (lazy loading, code splitting)
- [x] Añadir skeletons/loaders (Skeleton components para Dashboard, Cards, Tables, Charts)
- [x] Mejorar mensajes de error (ErrorBoundary global + ToastContext)
- [x] Añadir tooltips explicativos (Dashboard con métricas e indicadores)
- [x] Responsive design (mobile-first) (Dashboard y páginas principales optimizadas)

### **17.4 Documentación**
- [ ] Guía de usuario por rol (PDF/video)
- [ ] FAQ
- [ ] Troubleshooting común

### **17.5 Preparar Lanzamiento**
- [ ] Configurar dominio custom (Firebase Hosting)
- [ ] Setup SSL
- [ ] Configurar backups automáticos (Firestore)
- [ ] Plan de recuperación ante desastres
- [ ] Monitoring (Firebase Analytics, Crashlytics)

## ✅ **Criterios de Éxito Fase 7**
- ✅ 0 bugs críticos
- ✅ Performance óptimo (< 3s carga inicial)
- ✅ Responsive en mobile
- ✅ Documentación lista
- ✅ **Listo para lanzamiento**

---

# 📊 **RESUMEN EJECUTIVO DEL ROADMAP**

## **Tiempo Total: 17 semanas (4.25 meses)**

### **Hitos Clave**

| Semana | Hito | Entregable |
|--------|------|------------|
| **1** | ✅ Setup completo | Proyecto funcional en Firebase Hosting |
| **4** | 🎯 **MVP Funcional** | Chequeo diario completo + signos vitales + alertas |
| **7** | 💊 **Pastillero Completo** | Control de medicamentos + notificaciones |
| **10** | 📞 **Agenda Médica** | Contactos + calendario + gestión de citas |
| **12** | 📦 **Inventarios** | Control dual de suministros |
| **14** | 👥 **Operación Diaria** | Turnos + actividades |
| **16** | 🍽️ **Menú + Analytics** | Planificación nutricional + reportes avanzados |
| **17** | 🚀 **Lanzamiento** | Sistema completo y pulido |

---

## **Priorización y Dependencias**

**Dependencias críticas**:
- Fase 2 depende de Fase 1 (notificaciones)
- Fase 4 depende de Fase 2 (vinculación pastillero-inventario)
- Fase 6 depende de todas las anteriores (analytics integrados)

---

## **Recursos Necesarios**

### **Equipo Sugerido**
- 1 Full-Stack Developer (React + Firebase)
- 1 UI/UX Designer (para mockups en Fase 0-1)
- 1 Tester / Product Owner (familia real para validaciones)

### **Herramientas**
- **Diseño**: Figma
- **Gestión**: Notion, Linear, Jira
- **Código**: VSCode, GitHub
- **Deploy**: Firebase Hosting
- **Monitoreo**: Firebase Analytics, Sentry

### **Costos Estimados (Firebase)**
- **Desarrollo** (bajo tráfico): ~$0-25/mes
- **Producción** (1 paciente, 3-5 usuarios): ~$25-50/mes
  - Firestore: ~1M reads/mes
  - Storage: ~2GB
  - Hosting: ~10GB/mes
  - FCM: gratuito

---

## **Plan de Validación**

### **Validación MVP (Semana 5)**
- Probar con 1 familia real durante 1 semana
- Métricas:
  - ✅ ¿Se completaron 100% chequeos diarios?
  - ✅ ¿Tiempo de registro < 10 min?
  - ✅ ¿Alertas funcionaron correctamente?
  - ✅ ¿Se exportó PDF exitosamente?
- **DECISIÓN**: ¿Continuar o iterar en MVP?

### **Validación Completa (Semana 16)**
- Probar sistema completo durante 2 semanas
- Métricas de éxito (del PRD):
  - Adherencia medicamentos > 95%
  - 100% chequeos diarios completados
  - Tiempo registro < 10 min
  - Detección alertas < 5 min
  - Reducción 90% uso WhatsApp

---

## **Riesgos y Mitigación**

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Alcance MVP muy grande | Alta | Alto | Reducir a chequeo diario + signos vitales solo |
| Notificaciones no funcionan | Media | Crítico | Testear FCM desde Fase 1, tener fallback |
| Offline sync falla | Media | Alto | Testear con conexión inestable, logs detallados |
| Firebase Rules inseguras | Media | Crítico | Review exhaustivo, testear con múltiples roles |
| Usuarios no adoptan | Media | Crítico | Onboarding cuidadoso, videos tutoriales |

---

## 🎯 **PRÓXIMOS PASOS**

### **Fase 0 - Checklist de Inicio**

1. **Crear proyecto Vite**
   ```bash
   npm create vite@latest mama-yola -- --template react-ts
   cd mama-yola
   npm install
   ```

2. **Instalar dependencias base**
   ```bash
   npm install firebase
   npm install -D tailwindcss postcss autoprefixer
   npm install react-router-dom
   npm install zustand # para state management
   ```

3. **Configurar Firebase**
   - Ir a [Firebase Console](https://console.firebase.google.com)
   - Crear nuevo proyecto
   - Habilitar Authentication (Email/Password)
   - Crear Firestore Database
   - Configurar Storage
   - Copiar config y crear `src/config/firebase.ts`

4. **Estructura inicial**
   - Crear carpetas según estructura propuesta
   - Setup `.env.local` con credenciales Firebase
   - Configurar `.gitignore`

5. **Primer deploy**
   ```bash
   npm run build
   firebase init hosting
   firebase deploy
   ```

---

**Documento completo del roadmap de implementación**
**Fecha**: 2025-11-20
**Versión**: 1.0
