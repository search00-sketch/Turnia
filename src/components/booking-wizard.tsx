"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAvailableSlots, createAppointment } from "@/actions/bookings";
import {
  formatDateLong,
  formatDuration,
  formatPrice,
  formatWeekday,
  formatDayNumber,
} from "@/lib/format";
import { nextDaysFrom } from "@/lib/slots";

interface ServiceOption {
  id: string;
  name: string;
  category: string;
  price: number;
  durationMin: number;
  description?: string | null;
}

interface ProfessionalOption {
  id: string;
  name: string;
}

interface BookingWizardProps {
  business: { id: string; slug: string; name: string; address: string | null };
  services: ServiceOption[];
  professionals: ProfessionalOption[];
  initial: { servicio?: string; profesional?: string; fecha?: string; hora?: string };
  user: { id: string; role: string } | null;
}

const STEPS = [
  { n: 1, label: "Servicio" },
  { n: 2, label: "Profesional" },
  { n: 3, label: "Fecha" },
  { n: 4, label: "Hora" },
  { n: 5, label: "Finalizar" },
];

export default function BookingWizard({ business, services, professionals, initial, user }: BookingWizardProps) {
  const router = useRouter();

  const initialServiceValid = services.find((s) => s.id === initial.servicio) ? initial.servicio : undefined;
  const initialProfValid =
    initial.profesional === "any" || professionals.find((p) => p.id === initial.profesional)
      ? initial.profesional
      : undefined;

  const startStep =
    initialServiceValid && initialProfValid && initial.fecha && initial.hora
      ? 5
      : initialServiceValid
      ? 2
      : 1;

  const [step, setStep] = useState(startStep);
  const [maxStep, setMaxStep] = useState(startStep);
  const [serviceId, setServiceId] = useState<string | undefined>(initialServiceValid);
  const [professionalId, setProfessionalId] = useState<string | undefined>(initialProfValid);
  const [dateISO, setDateISO] = useState<string | undefined>(initial.fecha);
  const [time, setTime] = useState<string | undefined>(initial.hora);
  const [notes, setNotes] = useState("");

  const [days, setDays] = useState<Date[]>([]);
  useEffect(() => {
    // Se calcula en el cliente para evitar desajustes de huso horario con el servidor.
    setDays(nextDaysFrom(new Date(), 30));
  }, []);

  const [slotsByProfessional, setSlotsByProfessional] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedService = services.find((s) => s.id === serviceId);

  function goToStep(n: number) {
    if (n <= maxStep) setStep(n);
  }

  function advance(n: number) {
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
  }

  function selectService(id: string) {
    setServiceId(id);
    setProfessionalId(undefined);
    setDateISO(undefined);
    setTime(undefined);
    advance(2);
  }

  function selectProfessional(id: string) {
    setProfessionalId(id);
    setDateISO(undefined);
    setTime(undefined);
    advance(3);
  }

  function selectDate(iso: string) {
    setDateISO(iso);
    setTime(undefined);
    advance(4);
  }

  function selectTime(t: string) {
    setTime(t);
    advance(5);
  }

  useEffect(() => {
    if (!serviceId || !professionalId || !dateISO) return;
    let cancelled = false;
    setLoadingSlots(true);
    getAvailableSlots({ businessId: business.id, serviceId, professionalId, dateISO })
      .then((res) => {
        if (!cancelled) setSlotsByProfessional(res.slotsByProfessional);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, professionalId, dateISO, business.id]);

  const availableTimes = useMemo(() => {
    if (!professionalId) return [];
    if (professionalId === "any") {
      const set = new Set<string>();
      Object.values(slotsByProfessional).forEach((list) => list.forEach((t) => set.add(t)));
      return Array.from(set).sort();
    }
    return slotsByProfessional[professionalId] ?? [];
  }, [slotsByProfessional, professionalId]);

  function currentUrl() {
    const params = new URLSearchParams();
    if (serviceId) params.set("servicio", serviceId);
    if (professionalId) params.set("profesional", professionalId);
    if (dateISO) params.set("fecha", dateISO);
    if (time) params.set("hora", time);
    return `/negocios/${business.slug}/reservar?${params.toString()}`;
  }

  async function handleConfirm() {
    if (!serviceId || !professionalId || !dateISO || !time) return;

    if (!user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl())}`);
      return;
    }
    if (user.role !== "CLIENTE") {
      setSubmitError("Iniciá sesión con una cuenta de cliente para reservar.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const result = await createAppointment({
      businessId: business.id,
      serviceId,
      professionalId,
      dateISO,
      time,
      notes,
    });
    setSubmitting(false);

    if (!result.ok) {
      if (result.error === "AUTH_REQUIRED") {
        router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl())}`);
        return;
      }
      setSubmitError(result.error);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="card p-10 text-center max-w-lg mx-auto">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-bold mb-2">¡Turno confirmado!</h2>
        <p className="text-neutral-500 mb-6">
          Te enviamos un email con los detalles de tu turno en {business.name}.
        </p>
        <Link href="/mis-turnos" className="btn-primary">
          Ver mis turnos
        </Link>
      </div>
    );
  }

  return (
    <div>
      <ol className="flex items-center justify-between mb-8 max-w-2xl mx-auto">
        {STEPS.map((s, idx) => (
          <li key={s.n} className="flex-1 flex items-center">
            <button
              onClick={() => goToStep(s.n)}
              disabled={s.n > maxStep}
              className={`h-8 w-8 shrink-0 rounded-full text-sm font-bold flex items-center justify-center transition-colors ${
                s.n === step
                  ? "bg-brand-600 text-white"
                  : s.n < step
                  ? "bg-brand-100 text-brand-700"
                  : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {s.n}
            </button>
            <span
              className={`ml-2 text-xs font-medium hidden sm:inline ${
                s.n === step ? "text-brand-700" : "text-neutral-400"
              }`}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && <span className="flex-1 h-px bg-neutral-200 mx-2" />}
          </li>
        ))}
      </ol>

      <div className="card p-6 sm:p-8 max-w-2xl mx-auto">
        {step === 1 && (
          <div>
            <h2 className="font-semibold text-lg mb-4">Elegí un servicio</h2>
            <div className="space-y-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectService(s.id)}
                  className="w-full text-left rounded-lg border border-neutral-200 p-4 hover:border-brand-400 hover:bg-brand-50 transition-colors flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-medium text-neutral-900">{s.name}</p>
                    {s.description && (
                      <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">{s.description}</p>
                    )}
                    <p className="text-sm text-neutral-500 mt-1">{formatDuration(s.durationMin)}</p>
                  </div>
                  <span className="font-semibold text-brand-600 shrink-0">{formatPrice(s.price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-semibold text-lg mb-4">Elegí un profesional</h2>
            <div className="space-y-2">
              <button
                onClick={() => selectProfessional("any")}
                className="w-full text-left rounded-lg border border-neutral-200 p-4 hover:border-brand-400 hover:bg-brand-50 transition-colors"
              >
                <p className="font-medium text-neutral-900">Cualquiera disponible</p>
                <p className="text-sm text-neutral-500">Te asignamos el primer profesional libre</p>
              </button>
              {professionals.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProfessional(p.id)}
                  className="w-full text-left rounded-lg border border-neutral-200 p-4 hover:border-brand-400 hover:bg-brand-50 transition-colors"
                >
                  <p className="font-medium text-neutral-900">{p.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-semibold text-lg mb-4">Elegí una fecha</h2>
            {days.length === 0 ? (
              <p className="text-neutral-500 text-sm">Cargando fechas disponibles...</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-80 overflow-y-auto pr-1">
                {days.map((d) => {
                  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
                    d.getDate()
                  ).padStart(2, "0")}`;
                  return (
                    <button
                      key={iso}
                      onClick={() => selectDate(iso)}
                      className={`rounded-lg border p-3 text-center transition-colors ${
                        dateISO === iso
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-neutral-200 hover:border-brand-400 hover:bg-brand-50"
                      }`}
                    >
                      <div className="text-[10px] uppercase font-semibold opacity-70">{formatWeekday(d)}</div>
                      <div className="text-lg font-bold">{formatDayNumber(d)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="font-semibold text-lg mb-4">Elegí un horario</h2>
            {loadingSlots ? (
              <p className="text-neutral-500 text-sm">Buscando horarios disponibles...</p>
            ) : availableTimes.length === 0 ? (
              <p className="text-neutral-500 text-sm">
                No hay horarios disponibles ese día. Volvé al paso anterior y probá otra fecha.
              </p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {availableTimes.map((t) => (
                  <button
                    key={t}
                    onClick={() => selectTime(t)}
                    className={`rounded-lg border p-2.5 text-sm font-medium transition-colors ${
                      time === t
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-neutral-200 hover:border-brand-400 hover:bg-brand-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 5 && selectedService && dateISO && time && (
          <div>
            <h2 className="font-semibold text-lg mb-4">Confirmá tu turno</h2>
            <dl className="space-y-2 text-sm mb-6">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Negocio</dt>
                <dd className="font-medium">{business.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Servicio</dt>
                <dd className="font-medium">{selectedService.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Profesional</dt>
                <dd className="font-medium">
                  {professionalId === "any"
                    ? "Cualquiera disponible"
                    : professionals.find((p) => p.id === professionalId)?.name}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Fecha</dt>
                <dd className="font-medium">{formatDateLong(new Date(`${dateISO}T00:00:00`))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Hora</dt>
                <dd className="font-medium">{time}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Precio</dt>
                <dd className="font-semibold text-brand-600">{formatPrice(selectedService.price)}</dd>
              </div>
            </dl>

            <label className="label" htmlFor="notes">
              Notas para el negocio (opcional)
            </label>
            <textarea
              id="notes"
              className="input mb-4"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {!user && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                Necesitás iniciar sesión para confirmar el turno. Te vamos a devolver acá después.
              </p>
            )}
            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{submitError}</p>
            )}

            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? "Confirmando..." : user ? "Confirmar turno" : "Ingresar y confirmar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
