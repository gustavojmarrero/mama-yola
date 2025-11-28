# Manejo de Valores Undefined

## El Problema
**Firestore NO acepta valores `undefined`**. Los tipos válidos son: string, number, boolean, null, timestamp, geopoint, blob, reference, array, y map.

## Soluciones

### Opción A: Configurar `ignoreUndefinedProperties` (Recomendado)

```typescript
// Firebase v9+ (Modular SDK) - DEBE llamarse ANTES de getFirestore()
import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
});

// NOTA: Si ya usas getFirestore() en otro lugar, debes cambiar a initializeFirestore
```

### Opción B: Sanitizar Datos Antes de Guardar

```typescript
// Función helper para eliminar undefined
export function sanitizeForFirestore<T extends Record<string, any>>(data: T): Partial<T> {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      // Recursivamente sanitizar objetos anidados
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        acc[key as keyof T] = sanitizeForFirestore(value);
      } else {
        acc[key as keyof T] = value;
      }
    }
    return acc;
  }, {} as Partial<T>);
}

// Uso
await setDoc(doc(db, 'users', id), sanitizeForFirestore(userData));
```

### Opción C: Spread Condicional

```typescript
const docData = {
  requiredField: value,
  ...(optionalField !== undefined && { optionalField }),
  ...(anotherOptional !== undefined && { anotherOptional })
};
```

## Diferencia entre `undefined`, `null` y `deleteField()`

| Operación | Resultado |
|-----------|-----------|
| `field: undefined` | ❌ Error (sin `ignoreUndefinedProperties`) |
| `field: null` | ✅ Campo existe con valor `null` |
| `field: deleteField()` | ✅ Campo se elimina del documento |

## Eliminar Campos

```typescript
import { doc, updateDoc, deleteField } from 'firebase/firestore';

await updateDoc(doc(db, 'users', userId), {
  campoAEliminar: deleteField()
});
```
