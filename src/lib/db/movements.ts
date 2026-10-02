import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";

export type MovementType = "INGRESO" | "GASTO";

/**
 * Movimiento contable cargado a mano por el negocio: un gasto (alquiler,
 * compra de insumos, sueldos...) o un ingreso que no viene de un turno
 * (venta de un producto, por ejemplo). Puede imputarse a un servicio puntual
 * (serviceId) o quedar agrupado por su concepto (ej: "Shampoo", "Alquiler").
 */
export interface MovementDoc {
  id: string;
  businessId: string;
  type: MovementType;
  date: Date;
  amount: number;
  concept: string;
  serviceId: string | null;
  notes: string | null;
  createdAt: Date;
}

export function mapMovementDoc(snap: FirebaseFirestore.DocumentSnapshot): MovementDoc {
  const data = snap.data()!;
  return {
    id: snap.id,
    businessId: data.businessId,
    type: data.type,
    date: data.date.toDate(),
    amount: data.amount,
    concept: data.concept,
    serviceId: data.serviceId ?? null,
    notes: data.notes ?? null,
    createdAt: data.createdAt.toDate(),
  };
}

export async function getMovementsInRange(businessId: string, start: Date, end: Date): Promise<MovementDoc[]> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.movements)
    .where("businessId", "==", businessId)
    .where("date", ">=", start)
    .where("date", "<=", end)
    .get();
  const movements = snap.docs.map(mapMovementDoc);
  movements.sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
  return movements;
}

export async function getMovementById(id: string): Promise<MovementDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.movements).doc(id).get();
  return snap.exists ? mapMovementDoc(snap) : null;
}

export async function createMovement(
  businessId: string,
  data: { type: MovementType; date: Date; amount: number; concept: string; serviceId?: string | null; notes?: string | null }
): Promise<void> {
  await getAdminDb()
    .collection(COLLECTIONS.movements)
    .add({
      businessId,
      type: data.type,
      date: data.date,
      amount: data.amount,
      concept: data.concept,
      serviceId: data.serviceId ?? null,
      notes: data.notes ?? null,
      createdAt: new Date(),
    });
}

export async function deleteMovement(id: string): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.movements).doc(id).delete();
}
