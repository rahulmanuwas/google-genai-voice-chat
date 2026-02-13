'use client';

import { useScenarioState } from '@/lib/hooks/use-scenario-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Scenario } from '@/lib/scenarios';

// ────────────────────────────────────────────────────────────────
// Status badge colors
// ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  // Dentist
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rescheduled: 'bg-amber-100 text-amber-800 border-amber-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  // E-commerce
  shipped: 'bg-blue-100 text-blue-800 border-blue-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  return_initiated: 'bg-orange-100 text-orange-800 border-orange-200',
};

function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize transition-all duration-500 ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
    >
      {label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// Dentist view
// ────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  patient: string;
  date: string;
  time: string;
  provider: string;
  type: string;
  status: string;
}

function DentistStateView({ appointments }: { appointments: Appointment[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Upcoming appointments — status updates live when the agent reschedules or cancels.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">ID</th>
              <th className="pb-2 pr-3 font-medium">Patient</th>
              <th className="pb-2 pr-3 font-medium">Date & Time</th>
              <th className="pb-2 pr-3 font-medium">Provider</th>
              <th className="pb-2 pr-3 font-medium">Type</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((apt) => (
              <tr
                key={apt.id}
                className="border-b border-muted/50 transition-colors duration-300 last:border-0"
              >
                <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{apt.id}</td>
                <td className="py-2.5 pr-3 font-medium">{apt.patient}</td>
                <td className="py-2.5 pr-3 whitespace-nowrap">
                  {apt.date} {apt.time}
                </td>
                <td className="py-2.5 pr-3 text-muted-foreground">{apt.provider}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{apt.type}</td>
                <td className="py-2.5">
                  <StatusBadge status={apt.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// E-commerce view
// ────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string;
  sku: string;
  quantity: number;
  price: string;
}

interface Order {
  orderNumber: string;
  customer: string;
  status: string;
  total: string;
  items: OrderItem[];
  returnId?: string;
}

function EcommerceStateView({ orders }: { orders: Order[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Customer orders — status updates live when the agent initiates returns.
      </p>
      <div className="grid gap-3">
        {orders.map((order) => (
          <div
            key={order.orderNumber}
            className="rounded-lg border bg-card p-3 transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm font-semibold">{order.orderNumber}</span>
                <span className="ml-2 text-sm text-muted-foreground">{order.customer}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{order.total}</span>
                <StatusBadge status={order.status} />
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {order.items.map((item) => (
                <div key={item.sku} className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="font-normal">
                    {item.name}
                    {item.quantity > 1 ? ` x${item.quantity}` : ''}
                  </Badge>
                  <span className="font-mono text-muted-foreground">SKU: {item.sku}</span>
                </div>
              ))}
            </div>
            {order.returnId && (
              <p className="mt-1.5 text-xs text-orange-600">
                Return ID: {order.returnId}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main panel
// ────────────────────────────────────────────────────────────────

interface ScenarioStatePanelProps {
  scenario: Scenario;
}

export function ScenarioStatePanel({ scenario }: ScenarioStatePanelProps) {
  const { state, isLoading, reset } = useScenarioState(scenario.appSlug);

  // No mutable state for this scenario (e.g. earnings)
  if (!state && !isLoading) return null;
  // Still checking — show nothing until we know if there's state
  if (isLoading && !state) return null;

  const isDentist = scenario.id === 'dentist';
  const isEcommerce = scenario.id === 'ecommerce';
  const dentistAppointments = isDentist && Array.isArray(state?.appointments)
    ? (state.appointments as Appointment[])
    : null;
  const ecommerceOrders = isEcommerce && Array.isArray(state?.orders)
    ? (state.orders as Order[])
    : null;

  if (!isDentist && !isEcommerce) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            {isDentist ? 'Appointments' : 'Orders'}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="h-7 text-xs"
          >
            Reset State
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {dentistAppointments && (
          <DentistStateView appointments={dentistAppointments} />
        )}
        {ecommerceOrders && (
          <EcommerceStateView orders={ecommerceOrders} />
        )}
      </CardContent>
    </Card>
  );
}
