# Errores Comunes y Soluciones

## Error: "Function DocumentReference.set() called with invalid data. Unsupported field value: undefined"

**Causa**: Intentas guardar un objeto con propiedades `undefined`.

**Solución**:
1. Usar `initializeFirestore` con `ignoreUndefinedProperties: true`
2. O sanitizar datos antes de guardar

Ver: [undefined-handling.md](undefined-handling.md)

## Error: "The query requires an index"

**Causa**: Falta un índice compuesto para la consulta.

**Solución**:
1. Click en el link del error para crear el índice
2. O agregar a `firestore.indexes.json` y desplegar

Ver: [indexes.md](indexes.md)

## Error: "Timestamp cannot be null"

**Causa**: Intentas usar `serverTimestamp()` inmediatamente después de guardar.

**Solución**:
1. Usar `{ serverTimestamps: 'estimate' }` al leer
2. O manejar null con optional chaining: `data.createdAt?.toDate()`

Ver: [timestamps.md](timestamps.md)

## Error: "Maximum index entries per document"

**Causa**: El documento tiene demasiados campos indexados (>40,000 entradas).

**Solución**:
1. Agregar index exemptions para campos grandes/no consultados
2. Reducir el número de campos en el documento

## Error ABORTED (Transacción)

**Causa**: Contención de transacciones o demasiadas actualizaciones por segundo.

**Solución**:

```typescript
async function updateWithRetry(docRef: DocumentReference, data: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await runTransaction(db, async (transaction) => {
        const doc = await transaction.get(docRef);
        transaction.update(docRef, data);
      });
      return;
    } catch (error: any) {
      if (error.code === 'aborted' && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
      } else {
        throw error;
      }
    }
  }
}
```
