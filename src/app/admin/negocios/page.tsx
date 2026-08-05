import { format } from "date-fns";
import { getAllBusinessesWithOwners } from "@/lib/db/businesses";
import { categoryLabel } from "@/lib/config";
import AdminBusinessRow, { type AdminBusinessRowData } from "@/components/admin-business-row";

export const dynamic = "force-dynamic";

function isoDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function paymentLabel(paidUntil: Date | null): string {
  if (!paidUntil) return "Gratis";
  const now = new Date();
  return paidUntil >= now
    ? `Pagado hasta ${format(paidUntil, "dd/MM/yyyy")}`
    : `Vencido desde ${format(paidUntil, "dd/MM/yyyy")}`;
}

export default async function AdminNegociosPage() {
  const businesses = await getAllBusinessesWithOwners();

  const rows: AdminBusinessRowData[] = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    category: categoryLabel(b.category),
    createdAt: format(b.createdAt, "dd/MM/yyyy"),
    published: b.published,
    paidUntilISO: b.paidUntil ? isoDateInput(b.paidUntil) : null,
    paymentLabel: paymentLabel(b.paidUntil),
    ownerName: b.owner ? `${b.owner.name} ${b.owner.lastName ?? ""}`.trim() : "—",
    ownerEmail: b.owner?.email ?? "—",
    ownerPhone: b.owner?.phone ?? null,
  }));

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-neutral-900">Negocios ({rows.length})</h2>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">Todavía no hay negocios registrados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-100">
                <th className="py-2 pr-4 font-medium">Negocio</th>
                <th className="py-2 pr-4 font-medium">Dueño</th>
                <th className="py-2 pr-4 font-medium">Alta</th>
                <th className="py-2 pr-4 font-medium">Publicación</th>
                <th className="py-2 font-medium">Pago</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <AdminBusinessRow key={b.id} business={b} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
