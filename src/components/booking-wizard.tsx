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
import Avatar from "@/components/avatar";
import { Sketch } from "@/components/sketch";
import { IconBack } from "@/components/icons";

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
  photo: string | null;
}

interface BookingWizardProps {
  business: { id: string; slug: string; name: string; address: string | null };
  services: ServiceOption[];
  professionals: ProfessionalOption[];
  /** Días de la semana en que atiende el negocio (0 = domingo). */
  openDays: number[];
  initial: { servicio?: string; profesional?: string; fecha?: string; hora?: string };
  user: { id: string; role: string } | null;
}

const STEP_TITLES: Record<number, string> = {
  1: "Elegí el servicio",
  2: "Elegí con quién",
  3: "Elegí el día",
  4: "Elegí la hora",
  5: "Confirmá tu turno",
};

const STEPS = [
  { n: 1, label: "Servicio" },
  { n: 2, label: "Profesional" },
  { n: 3, label: "Fecha" },
  { n: 4, label: "Hora" },
  { n: 5, label: "Finalizar" },
];

export default function BookingWizard({
  business,
  services,
  professionals,
  openDays,
  initial,
  user,
}: BookingWizardProps) {
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

  const selectedProfessionalName =
    professionalId === "any" ? "Cualquiera disponible" : professionals.find((p) => p.id === professionalId)?.name;
  const morning = availableTimes.filter((t) => t < "13:00");
  const afternoon = availableTimes.filter((t) => t >= "13:00");

  if (success) {
    return (
      <div className="card relative overflow-hidden p-8 md:p-10 text-center max-w-lg mx-auto">
        <Sketch name="sparkle" className="mx-auto mb-3 h-16 w-16 text-brand-500" />
        <h2 className="text-2xl font-extrabold text-plum-900 mb-2">¡Turno confirmado!</h2>
        <p className="text-plum-500 mb-6">
          Te mandamos un mail con los detalles de tu turno en {business.name}.
        </p>
        <Link href="/mis-turnos" className="btn-primary">
          Ver mis turnos
        </Link>
      </div>
    );
  }

  const current = STEPS.find((s) => s.n === step)!;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Paso actual, avance y lo ya elegido */}
      <div className="mb-5 space-y-3">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button
              onClick={() => goToStep(step - 1)}
              aria-label="Paso anterior"
              className="grid h-9 w-9 place-items-center rounded-full bg-white border border-plum-100 text-plum-900"
            >
              <IconBack className="h-4 w-4" />
            </button>
          )}
          <h2 className="text-lg font-extrabold text-plum-900">{STEP_TITLES[step]}</h2>
          <span className="ml-auto text-sm font-semibold text-plum-400">
            Paso {step} de {STEPS.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-plum-100 overflow-hidden" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step} aria-label={current.label}>
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(step / STEPS.length) * 100}%` }} />
        </div>
        {(selectedService || selectedProfessionalName || dateISO) && (
          <div className="flex flex-wrap gap-2">
            {selectedService && step > 1 && (
              <button onClick={() => goToStep(1)} className="rounded-full bg-white border border-plum-100 px-3 py-1 text-xs font-bold text-plum-900">
                {selectedService.name} · {formatPrice(selectedService.price)}
              </button>
            )}
            {selectedProfessionalName && step > 2 && (
              <button onClick={() => goToStep(2)} className="rounded-full bg-white border border-plum-100 px-3 py-1 text-xs font-bold text-plum-900">
                {selectedProfessionalName}
              </button>
            )}
            {dateISO && step > 3 && (
              <button onClick={() => goToStep(3)} className="rounded-full bg-white border border-plum-100 px-3 py-1 text-xs font-bold text-plum-900">
                {formatDateLong(new Date(`${dateISO}T00:00:00`))}
                {time && step > 4 ? ` · ${time}` : ""}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card p-5 sm:p-7">
        {step === 1 && (
          <div className="space-y-2">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => selectService(s.id)}
                className={`w-full text-left rounded-2xl border p-4 transition-colors flex items-center justify-between gap-4 ${
                  serviceId === s.id ? "border-brand-600 bg-brand-50" : "border-plum-100 hover:border-brand-400 hover:bg-brand-50"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-bold text-plum-900">{s.name}</p>
                  {s.description && <p className="text-xs text-plum-400 mt-0.5 line-clamp-1">{s.description}</p>}
                  <p className="text-sm text-plum-500 mt-1">{formatDuration(s.durationMin)}</p>
                </div>
                <span className="font-extrabold text-plum-900 shrink-0">{formatPrice(s.price)}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <button
              onClick={() => selectProfessional("any")}
              className="w-full text-left rounded-2xl border border-plum-100 p-4 hover:border-brand-400 hover:bg-brand-50 transition-colors flex items-center gap-3"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand-100 text-plum-700">
                <Sketch name="sparkle" className="h-6 w-6" />
              </span>
              <span>
                <span className="block font-bold text-plum-900">Cualquiera disponible</span>
                <span className="block text-sm text-plum-500">Te asignamos el primer profesional libre</span>
              </span>
            </button>
            {professionals.map((p) => (
              <button
                key={p.id}
                onClick={() => selectProfessional(p.id)}
                className="w-full text-left rounded-2xl border border-plum-100 p-4 hover:border-brand-400 hover:bg-brand-50 transition-colors flex items-center gap-3"
              >
                <Avatar name={p.name} src={p.photo} size={40} />
                <p className="font-bold text-plum-900">{p.name}</p>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-xs text-plum-400 mb-4">Los días en gris el negocio no atiende.</p>
            {days.length === 0 ? (
              <p className="text-plum-500 text-sm">Cargando fechas disponibles...</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 max-h-96 overflow-y-auto p-1.5">
                {days.map((d) => {
                  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
                    d.getDate()
                  ).padStart(2, "0")}`;
                  const closed = !openDays.includes(d.getDay());
                  const selected = dateISO === iso;
                  return (
                    <button
                      key={iso}
                      onClick={() => selectDate(iso)}
                      disabled={closed}
                      title={closed ? "El negocio no atiende este día" : undefined}
                      aria-label={closed ? `${formatWeekday(d)} ${formatDayNumber(d)}: cerrado` : undefined}
                      aria-pressed={selected}
                      className={`relative rounded-xl border p-2.5 text-center transition-colors ${
                        closed
                          ? "border-plum-50 bg-plum-50 text-plum-300 cursor-not-allowed"
                          : selected
                          ? "border-plum-900 bg-plum-900 text-white"
                          : "border-plum-100 bg-white text-plum-900 hover:border-brand-400 hover:bg-brand-50"
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold opacity-70">{formatWeekday(d)}</div>
                      <div className="text-lg font-extrabold">{formatDayNumber(d)}</div>
                      {selected && <PencilRing />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            {loadingSlots ? (
              <p className="text-plum-500 text-sm">Buscando horarios disponibles...</p>
            ) : availableTimes.length === 0 ? (
              <div className="text-center py-4">
                <Sketch name="calendar" className="mx-auto mb-2 h-14 w-14 text-plum-300" />
                <p className="text-plum-500 text-sm">No hay horarios disponibles ese día. Probá con otra fecha.</p>
                <button onClick={() => goToStep(3)} className="btn-secondary mt-4">Elegir otro día</button>
              </div>
            ) : (
              <div className="space-y-5">
                {[
                  { label: "Mañana", list: morning },
                  { label: "Tarde", list: afternoon },
                ]
                  .filter((g) => g.list.length > 0)
                  .map((g) => (
                    <div key={g.label}>
                      <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-plum-400">{g.label}</p>
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 p-1">
                        {g.list.map((t) => (
                          <button
                            key={t}
                            onClick={() => selectTime(t)}
                            aria-pressed={time === t}
                            className={`relative rounded-xl border py-2.5 text-sm font-bold transition-colors ${
                              time === t
                                ? "border-brand-600 bg-brand-600 text-white"
                                : "border-plum-100 bg-white text-plum-900 hover:border-brand-400 hover:bg-brand-50"
                            }`}
                          >
                            {t}
                            {time === t && <PencilRing />}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {step === 5 && selectedService && dateISO && time && (
          <div>
            <dl className="divide-y divide-plum-100 text-sm mb-6 rounded-2xl bg-plum-50 px-4">
              {[
                ["Negocio", business.name],
                ["Servicio", selectedService.name],
                ["Profesional", selectedProfessionalName ?? ""],
                ["Fecha", formatDateLong(new Date(`${dateISO}T00:00:00`))],
                ["Hora", time],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-plum-500">{k}</dt>
                  <dd className="font-bold text-plum-900 text-right">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-plum-500">Precio</dt>
                <dd className="font-extrabold text-brand-600">{formatPrice(selectedService.price)}</dd>
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
              <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2 mb-4">
                Necesitás iniciar sesión para confirmar el turno. Te vamos a devolver acá después.
              </p>
            )}
            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-4">{submitError}</p>
            )}

            <button onClick={handleConfirm} disabled={submitting} className="btn-primary w-full py-3.5">
              {submitting ? "Confirmando..." : user ? "Confirmar turno" : "Ingresar y confirmar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Círculo a lápiz alrededor de la opción elegida. */
function PencilRing() {
  return (
    <svg className="sketch pointer-events-none absolute -inset-1.5 h-[calc(100%+12px)] w-[calc(100%+12px)] overflow-visible text-brand-500" aria-hidden="true">
      <use href="#sk-loop" />
    </svg>
  );
}
