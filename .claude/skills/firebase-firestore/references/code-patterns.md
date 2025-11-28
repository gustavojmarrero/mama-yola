# Patrones de Código Recomendados

## Helper para Crear/Actualizar con Timestamps Automáticos

```typescript
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  CollectionReference,
  DocumentReference
} from 'firebase/firestore';

interface TimestampedData {
  createdAt?: any;
  updatedAt?: any;
}

export async function createDocument<T extends Record<string, any>>(
  collectionRef: CollectionReference,
  data: T
): Promise<DocumentReference> {
  const sanitizedData = sanitizeForFirestore({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return await addDoc(collectionRef, sanitizedData);
}

export async function updateDocument<T extends Record<string, any>>(
  docRef: DocumentReference,
  data: Partial<T>
): Promise<void> {
  const sanitizedData = sanitizeForFirestore({
    ...data,
    updatedAt: serverTimestamp()
  });

  await updateDoc(docRef, sanitizedData);
}
```

## Converter para Tipos TypeScript

```typescript
import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp
} from 'firebase/firestore';

interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export const userConverter: FirestoreDataConverter<User> = {
  toFirestore(user: User) {
    return {
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt instanceof Date
        ? Timestamp.fromDate(user.createdAt)
        : user.createdAt,
      updatedAt: user.updatedAt instanceof Date
        ? Timestamp.fromDate(user.updatedAt)
        : user.updatedAt
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): User {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      email: data.email,
      displayName: data.displayName,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    };
  }
};

// Uso
const userRef = doc(db, 'users', userId).withConverter(userConverter);
const userSnap = await getDoc(userRef);
const user = userSnap.data(); // Tipo User con Date en lugar de Timestamp
```

## Colección Tipada

```typescript
import { collection, CollectionReference, DocumentData } from 'firebase/firestore';

const createCollection = <T = DocumentData>(collectionName: string) => {
  return collection(db, collectionName) as CollectionReference<T>;
};

// Exportar colecciones tipadas
export const usersCol = createCollection<User>('users');
export const postsCol = createCollection<Post>('posts');
export const ordersCol = createCollection<Order>('orders');
```
