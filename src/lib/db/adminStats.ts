import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import type { AppointmentStatus } from "@/lib/db/appointments";

export interface PlatformStats {
  businesses: { total: number; published: number };
  clients: number;
  appointmentsByStatus: Record<AppointmentStatus, number>;
  weeklySignups: { weekStart: string; businesses: number; clients: number }[];
}

const STATUSES: AppointmentStatus[] = ["PENDIENTE", "CONFIRMADO", "CANCELADO", "COMPLETADO"];
const WEEKS_TO_SHOW = 8;

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = domingo ... 6 = sábado
  const diff = day === 0 ? -6 : 1 - day; // retrocede hasta el lunes de esa semana
  d.setDate(d.getDate() + diff);
  return d;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Números generales de la plataforma para el panel de administración. */
export async function getPlatformStats(): Promise<PlatformStats> {
  const db = getAdminDb();

  const [businessesTotalSnap, businessesPublishedSnap, clientsCountSnap, ...statusSnaps] =
    await Promise.all([
      db.collection(COLLECTIONS.businesses).count().get(),
      db.collection(COLLECTIONS.businesses).where("published", "==", true).count().get(),
      db.collection(COLLECTIONS.users).where("role", "==", "CLIENTE").count().get(),
      ...STATUSES.map((status) =>
        db.collection(COLLECTIONS.appointments).where("status", "==", status).count().get()
      ),
    ]);

  const appointmentsByStatus = STATUSES.reduce((acc, status, i) => {
    acc[status] = statusSnaps[i].data().count;
    return acc;
  }, {} as Record<AppointmentStatus, number>);

  // Para las altas por semana no hay agregación posible en Firestore: se trae
  // sólo createdAt (vía select, sin bajar el resto de los campos) de negocios
  // y clientes, y se agrupa en memoria. A esta escala (decenas de registros)
  // es la forma más simple y no hace falta ningún índice ni colección extra.
  const [businessDates, clientDates] = await Promise.all([
    db.collection(COLLECTIONS.businesses).select("createdAt").get(),
    db.collection(COLLECTIONS.users).where("role", "==", "CLIENTE").select("createdAt").get(),
  ]);

  const now = new Date();
  const weeks: { weekStart: string; businesses: number; clients: number }[] = [];
  for (let i = WEEKS_TO_SHOW - 1; i >= 0; i--) {
    const weekStart = mondayOf(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000));
    weeks.push({ weekStart: isoDate(weekStart), businesses: 0, clients: 0 });
  }

  function bucketIndexOf(createdAt: Date): number {
    const key = isoDate(mondayOf(createdAt));
    return weeks.findIndex((w) => w.weekStart === key);
  }

  for (const doc of businessDates.docs) {
    const idx = bucketIndexOf(doc.data().createdAt.toDate());
    if (idx >= 0) weeks[idx].businesses++;
  }
  for (const doc of clientDates.docs) {
    const idx = bucketIndexOf(doc.data().createdAt.toDate());
    if (idx >= 0) weeks[idx].clients++;
  }

  return {
    businesses: {
      total: businessesTotalSnap.data().count,
      published: businessesPublishedSnap.data().count,
    },
    clients: clientsCountSnap.data().count,
    appointmentsByStatus,
    weeklySignups: weeks,
  };
}
