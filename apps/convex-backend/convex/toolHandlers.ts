/**
 * Internal mock tool handlers for seeded demo scenarios.
 *
 * When a tool has no external `endpoint`, executeToolAction falls through
 * to handleInternalTool() which returns realistic mock data. This lets
 * all 9 seeded demo tools work without external API infrastructure.
 *
 * Handlers are now state-aware: they receive the current scenario state,
 * and can return a `stateUpdate` alongside the result. The caller
 * (toolsInternal.ts) persists state updates to the scenarioState table.
 *
 * Plain TypeScript module — no Convex decorators, no "use node".
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolParams = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolResult = { success: true; data: any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScenarioState = Record<string, any>;

export interface HandlerResult {
  result: ToolResult;
  stateUpdate?: ScenarioState;
}

// ────────────────────────────────────────────────────────────────
// Initial State Data
// ────────────────────────────────────────────────────────────────

const DENTIST_INITIAL_STATE = {
  appointments: [
    {
      id: "APT-10041",
      patient: "Maria Garcia",
      date: "2026-02-10",
      time: "9:00 AM",
      provider: "Dr. Emily Chen",
      type: "Routine Cleaning",
      status: "confirmed",
    },
    {
      id: "APT-10042",
      patient: "James Wilson",
      date: "2026-02-10",
      time: "10:30 AM",
      provider: "Lisa Thompson",
      type: "Deep Cleaning",
      status: "confirmed",
    },
    {
      id: "APT-10043",
      patient: "Sarah Johnson",
      date: "2026-02-11",
      time: "2:30 PM",
      provider: "Dr. James Park",
      type: "Invisalign Consultation",
      status: "confirmed",
    },
    {
      id: "APT-10044",
      patient: "David Kim",
      date: "2026-02-12",
      time: "1:00 PM",
      provider: "Dr. Emily Chen",
      type: "Crown Fitting",
      status: "confirmed",
    },
  ],
};

const ECOMMERCE_INITIAL_STATE = {
  orders: [
    {
      orderNumber: "CB-20251234",
      customer: "Alex Thompson",
      email: "alex.t@email.com",
      status: "shipped",
      orderDate: "2026-01-28",
      shippedDate: "2026-01-29",
      estimatedDelivery: "2026-02-03",
      trackingNumber: "1Z999AA10123456784",
      carrier: "UPS",
      items: [
        {
          name: "Coastal Classic Hoodie",
          sku: "CB-HOODIE-NAV-M",
          color: "Navy",
          size: "M",
          quantity: 1,
          price: "$68.00",
        },
        {
          name: "Tide Pool Collection (set of 3 mini candles)",
          sku: "CB-CANDLE-TP3",
          color: "Assorted",
          size: "One Size",
          quantity: 1,
          price: "$28.00",
        },
      ],
      subtotal: "$96.00",
      shipping: "FREE",
      tax: "$7.92",
      total: "$103.92",
      shippingAddress: { city: "Austin", state: "TX", zip: "78704" },
    },
    {
      orderNumber: "CB-20251189",
      customer: "Jordan Lee",
      email: "jordan.lee@email.com",
      status: "delivered",
      orderDate: "2026-01-20",
      shippedDate: "2026-01-21",
      deliveredDate: "2026-01-25",
      trackingNumber: "9400111899223100067890",
      carrier: "USPS",
      items: [
        {
          name: "Beach Walk Linen Pants",
          sku: "CB-LINEN-SAND-M",
          color: "Sand",
          size: "M",
          quantity: 1,
          price: "$72.00",
        },
        {
          name: "Sunrise Tee",
          sku: "CB-TEE-WHT-M",
          color: "White",
          size: "M",
          quantity: 2,
          price: "$38.00",
        },
      ],
      subtotal: "$148.00",
      shipping: "FREE",
      tax: "$12.21",
      total: "$160.21",
      shippingAddress: { city: "Portland", state: "OR", zip: "97201" },
    },
  ],
  inventory: [
    { sku: "CB-HOODIE-NAV-S", name: "Coastal Classic Hoodie", color: "Navy", size: "S", quantity: 23 },
    { sku: "CB-HOODIE-NAV-M", name: "Coastal Classic Hoodie", color: "Navy", size: "M", quantity: 8 },
    { sku: "CB-HOODIE-NAV-L", name: "Coastal Classic Hoodie", color: "Navy", size: "L", quantity: 15 },
    { sku: "CB-HOODIE-NAV-XL", name: "Coastal Classic Hoodie", color: "Navy", size: "XL", quantity: 0 },
    { sku: "CB-HOODIE-SAGE-S", name: "Coastal Classic Hoodie", color: "Sage", size: "S", quantity: 12 },
    { sku: "CB-HOODIE-SAGE-M", name: "Coastal Classic Hoodie", color: "Sage", size: "M", quantity: 5 },
    { sku: "CB-HOODIE-SAGE-L", name: "Coastal Classic Hoodie", color: "Sage", size: "L", quantity: 0 },
    { sku: "CB-HOODIE-OAT-M", name: "Coastal Classic Hoodie", color: "Oatmeal", size: "M", quantity: 18 },
    { sku: "CB-HOODIE-OAT-L", name: "Coastal Classic Hoodie", color: "Oatmeal", size: "L", quantity: 11 },
    { sku: "CB-CANDLE-CM", name: "Coastal Morning Candle", color: "Coastal Morning", size: "One Size", quantity: 45 },
    { sku: "CB-CANDLE-SH", name: "Sunset Harbor Candle", color: "Sunset Harbor", size: "One Size", quantity: 32 },
    { sku: "CB-CANDLE-TP3", name: "Tide Pool Collection", color: "Tide Pool Set", size: "One Size", quantity: 19 },
    { sku: "CB-LINEN-SAND-S", name: "Beach Walk Linen Pants", color: "Sand", size: "S", quantity: 14 },
    { sku: "CB-LINEN-SAND-M", name: "Beach Walk Linen Pants", color: "Sand", size: "M", quantity: 9 },
    { sku: "CB-LINEN-SAND-L", name: "Beach Walk Linen Pants", color: "Sand", size: "L", quantity: 6 },
    { sku: "CB-LINEN-OB-M", name: "Beach Walk Linen Pants", color: "Ocean Blue", size: "M", quantity: 0 },
    { sku: "CB-LINEN-OB-L", name: "Beach Walk Linen Pants", color: "Ocean Blue", size: "L", quantity: 3 },
    { sku: "CB-TEE-WHT-S", name: "Sunrise Tee", color: "White", size: "S", quantity: 30 },
    { sku: "CB-TEE-WHT-M", name: "Sunrise Tee", color: "White", size: "M", quantity: 22 },
    { sku: "CB-TEE-WHT-L", name: "Sunrise Tee", color: "White", size: "L", quantity: 17 },
    { sku: "CB-TEE-WHT-XL", name: "Sunrise Tee", color: "White", size: "XL", quantity: 8 },
  ],
};

const INITIAL_STATES: Record<string, ScenarioState> = {
  "demo-dentist": DENTIST_INITIAL_STATE,
  "demo-ecommerce": ECOMMERCE_INITIAL_STATE,
};

/** Get the initial state for a given app slug. Returns null for apps without mutable state (e.g. earnings). */
export function getInitialState(appSlug: string): ScenarioState | null {
  return INITIAL_STATES[appSlug] ?? null;
}

// ────────────────────────────────────────────────────────────────
// Dentist scenario handlers
// ────────────────────────────────────────────────────────────────

const PROVIDERS = ["Dr. Emily Chen", "Dr. James Park", "Lisa Thompson"];
const SLOT_TIMES = ["9:00 AM", "10:30 AM", "1:00 PM", "2:30 PM", "4:00 PM"];

function handleCheckAvailability(params: ToolParams, state?: ScenarioState): HandlerResult {
  const startDate = params.startDate ?? new Date().toISOString().slice(0, 10);
  const provider = params.provider as string | undefined;

  // Get booked slots from state to filter them out
  const appointments = state?.appointments as Array<{ date: string; time: string; provider: string; status: string }> | undefined;
  const bookedSlots = new Set<string>();
  if (appointments) {
    for (const apt of appointments) {
      if (apt.status !== "cancelled") {
        bookedSlots.add(`${apt.date}|${apt.time}|${apt.provider}`);
      }
    }
  }

  const baseDate = new Date(startDate + "T00:00:00");
  const slots = [];
  let dayOffset = 0;

  for (let i = 0; i < 6 && slots.length < 4; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + dayOffset);
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }

    const slotProvider = provider ?? PROVIDERS[i % PROVIDERS.length];
    const date = d.toISOString().slice(0, 10);
    const time = SLOT_TIMES[i % SLOT_TIMES.length];

    // Skip if this slot is booked
    if (!bookedSlots.has(`${date}|${time}|${slotProvider}`)) {
      slots.push({ date, time, provider: slotProvider, available: true });
    }

    dayOffset += i % 2 === 0 ? 1 : 0;
  }

  return {
    result: {
      success: true,
      data: {
        slots,
        officeHours: "Mon-Fri 8 AM-6 PM, Sat 9 AM-2 PM",
        note: "Slots shown are next available. Call (503) 555-0134 for emergency scheduling.",
      },
    },
  };
}

function handleRescheduleAppointment(params: ToolParams, state?: ScenarioState): HandlerResult {
  const appointmentId = params.appointmentId ?? "APT-10042";
  const newDate = params.newDate ?? "2026-02-14";
  const newTime = params.newTime ?? "2:30 PM";

  if (!state?.appointments) {
    return {
      result: {
        success: true,
        data: {
          appointmentId,
          newDate,
          newTime,
          status: "rescheduled",
          confirmationMessage: "Your appointment has been rescheduled.",
        },
      },
    };
  }

  const appointments = [...state.appointments] as Array<Record<string, string>>;
  const idx = appointments.findIndex((a) => a.id === appointmentId);

  if (idx === -1) {
    return {
      result: {
        success: true,
        data: { error: `Appointment ${appointmentId} not found.` },
      },
    };
  }

  const apt = { ...appointments[idx] };
  const previousDate = apt.date;
  const previousTime = apt.time;
  apt.date = newDate;
  apt.time = newTime;
  apt.status = "rescheduled";
  appointments[idx] = apt;

  return {
    result: {
      success: true,
      data: {
        appointmentId,
        previousDate,
        previousTime,
        newDate,
        newTime,
        provider: apt.provider,
        status: "rescheduled",
        confirmationMessage:
          "Your appointment has been rescheduled. You'll receive a confirmation text and email shortly. Please arrive 10 minutes early.",
      },
    },
    stateUpdate: { ...state, appointments },
  };
}

function handleCancelAppointment(params: ToolParams, state?: ScenarioState): HandlerResult {
  const appointmentId = params.appointmentId ?? "APT-10042";
  const isShortNotice = params.shortNotice ?? false;

  if (!state?.appointments) {
    return {
      result: {
        success: true,
        data: {
          appointmentId,
          status: "cancelled",
          cancellationFee: isShortNotice ? "$50.00" : null,
          confirmationMessage: "Your appointment has been cancelled.",
        },
      },
    };
  }

  const appointments = [...state.appointments] as Array<Record<string, string>>;
  const idx = appointments.findIndex((a) => a.id === appointmentId);

  if (idx === -1) {
    return {
      result: {
        success: true,
        data: { error: `Appointment ${appointmentId} not found.` },
      },
    };
  }

  const apt = { ...appointments[idx] };
  apt.status = "cancelled";
  appointments[idx] = apt;

  return {
    result: {
      success: true,
      data: {
        appointmentId,
        status: "cancelled",
        cancellationFee: isShortNotice ? "$50.00" : null,
        feeNote: isShortNotice
          ? "A $50 late cancellation fee applies for cancellations with less than 24 hours notice."
          : "No cancellation fee — cancelled with sufficient notice.",
        reason: params.reason ?? "patient_request",
        confirmationMessage:
          "Your appointment has been cancelled. If you'd like to reschedule, just let me know.",
      },
    },
    stateUpdate: { ...state, appointments },
  };
}

// ────────────────────────────────────────────────────────────────
// Earnings scenario (no mutable state)
// ────────────────────────────────────────────────────────────────

const METRICS_DATA: Record<string, Record<string, { value: string; unit: string }>> = {
  Q4_2025: {
    revenue: { value: "$580M", unit: "USD" },
    gross_margin: { value: "72.5%", unit: "percent" },
    operating_income: { value: "$116M", unit: "USD" },
    operating_margin: { value: "20.0%", unit: "percent" },
    net_income: { value: "$92M", unit: "USD" },
    eps: { value: "$1.15", unit: "USD per share" },
    free_cash_flow: { value: "$135M", unit: "USD" },
    fcf_margin: { value: "23.3%", unit: "percent" },
    arr: { value: "$2.32B", unit: "USD" },
    nrr: { value: "118%", unit: "percent" },
    rpo: { value: "$4.1B", unit: "USD" },
    customers_total: { value: "12,400+", unit: "count" },
    customers_100k: { value: "1,850", unit: "count" },
    customers_1m: { value: "185", unit: "count" },
    cloudsuite_revenue: { value: "$290M", unit: "USD" },
    dataflow_revenue: { value: "$185M", unit: "USD" },
    secureedge_revenue: { value: "$105M", unit: "USD" },
  },
  Q4_2024: {
    revenue: { value: "$500M", unit: "USD" },
    gross_margin: { value: "71.2%", unit: "percent" },
    operating_income: { value: "$92.5M", unit: "USD" },
    operating_margin: { value: "18.5%", unit: "percent" },
    net_income: { value: "$78M", unit: "USD" },
    eps: { value: "$0.98", unit: "USD per share" },
    free_cash_flow: { value: "$110M", unit: "USD" },
    arr: { value: "$1.95B", unit: "USD" },
    customers_total: { value: "10,800", unit: "count" },
    customers_100k: { value: "1,520", unit: "count" },
    customers_1m: { value: "142", unit: "count" },
  },
  Q3_2025: {
    revenue: { value: "$558M", unit: "USD" },
    gross_margin: { value: "72.0%", unit: "percent" },
    operating_income: { value: "$108M", unit: "USD" },
    net_income: { value: "$86M", unit: "USD" },
    eps: { value: "$1.08", unit: "USD per share" },
    free_cash_flow: { value: "$125M", unit: "USD" },
  },
  FY2025: {
    revenue: { value: "$2.1B", unit: "USD" },
    gross_margin: { value: "71.8%", unit: "percent" },
    operating_income: { value: "$405M", unit: "USD" },
    operating_margin: { value: "19.3%", unit: "percent" },
    net_income: { value: "$336M", unit: "USD" },
    eps: { value: "$4.20", unit: "USD per share" },
    non_gaap_eps: { value: "$5.25", unit: "USD per share" },
    free_cash_flow: { value: "$475M", unit: "USD" },
    fcf_margin: { value: "22.6%", unit: "percent" },
    cloudsuite_revenue: { value: "$1.04B", unit: "USD" },
    dataflow_revenue: { value: "$680M", unit: "USD" },
    secureedge_revenue: { value: "$380M", unit: "USD" },
    employees: { value: "~4,200", unit: "count" },
  },
  FY2024: {
    revenue: { value: "$1.78B", unit: "USD" },
    gross_margin: { value: "70.5%", unit: "percent" },
    eps: { value: "$3.55", unit: "USD per share" },
    non_gaap_eps: { value: "$4.40", unit: "USD per share" },
    employees: { value: "~3,800", unit: "count" },
  },
};

function parseNumericValue(val: string): number | null {
  const cleaned = val.replace(/[~$,%+]/g, "").trim();
  if (cleaned.endsWith("B")) return parseFloat(cleaned) * 1_000_000_000;
  if (cleaned.endsWith("M")) return parseFloat(cleaned) * 1_000_000;
  const n = parseFloat(cleaned.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function handleLookupMetric(params: ToolParams): HandlerResult | null {
  const metric = (params.metric as string)?.toLowerCase().replace(/\s+/g, "_");
  const period = (params.period as string)?.toUpperCase().replace(/\s+/g, "");

  const periodData = METRICS_DATA[period];
  if (!periodData) {
    return {
      result: {
        success: true,
        data: {
          error: `No data available for period "${period}". Available periods: ${Object.keys(METRICS_DATA).join(", ")}`,
        },
      },
    };
  }

  const metricData = periodData[metric];
  if (!metricData) {
    return {
      result: {
        success: true,
        data: {
          error: `Metric "${metric}" not found for ${period}. Available metrics: ${Object.keys(periodData).join(", ")}`,
        },
      },
    };
  }

  return {
    result: {
      success: true,
      data: {
        metric,
        period,
        value: metricData.value,
        unit: metricData.unit,
        source: "TechCorp Inc. SEC filings and earnings releases",
      },
    },
  };
}

function handleCompareQuarters(params: ToolParams): HandlerResult | null {
  const metric = (params.metric as string)?.toLowerCase().replace(/\s+/g, "_");
  const period1 = (params.period1 as string)?.toUpperCase().replace(/\s+/g, "");
  const period2 = (params.period2 as string)?.toUpperCase().replace(/\s+/g, "");

  const data1 = METRICS_DATA[period1]?.[metric];
  const data2 = METRICS_DATA[period2]?.[metric];

  if (!data1 || !data2) {
    return {
      result: {
        success: true,
        data: {
          error: `Cannot compare: ${!data1 ? `${metric} not found for ${period1}` : `${metric} not found for ${period2}`}`,
          availablePeriods: Object.keys(METRICS_DATA),
        },
      },
    };
  }

  const num1 = parseNumericValue(data1.value);
  const num2 = parseNumericValue(data2.value);
  let delta: string | null = null;
  let percentChange: string | null = null;

  if (num1 !== null && num2 !== null) {
    const diff = num1 - num2;
    delta = diff >= 0 ? `+${formatValue(diff, data1.unit)}` : formatValue(diff, data1.unit);
    percentChange = num2 !== 0 ? `${((diff / num2) * 100).toFixed(1)}%` : null;
  }

  return {
    result: {
      success: true,
      data: {
        metric,
        period1: { period: period1, value: data1.value },
        period2: { period: period2, value: data2.value },
        delta,
        percentChange,
        source: "TechCorp Inc. SEC filings and earnings releases",
      },
    },
  };
}

function formatValue(n: number, unit: string): string {
  if (unit === "percent") return `${n.toFixed(1)}%`;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  return `$${n.toFixed(2)}`;
}

// ────────────────────────────────────────────────────────────────
// E-commerce scenario handlers
// ────────────────────────────────────────────────────────────────

function handleLookupOrder(params: ToolParams, state?: ScenarioState): HandlerResult {
  const orderNumber = params.orderNumber ?? params.email;

  if (state?.orders) {
    const orders = state.orders as Array<Record<string, unknown>>;
    const order = orders.find(
      (o) => o.orderNumber === orderNumber || o.email === params.email,
    );
    if (order) {
      return { result: { success: true, data: order } };
    }
    return {
      result: {
        success: true,
        data: {
          error: `Order "${orderNumber}" not found. Try CB-20251234 or CB-20251189.`,
        },
      },
    };
  }

  // Fallback if no state
  return {
    result: {
      success: true,
      data: {
        orderNumber: orderNumber ?? "CB-20251234",
        status: "shipped",
        orderDate: "2026-01-28",
        items: [
          { name: "Coastal Classic Hoodie", sku: "CB-HOODIE-NAV-M", price: "$68.00" },
          { name: "Tide Pool Collection", sku: "CB-CANDLE-TP3", price: "$28.00" },
        ],
        total: "$103.92",
      },
    },
  };
}

function handleInitiateReturn(params: ToolParams, state?: ScenarioState): HandlerResult {
  const orderNumber = params.orderNumber ?? "CB-20251234";
  const itemSku = params.itemSku ?? "CB-HOODIE-NAV-M";
  const reason = params.reason ?? "changed_mind";

  const returnId = `RET-${Date.now().toString(36).toUpperCase()}`;

  if (state?.orders) {
    const orders = [...state.orders] as Array<Record<string, unknown>>;
    const idx = orders.findIndex((o) => o.orderNumber === orderNumber);

    if (idx === -1) {
      return {
        result: {
          success: true,
          data: { error: `Order "${orderNumber}" not found.` },
        },
      };
    }

    const order = { ...orders[idx] };
    order.status = "return_initiated";
    order.returnId = returnId;
    order.returnReason = reason;
    order.returnItemSku = itemSku;
    orders[idx] = order;

    // Find the item for refund amount
    const items = order.items as Array<{ sku: string; price: string }> | undefined;
    const item = items?.find((i) => i.sku === itemSku);

    return {
      result: {
        success: true,
        data: {
          returnId,
          orderNumber,
          itemSku,
          reason,
          status: "authorized",
          refundAmount: item?.price ?? "$68.00",
          refundMethod: "original_payment_method",
          returnLabel: {
            carrier: "USPS",
            trackingNumber: "9400111899223100012345",
            labelUrl: "https://coastalbreeze.com/returns/label/download",
            prepaid: true,
          },
          instructions: [
            "Pack the item in its original packaging with tags attached.",
            "Print the prepaid return label and attach it to your package.",
            "Drop off at any USPS location within 7 days.",
            "Refund will be processed within 5-7 business days after we receive the item.",
          ],
          exchangeFor: params.exchangeFor ?? null,
        },
      },
      stateUpdate: { ...state, orders },
    };
  }

  // Fallback without state
  const itemPrices: Record<string, string> = {
    "CB-HOODIE-NAV-M": "$68.00",
    "CB-CANDLE-TP3": "$28.00",
  };

  return {
    result: {
      success: true,
      data: {
        returnId,
        orderNumber,
        itemSku,
        reason,
        status: "authorized",
        refundAmount: itemPrices[itemSku] ?? "$68.00",
        refundMethod: "original_payment_method",
        returnLabel: {
          carrier: "USPS",
          trackingNumber: "9400111899223100012345",
          labelUrl: "https://coastalbreeze.com/returns/label/download",
          prepaid: true,
        },
        instructions: [
          "Pack the item in its original packaging with tags attached.",
          "Print the prepaid return label and attach it to your package.",
          "Drop off at any USPS location within 7 days.",
          "Refund will be processed within 5-7 business days after we receive the item.",
        ],
        exchangeFor: params.exchangeFor ?? null,
      },
    },
  };
}

function handleCheckInventory(params: ToolParams, state?: ScenarioState): HandlerResult {
  const productName = (params.productName as string)?.toLowerCase() ?? "";
  const size = params.size as string | undefined;
  const color = params.color as string | undefined;

  if (state?.inventory) {
    const allItems = state.inventory as Array<{
      sku: string; name: string; color: string; size: string; quantity: number;
    }>;

    // Find matching items by product name
    const matches = allItems.filter((item) =>
      item.name.toLowerCase().includes(productName) ||
      item.sku.toLowerCase().includes(productName.replace(/\s+/g, "-")),
    );

    if (matches.length === 0) {
      return {
        result: {
          success: true,
          data: {
            found: false,
            message: `Product "${params.productName}" not found. Try searching for: hoodie, candle, linen pants, or tee.`,
          },
        },
      };
    }

    let variants = matches.map((m) => ({
      size: m.size,
      color: m.color,
      inStock: m.quantity > 0,
      quantity: m.quantity,
    }));

    if (size) variants = variants.filter((v) => v.size.toLowerCase() === size.toLowerCase());
    if (color) variants = variants.filter((v) => v.color.toLowerCase().includes(color.toLowerCase()));

    return {
      result: {
        success: true,
        data: {
          found: true,
          productName: matches[0].name,
          sku: matches[0].sku.replace(/-[A-Z]+-[A-Z]+$/, ""),
          variants,
          totalInStock: variants.filter((v) => v.inStock).length,
          totalVariants: variants.length,
        },
      },
    };
  }

  // Fallback: hardcoded inventory (original behavior)
  const inventory: Array<{
    match: string;
    name: string;
    sku: string;
    variants: Array<{ size: string; color: string; inStock: boolean; quantity: number }>;
  }> = [
    {
      match: "hoodie",
      name: "Coastal Classic Hoodie",
      sku: "CB-HOODIE",
      variants: [
        { size: "S", color: "Navy", inStock: true, quantity: 23 },
        { size: "M", color: "Navy", inStock: true, quantity: 8 },
        { size: "L", color: "Navy", inStock: true, quantity: 15 },
        { size: "XL", color: "Navy", inStock: false, quantity: 0 },
        { size: "S", color: "Sage", inStock: true, quantity: 12 },
        { size: "M", color: "Sage", inStock: true, quantity: 5 },
        { size: "L", color: "Sage", inStock: false, quantity: 0 },
        { size: "M", color: "Oatmeal", inStock: true, quantity: 18 },
        { size: "L", color: "Oatmeal", inStock: true, quantity: 11 },
      ],
    },
    {
      match: "candle|tide pool|coastal morning|sunset harbor",
      name: "Candles",
      sku: "CB-CANDLE",
      variants: [
        { size: "One Size", color: "Coastal Morning", inStock: true, quantity: 45 },
        { size: "One Size", color: "Sunset Harbor", inStock: true, quantity: 32 },
        { size: "One Size", color: "Tide Pool Set", inStock: true, quantity: 19 },
      ],
    },
    {
      match: "linen pants|beach walk",
      name: "Beach Walk Linen Pants",
      sku: "CB-LINEN",
      variants: [
        { size: "S", color: "Sand", inStock: true, quantity: 14 },
        { size: "M", color: "Sand", inStock: true, quantity: 9 },
        { size: "L", color: "Sand", inStock: true, quantity: 6 },
        { size: "M", color: "Ocean Blue", inStock: false, quantity: 0 },
        { size: "L", color: "Ocean Blue", inStock: true, quantity: 3 },
      ],
    },
    {
      match: "tee|sunrise",
      name: "Sunrise Tee",
      sku: "CB-TEE",
      variants: [
        { size: "S", color: "White", inStock: true, quantity: 30 },
        { size: "M", color: "White", inStock: true, quantity: 22 },
        { size: "L", color: "White", inStock: true, quantity: 17 },
        { size: "XL", color: "White", inStock: true, quantity: 8 },
      ],
    },
  ];

  const match = inventory.find((p) => new RegExp(p.match, "i").test(productName));
  if (!match) {
    return {
      result: {
        success: true,
        data: {
          found: false,
          message: `Product "${params.productName}" not found. Try searching for: hoodie, candle, linen pants, or tee.`,
        },
      },
    };
  }

  let variants = match.variants;
  if (size) variants = variants.filter((v) => v.size.toLowerCase() === size.toLowerCase());
  if (color) variants = variants.filter((v) => v.color.toLowerCase().includes(color.toLowerCase()));

  return {
    result: {
      success: true,
      data: {
        found: true,
        productName: match.name,
        sku: match.sku,
        variants,
        totalInStock: variants.filter((v) => v.inStock).length,
        totalVariants: variants.length,
      },
    },
  };
}

function handleTransferToHuman(params: ToolParams): HandlerResult {
  return {
    result: {
      success: true,
      data: {
        handoffId: `HO-${Date.now().toString(36).toUpperCase()}`,
        status: "queued",
        reason: params.reason ?? "customer_request",
        summary: params.summary ?? "Customer requested live agent assistance.",
        estimatedWaitTime: "2-3 minutes",
        queuePosition: 2,
        message:
          "I've connected you to our support team. A live agent will be with you shortly. Your conversation summary has been shared so you won't need to repeat yourself.",
      },
    },
  };
}

// ────────────────────────────────────────────────────────────────
// Main dispatcher
// ────────────────────────────────────────────────────────────────

type StatefulHandler = (params: ToolParams, state?: ScenarioState) => HandlerResult | null;

const HANDLERS: Record<string, StatefulHandler> = {
  // Dentist
  check_availability: handleCheckAvailability,
  reschedule_appointment: handleRescheduleAppointment,
  cancel_appointment: handleCancelAppointment,
  // Earnings
  lookup_metric: (params) => handleLookupMetric(params),
  compare_quarters: (params) => handleCompareQuarters(params),
  // E-commerce
  lookup_order: handleLookupOrder,
  initiate_return: handleInitiateReturn,
  check_inventory: handleCheckInventory,
  transfer_to_human: (params) => handleTransferToHuman(params),
};

/**
 * Execute an internal mock handler for a demo tool.
 * Returns a HandlerResult with `result` and optional `stateUpdate`,
 * or null if the tool is not a known demo tool.
 */
export function handleInternalTool(
  toolName: string,
  params: ToolParams,
  state?: ScenarioState,
): HandlerResult | null {
  const handler = HANDLERS[toolName];
  if (!handler) return null;
  return handler(params, state);
}
