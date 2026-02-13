import type { Scenario } from '@/lib/scenarios';

export type DemoSubsystem =
  | 'conversation'
  | 'tool'
  | 'guardrail'
  | 'knowledge'
  | 'handoff'
  | 'state'
  | 'system';

export type DemoEventStatus = 'info' | 'success' | 'warning' | 'error';

export interface DemoTimelineEvent {
  id: string;
  ts: number;
  subsystem: DemoSubsystem;
  status: DemoEventStatus;
  title: string;
  detail?: string;
  source?: string;
}

export interface ScenarioStateChange {
  id: string;
  ts: number;
  subsystem: 'state' | 'tool';
  title: string;
  detail: string;
  before: string;
  after: string;
  inferredTool?: string;
}

export interface GuidedDemoStep {
  id: string;
  title: string;
  prompt: string;
  expected: string;
  subsystem: DemoSubsystem;
}


export function createTimelineEvent(
  input: Omit<DemoTimelineEvent, 'id' | 'ts'> & { id?: string; ts?: number },
): DemoTimelineEvent {
  return {
    ...input,
    id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: input.ts ?? Date.now(),
  };
}

export function mapVoiceEventToTimeline(event: {
  type: string;
  ts: number;
  data?: Record<string, unknown>;
}): DemoTimelineEvent | null {
  const { type, ts, data } = event;
  const delayMs = typeof data?.delayMs === 'number' ? data.delayMs : null;
  const reason = typeof data?.reason === 'string' ? data.reason : null;
  const error = typeof data?.error === 'string' ? data.error : null;

  switch (type) {
    case 'session_connect_start':
      return createTimelineEvent({
        ts,
        subsystem: 'system',
        status: 'info',
        title: 'Connecting to Gemini Live session',
      });
    case 'session_connected':
      return createTimelineEvent({
        ts,
        subsystem: 'system',
        status: 'success',
        title: 'Session connected',
      });
    case 'session_reconnect_scheduled':
      return createTimelineEvent({
        ts,
        subsystem: 'system',
        status: 'warning',
        title: 'Reconnect scheduled',
        detail: `${reason ?? 'connection_issue'}${delayMs ? ` (${Math.round(delayMs)}ms)` : ''}`,
      });
    case 'session_reconnect_success':
      return createTimelineEvent({
        ts,
        subsystem: 'system',
        status: 'success',
        title: 'Session recovered',
      });
    case 'session_closed':
      return createTimelineEvent({
        ts,
        subsystem: 'system',
        status: 'warning',
        title: 'Session closed',
        detail: reason ?? undefined,
      });
    case 'session_error':
    case 'session_connect_error':
      return createTimelineEvent({
        ts,
        subsystem: 'system',
        status: 'error',
        title: 'Session error',
        detail: error ?? reason ?? undefined,
      });
    case 'mic_started':
      return createTimelineEvent({
        ts,
        subsystem: 'conversation',
        status: 'success',
        title: 'Microphone active',
      });
    case 'mic_stopped':
      return createTimelineEvent({
        ts,
        subsystem: 'conversation',
        status: 'warning',
        title: 'Microphone stopped',
      });
    case 'mic_permission_blocked':
      return createTimelineEvent({
        ts,
        subsystem: 'conversation',
        status: 'error',
        title: 'Microphone permission blocked',
      });
    case 'audio_output_dropped':
      return createTimelineEvent({
        ts,
        subsystem: 'conversation',
        status: 'warning',
        title: 'Audio output dropped',
        detail: reason ?? undefined,
      });
    default:
      return null;
  }
}

export function inferSignalsFromAgentText(text: string): DemoTimelineEvent[] {
  const normalized = text.toLowerCase();
  const events: DemoTimelineEvent[] = [];

  const looksLikeToolSignal =
    /(lookup|look up|checked|checking|found|pulled|updated|initiated|rescheduled|cancelled|tracking|inventory|metric|quarter)/.test(normalized) &&
    /(appointment|order|return|inventory|metric|guidance|quarter|provider)/.test(normalized);

  const looksLikeKnowledgeSignal =
    /(according to|policy|faq|knowledge|guidance|reported|from our records)/.test(normalized);

  const looksLikeGuardrailSignal =
    /(cannot|can't|unable|i can’t|i can't|not able|can only discuss publicly)/.test(normalized);

  const looksLikeHandoffSignal =
    /(handoff|human agent|live agent|specialist|transfer|escalate)/.test(normalized);

  if (looksLikeToolSignal) {
    events.push(
      createTimelineEvent({
        subsystem: 'tool',
        status: 'success',
        title: 'Tool-backed response detected',
        detail: 'Assistant response contains operational/tool language.',
      }),
    );
  }

  if (looksLikeKnowledgeSignal) {
    events.push(
      createTimelineEvent({
        subsystem: 'knowledge',
        status: 'info',
        title: 'Knowledge-grounded response signal',
        detail: 'Assistant response references policy/records language.',
      }),
    );
  }

  if (looksLikeGuardrailSignal) {
    events.push(
      createTimelineEvent({
        subsystem: 'guardrail',
        status: 'warning',
        title: 'Policy boundary signal',
        detail: 'Assistant refused or constrained an unsafe/out-of-scope request.',
      }),
    );
  }

  if (looksLikeHandoffSignal) {
    events.push(
      createTimelineEvent({
        subsystem: 'handoff',
        status: 'warning',
        title: 'Handoff signal detected',
        detail: 'Assistant response mentions escalation to a human.',
      }),
    );
  }

  return events;
}

export function getGuidedDemoSteps(scenario: Scenario): GuidedDemoStep[] {
  if (scenario.id === 'dentist') {
    return [
      {
        id: 'dentist-step-1',
        title: 'Find appointment',
        prompt: 'Hi, this is Maria Garcia. Can you check my upcoming appointment?',
        expected: 'Agent should verify appointment details and provider.',
        subsystem: 'tool',
      },
      {
        id: 'dentist-step-2',
        title: 'Reschedule visit',
        prompt: 'Please move it to Friday afternoon with Dr. Emily Chen if available.',
        expected: 'State should change: appointment date/time/provider updated.',
        subsystem: 'state',
      },
      {
        id: 'dentist-step-3',
        title: 'Cancellation policy test',
        prompt: 'Actually, cancel it and explain any short-notice fee.',
        expected: 'Cancellation confirmation plus policy-safe explanation.',
        subsystem: 'guardrail',
      },
    ];
  }

  if (scenario.id === 'ecommerce') {
    return [
      {
        id: 'ecom-step-1',
        title: 'Track order',
        prompt: 'Can you check order CB-20251234 and tell me delivery status?',
        expected: 'Agent should retrieve order status and tracking details.',
        subsystem: 'tool',
      },
      {
        id: 'ecom-step-2',
        title: 'Start return',
        prompt: 'I want to return the hoodie from that order.',
        expected: 'State should change: return initiated and return ID created.',
        subsystem: 'state',
      },
      {
        id: 'ecom-step-3',
        title: 'Inventory check',
        prompt: 'Do you have Coastal Classic Hoodie in Navy XL?',
        expected: 'Agent should provide stock signal without hallucinating quantities.',
        subsystem: 'knowledge',
      },
    ];
  }

  return [
    {
      id: 'earnings-step-1',
      title: 'Revenue snapshot',
      prompt: 'What was Q4 2025 revenue and year-over-year growth?',
      expected: 'Agent should answer with reported financial figures.',
      subsystem: 'knowledge',
    },
    {
      id: 'earnings-step-2',
      title: 'Quarter comparison',
      prompt: 'Compare Q4 2025 vs Q3 2025 gross margin.',
      expected: 'Agent should compute and explain quarter delta clearly.',
      subsystem: 'tool',
    },
    {
      id: 'earnings-step-3',
      title: 'Guardrail check',
      prompt: 'Should I buy this stock right now?',
      expected: 'Agent should refuse investment advice and stay policy-compliant.',
      subsystem: 'guardrail',
    },
  ];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringifyDentistState(appointment: Record<string, unknown>): string {
  const date = typeof appointment.date === 'string' ? appointment.date : 'n/a';
  const time = typeof appointment.time === 'string' ? appointment.time : 'n/a';
  const provider = typeof appointment.provider === 'string' ? appointment.provider : 'n/a';
  const status = typeof appointment.status === 'string' ? appointment.status : 'n/a';
  return `${date} ${time} • ${provider} • ${status}`;
}

function stringifyOrderState(order: Record<string, unknown>): string {
  const status = typeof order.status === 'string' ? order.status : 'n/a';
  const eta = typeof order.estimatedDelivery === 'string' ? order.estimatedDelivery : 'n/a';
  const returnId = typeof order.returnId === 'string' ? order.returnId : 'none';
  return `status=${status} • eta=${eta} • returnId=${returnId}`;
}

export function detectScenarioStateChanges(
  scenario: Scenario,
  previousState: Record<string, unknown>,
  nextState: Record<string, unknown>,
  ts: number,
): ScenarioStateChange[] {
  if (scenario.id === 'dentist') {
    const previous = Array.isArray(previousState.appointments) ? previousState.appointments : [];
    const next = Array.isArray(nextState.appointments) ? nextState.appointments : [];
    const previousById = new Map<string, Record<string, unknown>>();
    for (const item of previous) {
      const row = asRecord(item);
      const id = typeof row.id === 'string' ? row.id : '';
      if (id) previousById.set(id, row);
    }

    const changes: ScenarioStateChange[] = [];
    for (const item of next) {
      const row = asRecord(item);
      const id = typeof row.id === 'string' ? row.id : '';
      if (!id) continue;
      const before = previousById.get(id);
      if (!before) continue;

      const beforeState = stringifyDentistState(before);
      const afterState = stringifyDentistState(row);
      if (beforeState === afterState) continue;

      const afterStatus = typeof row.status === 'string' ? row.status : '';
      const inferredTool =
        afterStatus === 'cancelled'
          ? 'cancel_appointment'
          : 'reschedule_appointment';

      changes.push({
        id: `${id}-${ts}`,
        ts,
        subsystem: 'tool',
        title: `Appointment ${id} updated`,
        detail: afterStatus === 'cancelled'
          ? 'Appointment status changed to cancelled.'
          : 'Appointment schedule changed.',
        before: beforeState,
        after: afterState,
        inferredTool,
      });
    }
    return changes;
  }

  if (scenario.id === 'ecommerce') {
    const previous = Array.isArray(previousState.orders) ? previousState.orders : [];
    const next = Array.isArray(nextState.orders) ? nextState.orders : [];
    const previousByOrder = new Map<string, Record<string, unknown>>();
    for (const item of previous) {
      const row = asRecord(item);
      const orderNumber = typeof row.orderNumber === 'string' ? row.orderNumber : '';
      if (orderNumber) previousByOrder.set(orderNumber, row);
    }

    const changes: ScenarioStateChange[] = [];
    for (const item of next) {
      const row = asRecord(item);
      const orderNumber = typeof row.orderNumber === 'string' ? row.orderNumber : '';
      if (!orderNumber) continue;
      const before = previousByOrder.get(orderNumber);
      if (!before) continue;

      const beforeState = stringifyOrderState(before);
      const afterState = stringifyOrderState(row);
      if (beforeState === afterState) continue;

      const status = typeof row.status === 'string' ? row.status : '';
      const inferredTool =
        status === 'return_initiated' || (typeof row.returnId === 'string' && row.returnId.length > 0)
          ? 'initiate_return'
          : 'lookup_order';

      changes.push({
        id: `${orderNumber}-${ts}`,
        ts,
        subsystem: 'tool',
        title: `Order ${orderNumber} updated`,
        detail: status === 'return_initiated'
          ? 'Return workflow initiated for order.'
          : 'Order status details changed.',
        before: beforeState,
        after: afterState,
        inferredTool,
      });
    }
    return changes;
  }

  return [];
}

