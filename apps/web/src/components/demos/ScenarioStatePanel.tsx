'use client';

import { useEffect, useRef, useState } from 'react';
import { useScenarioState } from '@/lib/hooks/use-scenario-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Calendar, Stethoscope } from 'lucide-react';
import type { Scenario } from '@/lib/scenarios';

// ────────────────────────────────────────────────────────────────
// Status badge colors — dark-theme transparent overlays
// ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  // Dentist
  confirmed: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/25',
  rescheduled: 'bg-amber-400/15 text-amber-400 border-amber-400/25',
  cancelled: 'bg-red-400/15 text-red-400 border-red-400/25',
  // E-commerce
  shipped: 'bg-blue-400/15 text-blue-400 border-blue-400/25',
  delivered: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/25',
  return_initiated: 'bg-orange-400/15 text-orange-400 border-orange-400/25',
};

function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize transition-all duration-500 ${STATUS_STYLES[status] ?? 'bg-zinc-400/15 text-zinc-400 border-zinc-400/25'}`}
    >
      {label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// Changed status detection hook
// ────────────────────────────────────────────────────────────────

function useChangedStatuses(items: { id: string; status: string }[]): Set<string> {
  const prevRef = useRef<Map<string, string>>(new Map());
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const prev = prevRef.current;
    const changed = new Set<string>();
    for (const item of items) {
      const prevStatus = prev.get(item.id);
      if (prevStatus !== undefined && prevStatus !== item.status) {
        changed.add(item.id);
      }
    }

    if (changed.size > 0) {
      setChangedIds(changed);
      const timer = setTimeout(() => setChangedIds(new Set()), 1500);
      prevRef.current = new Map(items.map((i) => [i.id, i.status]));
      return () => clearTimeout(timer);
    }

    prevRef.current = new Map(items.map((i) => [i.id, i.status]));
  }, [items]);

  return changedIds;
}

// ────────────────────────────────────────────────────────────────
// Dentist view — card stack
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
  const changedIds = useChangedStatuses(appointments);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Upcoming appointments — status updates live when the agent reschedules or cancels.
      </p>
      <div className="grid gap-2">
        {appointments.map((apt) => {
          const isChanged = changedIds.has(apt.id);

          return (
            <div
              key={apt.id}
              className={`rounded-lg border border-border bg-card/50 px-3 py-2.5 transition-all duration-300 ${isChanged ? 'animate-highlight-flash' : ''}`}
            >
              {/* Primary: Patient + Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{apt.patient}</span>
                </div>
                <StatusBadge status={apt.status} />
              </div>
              {/* Secondary: Date + Provider */}
              <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {apt.date} {apt.time}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Stethoscope className="h-3 w-3" />
                  {apt.provider}
                </span>
              </div>
            </div>
          );
        })}
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
  const changedIds = useChangedStatuses(
    orders.map((o) => ({ id: o.orderNumber, status: o.status }))
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Customer orders — status updates live when the agent initiates returns.
      </p>
      <div className="grid gap-3">
        {orders.map((order) => {
          const isChanged = changedIds.has(order.orderNumber);

          return (
            <div
              key={order.orderNumber}
              className={`rounded-lg border border-border bg-card/50 p-3 transition-all duration-300 ${isChanged ? 'animate-highlight-flash' : ''}`}
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
                <p className="mt-1.5 text-xs text-orange-400">
                  Return ID: {order.returnId}
                </p>
              )}
            </div>
          );
        })}
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
