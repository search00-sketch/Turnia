import type { AppointmentDoc } from "@/lib/db/appointments";
import type { ServiceDoc } from "@/lib/db/services";
import type { MovementDoc } from "@/lib/db/movements";

/**
 * Una fila del estado de resultados: un servicio del negocio, o un concepto
 * cargado a mano (un producto, "Alquiler", "Sueldos"...).
 */
export interface AccountingLine {
  key: string;
  kind: "SERVICIO" | "CONCEPTO";
  name: string;
  category: string | null;
  /** Turnos realizados (COMPLETADO) en el período. Siempre 0 para conceptos. */
  completedCount: number;
  /** Lo cobrado por turnos realizados. */
  appointmentIncome: number;
  /** Costo directo de esos turnos (costo por turno del servicio). */
  appointmentCost: number;
  /** Ingresos cargados a mano (ej: venta de productos). */
  otherIncome: number;
  /** Gastos cargados a mano imputados a esta fila. */
  otherExpense: number;
  income: number;
  expense: number;
  profit: number;
  /** Ganancia / ingresos, entre 0 y 1 (o negativo). null si no hubo ingresos. */
  margin: number | null;
}

export interface AccountingReport {
  income: number;
  expense: number;
  profit: number;
  margin: number | null;
  completedCount: number;
  /** Turnos pendientes/confirmados del período: todavía no cuentan como ingreso. */
  pendingCount: number;
  pendingIncome: number;
  lines: AccountingLine[];
}

const ACTIVE_STATUSES = new Set(["PENDIENTE", "CONFIRMADO"]);

/** Clave para agrupar conceptos escritos a mano ("Shampoo " y "shampoo" son lo mismo). */
export function conceptKey(concept: string): string {
  return concept
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

function emptyLine(key: string, kind: AccountingLine["kind"], name: string, category: string | null): AccountingLine {
  return {
    key,
    kind,
    name,
    category,
    completedCount: 0,
    appointmentIncome: 0,
    appointmentCost: 0,
    otherIncome: 0,
    otherExpense: 0,
    income: 0,
    expense: 0,
    profit: 0,
    margin: null,
  };
}

/**
 * Arma el estado de resultados de un período a partir de los turnos, los
 * servicios del negocio y los movimientos cargados a mano.
 *
 * - Ingreso de un turno: sólo cuando está COMPLETADO, por el precio guardado
 *   en el turno al reservar (o el precio actual del servicio para turnos
 *   anteriores a esta función).
 * - Gasto de un turno: el costo por turno del servicio, con el mismo criterio.
 * - Movimientos: suman a la fila de su servicio si tienen serviceId, si no a
 *   la fila de su concepto.
 */
export function buildAccountingReport(input: {
  appointments: AppointmentDoc[];
  services: ServiceDoc[];
  movements: MovementDoc[];
}): AccountingReport {
  const servicesById = new Map(input.services.map((s) => [s.id, s]));
  const lines = new Map<string, AccountingLine>();

  function serviceLine(serviceId: string): AccountingLine {
    const key = `service:${serviceId}`;
    let line = lines.get(key);
    if (!line) {
      const service = servicesById.get(serviceId);
      line = emptyLine(key, "SERVICIO", service?.name ?? "Servicio eliminado", service?.category ?? null);
      lines.set(key, line);
    }
    return line;
  }

  // Los servicios activos aparecen siempre, aunque no hayan tenido movimiento.
  for (const s of input.services) {
    if (s.active) serviceLine(s.id);
  }

  let pendingCount = 0;
  let pendingIncome = 0;

  for (const a of input.appointments) {
    const service = servicesById.get(a.serviceId);
    const price = a.price ?? service?.price ?? 0;
    const cost = a.cost ?? service?.cost ?? 0;

    if (a.status === "COMPLETADO") {
      const line = serviceLine(a.serviceId);
      line.completedCount++;
      line.appointmentIncome += price;
      line.appointmentCost += cost;
    } else if (ACTIVE_STATUSES.has(a.status)) {
      pendingCount++;
      pendingIncome += price;
    }
  }

  for (const m of input.movements) {
    let line: AccountingLine;
    if (m.serviceId) {
      line = serviceLine(m.serviceId);
    } else {
      const key = `concept:${conceptKey(m.concept)}`;
      line = lines.get(key) ?? emptyLine(key, "CONCEPTO", m.concept.trim(), null);
      lines.set(key, line);
    }
    if (m.type === "INGRESO") line.otherIncome += m.amount;
    else line.otherExpense += m.amount;
  }

  const out = [...lines.values()].map((line) => {
    const income = line.appointmentIncome + line.otherIncome;
    const expense = line.appointmentCost + line.otherExpense;
    const profit = income - expense;
    return { ...line, income, expense, profit, margin: income > 0 ? profit / income : null };
  });

  // Servicios primero (por categoría y nombre), después conceptos sueltos por nombre.
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "SERVICIO" ? -1 : 1;
    return (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name);
  });

  const income = out.reduce((acc, l) => acc + l.income, 0);
  const expense = out.reduce((acc, l) => acc + l.expense, 0);
  const profit = income - expense;

  return {
    income,
    expense,
    profit,
    margin: income > 0 ? profit / income : null,
    completedCount: out.reduce((acc, l) => acc + l.completedCount, 0),
    pendingCount,
    pendingIncome,
    lines: out,
  };
}
