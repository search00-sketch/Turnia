# Contabilidad del negocio — ingresos, gastos y ganancia por servicio/producto

## Contexto

El panel del negocio (`/panel`) permitía gestionar agenda, servicios, profesionales y horarios, pero no había forma de saber cuánto se ganó. El pedido: una parte contable que contabilice gasto y ganancia de cada producto/servicio.

## Alcance

**Adentro:**
- Campo opcional `cost` ("costo por turno") en cada servicio, editable en `/panel/servicios`.
- Snapshot de `price` y `cost` en cada turno al reservarlo (`createAppointmentTx`), para que cambiar precios no reescriba meses pasados.
- Colección `turnia_movements`: gastos e ingresos cargados a mano (`type: INGRESO | GASTO`, `date`, `amount`, `concept`, `serviceId?`, `notes?`).
- Página `/panel/contabilidad` con selector de mes: totales (ingresos, gastos, ganancia neta, margen), tabla de resultado por servicio/concepto, y alta/baja de movimientos.

**Afuera:**
- Catálogo/stock de productos (los productos se registran como conceptos libres en los movimientos).
- Medios de pago, facturación, impuestos, exportación a CSV, gráficos.
- Contabilidad agregada para el admin de la plataforma.

## Reglas de cálculo (`src/lib/accounting.ts`)

- Un turno suma ingreso sólo si está `COMPLETADO`, por `appointment.price ?? service.price`; y suma gasto por `appointment.cost ?? service.cost`.
- Turnos `PENDIENTE`/`CONFIRMADO` del período no son ingreso: se muestran aparte como "sin marcar como realizados".
- Un movimiento con `serviceId` se suma a la fila de ese servicio; sin `serviceId`, a la fila de su concepto (agrupado sin mayúsculas, acentos ni espacios extra).
- Los servicios activos aparecen siempre; los archivados sólo si tuvieron actividad en el período.
- Margen = ganancia / ingresos (sin dato si no hubo ingresos).

## Datos

- Turnos del mes: `getAppointmentsInRange` (índice existente `businessId + startsAt`).
- Movimientos del mes: `businessId == X` + rango sobre `date` → índice compuesto nuevo en `firestore.indexes.json` (`turnia_movements: businessId + date`). Hay que desplegarlo con `firebase deploy --only firestore:indexes`.
- La fecha de un movimiento se guarda a las 12:00 hora del servidor para que no se corra de día.

## Seguridad

Igual que el resto del panel: todo pasa por Server Actions con `requireBusinessUser()`, y se valida que el movimiento/servicio pertenezca al negocio del usuario antes de crear o borrar.

## Verificación

Sin framework de tests en el repo: `tsc --noEmit`, `next build`, y un script puntual con `tsx` que ejercita `buildAccountingReport` con turnos en distintos estados, snapshots vs. turnos viejos, servicios archivados y conceptos con distinta capitalización.
