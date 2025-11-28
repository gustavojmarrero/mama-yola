# Manejo de Timestamps

## Tipos de Timestamp

### `serverTimestamp()` - Tiempo del Servidor (SIEMPRE USAR ESTE)

```typescript
import { serverTimestamp, Timestamp } from 'firebase/firestore';

// Crear documento
await addDoc(collection(db, 'posts'), {
  title: 'Mi Post',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});

// Actualizar documento
await updateDoc(doc(db, 'posts', postId), {
  updatedAt: serverTimestamp()
});
```

### `Timestamp.fromDate()` - Para Fechas Específicas

```typescript
import { Timestamp } from 'firebase/firestore';

// Fecha específica (cumpleaños, eventos, etc.)
const eventDate = Timestamp.fromDate(new Date('2024-12-25'));

await setDoc(doc(db, 'events', eventId), {
  date: eventDate,
  createdAt: serverTimestamp()
});
```

### `toDate()` - Convertir Timestamp a JavaScript Date

```typescript
const docSnap = await getDoc(doc(db, 'posts', postId));
const data = docSnap.data();

// Convertir a Date
const createdDate: Date = data.createdAt.toDate();

// Formatear
const dateString = createdDate.toLocaleDateString('es-ES');
```

## Problema: `serverTimestamp()` es `null` Localmente

Cuando usas `serverTimestamp()`, obtienes 2 eventos en listeners:
1. **Local**: El timestamp es `null`
2. **Servidor**: El timestamp tiene el valor real

**Soluciones:**

```typescript
// Opción 1: Usar 'estimate' para obtener valor estimado
const data = docSnap.data({ serverTimestamps: 'estimate' });

// Opción 2: Manejar null con fallback
const createdAt = data.createdAt?.toDate() || new Date();

// Opción 3: Verificar antes de usar
if (data.createdAt) {
  const date = data.createdAt.toDate();
}
```

## Comparar Timestamps

```typescript
// Usar método isEqual
if (timestamp1.isEqual(timestamp2)) {
  console.log('Son iguales');
}

// Comparación por segundos
if (timestamp1.seconds > timestamp2.seconds) {
  console.log('timestamp1 es más reciente');
}
```

## Consultas con Timestamps

```typescript
import { query, where, orderBy, Timestamp } from 'firebase/firestore';

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

const q = query(
  collection(db, 'posts'),
  where('createdAt', '>', Timestamp.fromDate(yesterday)),
  orderBy('createdAt', 'desc')
);
```

## Security Rules con Timestamps

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      // Validar que createdAt sea timestamp del servidor
      allow create: if request.time == request.resource.data.createdAt;

      // Validar que updatedAt sea timestamp del servidor en updates
      allow update: if request.time == request.resource.data.updatedAt;

      // Evitar que createdAt cambie en updates
      allow update: if request.resource.data.createdAt == resource.data.createdAt;
    }
  }
}
```
