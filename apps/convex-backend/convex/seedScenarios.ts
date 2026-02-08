"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getInitialState } from "./toolHandlers";

// ────────────────────────────────────────────────────────────────
// Scenario Data
// ────────────────────────────────────────────────────────────────

interface ScenarioData {
  slug: string;
  name: string;
  systemPrompt: string;
  personaName: string;
  personaGreeting: string;
  personaTone: string;
  tools: Array<{
    name: string;
    description: string;
    parametersSchema: string;
    requiresConfirmation: boolean;
    requiresAuth: boolean;
  }>;
  guardrailRules: Array<{
    type: string;
    pattern: string;
    action: string;
    userMessage?: string;
  }>;
  knowledgeDocs: Array<{
    title: string;
    content: string;
    category: string;
    sourceType: string;
  }>;
}

const DENTIST: ScenarioData = {
  slug: "demo-dentist",
  name: "Bright Smile Dental",
  systemPrompt: `You are Sarah, a friendly and professional front-desk receptionist at Bright Smile Dental.

## About Bright Smile Dental
- Family dental practice in downtown Portland, OR
- Open Mon–Fri 8 AM–6 PM, Sat 9 AM–2 PM, closed Sunday
- Providers: Dr. Emily Chen (general), Dr. James Park (orthodontics), Lisa Thompson (hygienist)
- Services: cleanings, fillings, crowns, whitening, Invisalign, emergency care

## Your Role
- Help patients schedule, reschedule, or cancel appointments
- Answer questions about services, hours, insurance, and office policies
- Be warm but efficient — patients are often calling during busy days

## Tools Available
- **check_availability**: Look up open appointment slots by date and provider
- **reschedule_appointment**: Move an existing appointment to a new date/time
- **cancel_appointment**: Cancel an existing appointment

## Behavioral Guidelines
- Always confirm the patient's name and date of birth before making changes
- Suggest the next available slot when rescheduling
- If a patient asks for medical advice, politely redirect them to speak with the dentist during their visit
- Never recommend other dental practices
- Keep responses concise and conversational`,
  personaName: "Sarah",
  personaGreeting:
    "Hi there! I'm Sarah from Bright Smile Dental. How can I help you today?",
  personaTone: "warm, professional, efficient",
  tools: [
    {
      name: "check_availability",
      description:
        "Look up open appointment slots for a given date range and optional provider.",
      parametersSchema: JSON.stringify({
        type: "object",
        properties: {
          startDate: {
            type: "string",
            description: "Start date (YYYY-MM-DD)",
          },
          endDate: {
            type: "string",
            description: "End date (YYYY-MM-DD)",
          },
          provider: {
            type: "string",
            description: "Provider name (optional)",
          },
        },
        required: ["startDate"],
      }),
      requiresConfirmation: false,
      requiresAuth: false,
    },
    {
      name: "reschedule_appointment",
      description:
        "Reschedule an existing appointment to a new date and time.",
      parametersSchema: JSON.stringify({
        type: "object",
        properties: {
          appointmentId: {
            type: "string",
            description: "Existing appointment ID",
          },
          newDate: {
            type: "string",
            description: "New date (YYYY-MM-DD)",
          },
          newTime: {
            type: "string",
            description: "New time (HH:MM)",
          },
        },
        required: ["appointmentId", "newDate", "newTime"],
      }),
      requiresConfirmation: true,
      requiresAuth: true,
    },
    {
      name: "cancel_appointment",
      description: "Cancel an existing appointment.",
      parametersSchema: JSON.stringify({
        type: "object",
        properties: {
          appointmentId: {
            type: "string",
            description: "Appointment ID to cancel",
          },
          reason: {
            type: "string",
            description: "Reason for cancellation (optional)",
          },
        },
        required: ["appointmentId"],
      }),
      requiresConfirmation: true,
      requiresAuth: true,
    },
  ],
  guardrailRules: [
    {
      type: "topic",
      pattern: "medical advice|diagnos|prescri|medication",
      action: "block",
      userMessage:
        "I'm not able to provide medical advice. Please discuss that with Dr. Chen or Dr. Park during your visit.",
    },
    {
      type: "topic",
      pattern: "competitor|another dentist|other dental|different practice",
      action: "block",
      userMessage:
        "I can only help with Bright Smile Dental services. Is there anything else I can help you with?",
    },
  ],
  knowledgeDocs: [
    {
      title: "Office Hours & Location",
      content: `Bright Smile Dental is located at 420 NW 5th Avenue, Suite 200, Portland, OR 97209. Phone: (503) 555-0134.

Hours:
- Monday–Friday: 8:00 AM – 6:00 PM
- Saturday: 9:00 AM – 2:00 PM
- Sunday: Closed

Parking is available in the building garage (first 2 hours validated). The office is accessible via MAX Light Rail (Old Town/Chinatown stop).`,
      category: "general",
      sourceType: "manual",
    },
    {
      title: "Services & Pricing",
      content: `Services offered at Bright Smile Dental:

Preventive:
- Routine cleaning (prophylaxis): $120–$180
- Deep cleaning (scaling/root planing): $250–$400 per quadrant
- Comprehensive exam: $95
- Dental X-rays (full mouth): $150

Restorative:
- Composite filling: $175–$300
- Porcelain crown: $1,100–$1,400
- Root canal (anterior): $800–$1,000
- Root canal (molar): $1,000–$1,300

Cosmetic:
- In-office whitening (Zoom): $450
- Take-home whitening kit: $250
- Porcelain veneers: $1,200–$1,800 per tooth

Orthodontics:
- Invisalign (full treatment): $4,500–$6,500
- Invisalign (minor): $2,500–$3,500
- Retainers: $300–$500

All prices are estimates. Final cost depends on insurance coverage and treatment complexity.`,
      category: "services",
      sourceType: "manual",
    },
    {
      title: "Insurance & Payment",
      content: `Accepted insurance plans:
- Delta Dental (PPO and Premier)
- Cigna Dental
- MetLife
- Aetna
- Guardian
- United Healthcare Dental

We also accept:
- HSA/FSA accounts
- CareCredit financing (0% APR for 12 months on treatments over $500)
- Cash, check, and all major credit cards

Patients without insurance receive a 15% discount on all services when paying at time of visit. We offer a Bright Smile Membership Plan at $299/year which includes 2 cleanings, 1 exam, and 20% off all other services.`,
      category: "billing",
      sourceType: "manual",
    },
    {
      title: "Cancellation & No-Show Policy",
      content: `Appointment Policy:
- Please arrive 10 minutes before your scheduled time
- Cancellations must be made at least 24 hours in advance
- Late cancellations (less than 24 hours) incur a $50 fee
- No-shows are charged $75
- Two consecutive no-shows may result in requiring a deposit for future appointments

Emergency appointments are available same-day when possible. Call (503) 555-0134 for emergency scheduling.

We send appointment reminders via text and email 48 hours and 24 hours before your visit.`,
      category: "policy",
      sourceType: "manual",
    },
    {
      title: "Provider Bios",
      content: `Dr. Emily Chen, DDS — General Dentist (Practice Owner)
- University of Washington School of Dentistry, 2010
- 14+ years experience
- Specialties: cosmetic dentistry, implants, same-day crowns
- Speaks: English, Mandarin

Dr. James Park, DMD — Orthodontist
- Oregon Health & Science University, 2015
- Board-certified orthodontist
- Specialties: Invisalign Diamond Provider, traditional braces, early interceptive treatment
- Speaks: English, Korean

Lisa Thompson, RDH — Dental Hygienist
- Portland Community College Dental Hygiene, 2012
- 12+ years experience
- Known for gentle cleanings and thorough patient education
- Certified in laser periodontal therapy`,
      category: "team",
      sourceType: "manual",
    },
  ],
};

const EARNINGS: ScenarioData = {
  slug: "demo-earnings",
  name: "TechCorp Investor Relations",
  systemPrompt: `You are Alex, a knowledgeable and professional Investor Relations assistant at TechCorp Inc. (NASDAQ: TCHK).

## About TechCorp
- Enterprise SaaS company, founded 2012, headquartered in San Francisco
- Products: CloudSuite (infrastructure), DataFlow (analytics), SecureEdge (cybersecurity)
- ~4,200 employees across 12 offices globally
- FY2025 revenue: $2.1B (+18% YoY)

## Your Role
- Help investors and analysts understand TechCorp's Q4 2025 and full-year financial results
- Explain metrics, segment performance, and forward guidance clearly
- Reference specific numbers from earnings reports and filings

## Tools Available
- **lookup_metric**: Retrieve a specific financial metric (revenue, margins, ARR, etc.)
- **compare_quarters**: Compare metrics across quarters or years

## Behavioral Guidelines
- Be precise with numbers — always cite the source period (e.g., "Q4 2025 revenue was $580M")
- If asked about material non-public information, explain that you can only discuss publicly filed data
- Never give personal investment advice or stock price predictions
- For forward-looking statements, always include appropriate disclaimers
- If you don't know a specific figure, say so rather than guessing
- Keep explanations clear for both sophisticated and retail investors`,
  personaName: "Alex",
  personaGreeting:
    "Hello! I'm Alex from TechCorp Investor Relations. I can help you understand our latest financial results. What would you like to know?",
  personaTone: "professional, data-driven, clear",
  tools: [
    {
      name: "lookup_metric",
      description:
        "Retrieve a specific financial metric for a given period.",
      parametersSchema: JSON.stringify({
        type: "object",
        properties: {
          metric: {
            type: "string",
            description:
              "Metric name (e.g., revenue, gross_margin, arr, operating_income, net_income, eps, free_cash_flow)",
          },
          period: {
            type: "string",
            description:
              "Time period (e.g., Q4_2025, FY2025, Q3_2025)",
          },
        },
        required: ["metric", "period"],
      }),
      requiresConfirmation: false,
      requiresAuth: false,
    },
    {
      name: "compare_quarters",
      description:
        "Compare a metric across two periods (e.g., Q4 2025 vs Q4 2024).",
      parametersSchema: JSON.stringify({
        type: "object",
        properties: {
          metric: {
            type: "string",
            description: "Metric name to compare",
          },
          period1: {
            type: "string",
            description: "First period",
          },
          period2: {
            type: "string",
            description: "Second period",
          },
        },
        required: ["metric", "period1", "period2"],
      }),
      requiresConfirmation: false,
      requiresAuth: false,
    },
  ],
  guardrailRules: [
    {
      type: "topic",
      pattern:
        "insider|non-public|confidential|undisclosed|material.*information",
      action: "block",
      userMessage:
        "I can only discuss publicly available information from our SEC filings and press releases.",
    },
    {
      type: "topic",
      pattern:
        "buy|sell|stock price target|investment advice|should I invest",
      action: "block",
      userMessage:
        "I'm unable to provide investment advice or stock recommendations. Please consult with your financial advisor.",
    },
    {
      type: "topic",
      pattern: "forward-looking|guidance|outlook|expect|project|forecast",
      action: "log",
      userMessage: undefined,
    },
  ],
  knowledgeDocs: [
    {
      title: "Q4 2025 Financial Highlights",
      content: `TechCorp Inc. Q4 2025 Results (October 1 – December 31, 2025)

Revenue: $580M (+16% YoY, +4% QoQ)
- CloudSuite: $290M (+20% YoY) — 50% of total revenue
- DataFlow: $185M (+14% YoY) — 32% of total revenue
- SecureEdge: $105M (+10% YoY) — 18% of total revenue

Gross Margin: 72.5% (vs 71.2% Q4 2024)
Operating Income: $116M (20.0% operating margin, vs 18.5% Q4 2024)
Net Income: $92M ($1.15 EPS diluted, vs $0.98 Q4 2024)
Free Cash Flow: $135M (23.3% FCF margin)

Annual Recurring Revenue (ARR): $2.32B (+19% YoY)
Net Revenue Retention: 118%
Remaining Performance Obligations (RPO): $4.1B (+22% YoY)

Customer Metrics:
- Total customers: 12,400+ (vs 10,800 Q4 2024)
- Customers >$100K ARR: 1,850 (vs 1,520 Q4 2024)
- Customers >$1M ARR: 185 (vs 142 Q4 2024)`,
      category: "financials",
      sourceType: "earnings_release",
    },
    {
      title: "Segment Breakdown & Growth Drivers",
      content: `Product Segment Details — Q4 2025

CloudSuite ($290M, +20% YoY):
- Strongest growth driven by multi-cloud adoption and AI workload migration
- Launched CloudSuite AI Optimizer in October — already adopted by 340+ customers
- Average deal size increased 15% to $185K
- Key wins: 3 Fortune 100 enterprises signed multi-year deals

DataFlow ($185M, +14% YoY):
- Steady growth from real-time analytics demand
- DataFlow Stream (launched Q2) contributed $28M in Q4
- 92% of DataFlow customers now use 2+ modules (vs 84% prior year)
- Expansion into healthcare vertical added 120 new logos

SecureEdge ($105M, +10% YoY):
- Growth impacted by longer enterprise sales cycles in security
- Secured FedRAMP High authorization in November — opens federal market
- Zero Trust platform upgrade drove 25% increase in average contract value
- Pipeline for FY2026 is strongest ever at $450M+

Geographic Mix:
- North America: 62% of revenue
- EMEA: 25% of revenue (+22% YoY, fastest growing region)
- APAC: 13% of revenue (+15% YoY)`,
      category: "financials",
      sourceType: "earnings_release",
    },
    {
      title: "FY2026 Guidance",
      content: `TechCorp FY2026 Financial Guidance (issued January 28, 2026)

IMPORTANT: These are forward-looking statements subject to risks and uncertainties.

Revenue: $2.52B – $2.58B (20%–23% growth)
- Q1 2026 Revenue: $600M – $615M

Operating Margin: 20.5% – 21.5% (expansion from 19.3% FY2025)
Non-GAAP EPS: $4.80 – $5.00 (vs $4.20 FY2025)
Free Cash Flow: $530M – $560M (21%–22% FCF margin)

Key Assumptions:
- Continued strong adoption of CloudSuite AI features
- DataFlow Stream reaching $150M+ ARR run-rate by mid-year
- SecureEdge FedRAMP contributing meaningful federal revenue in H2
- Modest macro improvement with enterprise IT budgets up ~5% YoY
- ~200 net new headcount additions (primarily R&D and international sales)

Capital Allocation:
- $200M share repurchase program authorized
- No dividend planned; focused on reinvestment and selective M&A
- $1.2B cash and investments on balance sheet`,
      category: "guidance",
      sourceType: "earnings_call",
    },
    {
      title: "FY2025 Full Year Results",
      content: `TechCorp Inc. Full Year FY2025 (January 1 – December 31, 2025)

Revenue: $2.10B (+18% YoY from $1.78B)
- CloudSuite: $1.04B (+22% YoY)
- DataFlow: $680M (+16% YoY)
- SecureEdge: $380M (+12% YoY)

Gross Margin: 71.8% (vs 70.5% FY2024)
Operating Income: $405M (19.3% operating margin)
Non-GAAP Operating Income: $480M (22.9% margin)
Net Income: $336M (GAAP), $420M (Non-GAAP)
GAAP EPS: $4.20 diluted (vs $3.55 FY2024)
Non-GAAP EPS: $5.25 diluted (vs $4.40 FY2024)

Free Cash Flow: $475M (22.6% FCF margin)

Balance Sheet:
- Cash & investments: $1.2B
- Total debt: $400M (term loan, 4.5% rate)
- Net cash position: $800M

Employees: ~4,200 (vs ~3,800 end of FY2024)`,
      category: "financials",
      sourceType: "annual_report",
    },
    {
      title: "Analyst Consensus & Peer Comparison",
      content: `Analyst Coverage & Consensus (as of January 2026)

Coverage: 22 analysts
- Buy/Overweight: 16
- Hold/Neutral: 5
- Sell/Underweight: 1

Consensus Estimates for FY2026:
- Revenue: $2.55B (within guidance range)
- Non-GAAP EPS: $4.90 (within guidance range)
- Revenue growth: 21% YoY

Peer Comparison (FY2025 metrics):
| Company | Revenue Growth | Gross Margin | FCF Margin | NRR |
|---------|---------------|-------------|-----------|-----|
| TechCorp | 18% | 71.8% | 22.6% | 118% |
| CloudPeer A | 22% | 75% | 25% | 122% |
| DataPeer B | 15% | 68% | 19% | 112% |
| SecPeer C | 12% | 73% | 20% | 115% |

TechCorp trades at ~10x NTM revenue, a ~15% discount to the peer median of ~11.5x, which the company attributes to its more diversified product mix.

Note: This is publicly available consensus data from published analyst reports. TechCorp does not endorse or verify these estimates.`,
      category: "research",
      sourceType: "public_data",
    },
  ],
};

const ECOMMERCE: ScenarioData = {
  slug: "demo-ecommerce",
  name: "Coastal Breeze",
  systemPrompt: `You are Luna, a friendly and helpful customer support agent at Coastal Breeze, an online lifestyle and home goods brand.

## About Coastal Breeze
- DTC e-commerce brand selling home decor, candles, kitchenware, and apparel
- Founded 2019, based in Austin, TX
- Known for sustainable sourcing and coastal-inspired aesthetic
- Ships to US and Canada, free shipping over $75

## Your Role
- Help customers track orders, process returns/exchanges, and answer product questions
- Resolve issues quickly while maintaining the brand's warm, approachable voice
- Escalate complex issues (damaged items, billing disputes) to a human agent

## Tools Available
- **lookup_order**: Look up order status by order number or email
- **initiate_return**: Start a return or exchange for an eligible order
- **check_inventory**: Check if a product is in stock in a specific size/color
- **transfer_to_human**: Escalate to a live agent when needed

## Behavioral Guidelines
- Always ask for the order number before looking anything up
- Return window is 30 days from delivery, items must be unused with tags
- If a customer is frustrated, acknowledge their feelings before jumping to solutions
- Never compare Coastal Breeze products to competitors
- For refunds over $200, confirm with the customer before processing
- Stay on-brand: warm, casual, but professional — think "helpful friend," not corporate script
- If asked about internal pricing, wholesale, or margins, politely decline`,
  personaName: "Luna",
  personaGreeting:
    "Hey! I'm Luna from Coastal Breeze. Need help with an order, a return, or just browsing? I'm here for you!",
  personaTone: "friendly, warm, on-brand, casual-professional",
  tools: [
    {
      name: "lookup_order",
      description:
        "Look up an order by order number or customer email address.",
      parametersSchema: JSON.stringify({
        type: "object",
        properties: {
          orderNumber: {
            type: "string",
            description: "Order number (e.g., CB-20251234)",
          },
          email: {
            type: "string",
            description: "Customer email (alternative to order number)",
          },
        },
        required: [],
      }),
      requiresConfirmation: false,
      requiresAuth: false,
    },
    {
      name: "initiate_return",
      description:
        "Start a return or exchange for an eligible order item.",
      parametersSchema: JSON.stringify({
        type: "object",
        properties: {
          orderNumber: {
            type: "string",
            description: "Order number",
          },
          itemSku: {
            type: "string",
            description: "SKU of the item to return",
          },
          reason: {
            type: "string",
            description:
              "Reason for return (e.g., wrong_size, defective, not_as_expected, changed_mind)",
          },
          exchangeFor: {
            type: "string",
            description:
              "If exchange, the SKU of the replacement item (optional)",
          },
        },
        required: ["orderNumber", "itemSku", "reason"],
      }),
      requiresConfirmation: true,
      requiresAuth: true,
    },
    {
      name: "check_inventory",
      description:
        "Check if a product is in stock in a specific size and/or color.",
      parametersSchema: JSON.stringify({
        type: "object",
        properties: {
          productName: {
            type: "string",
            description: "Product name or SKU",
          },
          size: {
            type: "string",
            description: "Size (e.g., S, M, L, XL, One Size)",
          },
          color: {
            type: "string",
            description: "Color variant",
          },
        },
        required: ["productName"],
      }),
      requiresConfirmation: false,
      requiresAuth: false,
    },
    {
      name: "transfer_to_human",
      description:
        "Escalate the conversation to a live human support agent.",
      parametersSchema: JSON.stringify({
        type: "object",
        properties: {
          reason: {
            type: "string",
            description:
              "Why the handoff is needed (e.g., damaged_item, billing_dispute, complex_return)",
          },
          summary: {
            type: "string",
            description: "Brief summary of the conversation so far",
          },
        },
        required: ["reason", "summary"],
      }),
      requiresConfirmation: false,
      requiresAuth: false,
    },
  ],
  guardrailRules: [
    {
      type: "topic",
      pattern:
        "competitor|pottery barn|west elm|crate.*barrel|restoration hardware|anthropologie",
      action: "block",
      userMessage:
        "I can only help with Coastal Breeze products. Want me to help you find something in our collection?",
    },
    {
      type: "financial",
      pattern: "refund.*over.*\\$?200|\\$2[0-9]{2,}.*refund|large refund",
      action: "warn",
      userMessage:
        "I want to make sure I get this right — let me confirm the refund details with you before processing.",
    },
    {
      type: "topic",
      pattern:
        "wholesale|internal.*pric|cost.*price|margin|markup|supplier",
      action: "block",
      userMessage:
        "I'm not able to share that information, but I'd love to help you with anything else!",
    },
  ],
  knowledgeDocs: [
    {
      title: "Shipping Policy",
      content: `Coastal Breeze Shipping Information

Domestic (US):
- Standard Shipping (5–7 business days): $5.99, FREE over $75
- Express Shipping (2–3 business days): $12.99
- Overnight Shipping (next business day): $24.99

Canada:
- Standard Shipping (7–14 business days): $14.99, FREE over $150 CAD
- Express Shipping (3–5 business days): $24.99

Processing Time: Orders placed before 2 PM CT ship same business day. Orders after 2 PM CT or on weekends ship next business day.

Tracking: All orders include tracking. Emails are sent when the order ships and when it's out for delivery.

P.O. Boxes: We ship to P.O. boxes via USPS Standard only.

Holiday Shipping: During November–December, expect 1–2 extra business days for all methods. Holiday cutoff dates are posted on our website by October 15.`,
      category: "shipping",
      sourceType: "manual",
    },
    {
      title: "Return & Exchange Policy",
      content: `Coastal Breeze Returns & Exchanges

Return Window: 30 days from delivery date.

Eligibility:
- Items must be unworn/unused with original tags attached
- Items must be in original packaging
- Sale items (marked "Final Sale") are not returnable
- Personalized/monogrammed items are not returnable
- Candles that have been lit are not returnable

Process:
1. Contact us or use the self-service portal at coastalbreeze.com/returns
2. Print your prepaid return label (US only; Canada returns are customer-paid)
3. Ship items within 7 days of return authorization
4. Refund processed within 5–7 business days after we receive the item

Exchanges:
- Subject to availability — if the requested item is out of stock, we'll issue a refund
- Exchanges ship free (US only)

Refund Method:
- Original payment method (credit card, PayPal, etc.)
- Store credit (issued immediately, no expiry)
- Gift card purchases are refunded as store credit

Damaged/Defective Items: Contact us within 48 hours of delivery with photos. We'll send a replacement at no cost.`,
      category: "returns",
      sourceType: "manual",
    },
    {
      title: "Product Catalog Highlights",
      content: `Coastal Breeze — Popular Product Lines (Winter 2026)

HOME DECOR:
- Tide Pool Ceramic Vase Set (3-piece): $89 — hand-glazed, ocean blue tones
- Driftwood Wall Shelf: $65 — reclaimed wood, 3 sizes
- Sea Glass Wind Chimes: $42 — handmade, recycled glass
- Coral Reef Throw Pillow (set of 2): $58 — organic cotton, machine washable

CANDLES:
- Coastal Morning (soy wax, 60hr burn): $34 — salt air, driftwood, white tea
- Sunset Harbor (soy wax, 60hr burn): $34 — amber, sandalwood, warm vanilla
- Tide Pool Collection (set of 3 minis): $28 — best seller, great for gifting

KITCHENWARE:
- Sand Dollar Stoneware Dinner Set (4-place): $165 — dishwasher & microwave safe
- Ocean Breeze Linen Napkins (set of 6): $38 — 100% linen, 8 colors
- Bamboo Cutting Board Collection: $25–$55 — sustainably sourced

APPAREL:
- Coastal Classic Hoodie: $68 — organic cotton/recycled poly blend, unisex, 6 colors
- Beach Walk Linen Pants: $72 — relaxed fit, 4 colors
- Sunrise Tee: $38 — 100% organic cotton, screen-printed

All prices in USD. Sizes XS–3XL available for apparel. Free shipping on orders over $75.`,
      category: "products",
      sourceType: "catalog",
    },
    {
      title: "Loyalty Program — Breeze Rewards",
      content: `Coastal Breeze — Breeze Rewards Loyalty Program

Tiers:
1. **Wave** (0–299 points): Earn 1 point per $1 spent
2. **Tide** (300–999 points): 1.5x points, early access to sales, free shipping on all orders
3. **Current** (1,000+ points): 2x points, exclusive products, birthday gift, annual $25 credit

Earning Points:
- Purchase: 1 point per $1 (multiplied by tier)
- Write a review: 25 points
- Refer a friend: 100 points (friend gets $15 off first order)
- Social share: 10 points per post (max 2/month)
- Birthday: 50 bonus points

Redeeming Points:
- 100 points = $5 off
- 250 points = $15 off
- 500 points = $35 off
- 1,000 points = $75 off

Points expire after 12 months of account inactivity. Points are non-transferable. Rewards cannot be combined with other discount codes.

Enrollment: Free to join. Sign up at checkout or at coastalbreeze.com/rewards.`,
      category: "loyalty",
      sourceType: "manual",
    },
    {
      title: "Frequently Asked Questions",
      content: `Coastal Breeze — Customer FAQ

Q: Where are your products made?
A: We source from a mix of domestic artisans (ceramics, candles) and fair-trade certified workshops in Portugal and India (textiles, apparel). All candles are poured in our Austin, TX studio.

Q: Are your products sustainable?
A: Yes! We use organic cotton, recycled polyester, soy wax, reclaimed wood, and recycled glass. Our packaging is 100% recyclable and we offset shipping carbon via Pachama.

Q: Can I cancel an order after placing it?
A: Orders can be canceled within 1 hour of placement. After that, they enter our fulfillment queue. If you need to cancel, contact us ASAP and we'll do our best.

Q: Do you offer gift wrapping?
A: Yes! Add gift wrapping at checkout for $5.99. Includes a kraft paper wrap, dried flower sprig, and a handwritten note card.

Q: How do I care for my candle?
A: Trim the wick to 1/4" before each use. Burn for at least 2 hours on first use to prevent tunneling. Never burn for more than 4 hours at a time. Keep away from drafts.

Q: Do you have a physical store?
A: We have a flagship store in Austin (1200 South Congress Ave) and pop-ups at seasonal markets. Check our website for upcoming events.

Q: What payment methods do you accept?
A: Visa, Mastercard, Amex, Discover, PayPal, Apple Pay, Google Pay, Shop Pay, Afterpay (4 interest-free payments), and Coastal Breeze gift cards.`,
      category: "faq",
      sourceType: "manual",
    },
  ],
};

const ALL_SCENARIOS: ScenarioData[] = [DENTIST, EARNINGS, ECOMMERCE];

// ────────────────────────────────────────────────────────────────
// Seed Action
// ────────────────────────────────────────────────────────────────

export const seedAll = internalAction({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    const results: string[] = [];

    for (const scenario of ALL_SCENARIOS) {
      // Seed app, tools, and guardrails via mutation
      await ctx.runMutation(internal.seedScenariosDb.seedScenarioApp, {
        slug: scenario.slug,
        name: scenario.name,
        secret: args.secret,
        systemPrompt: scenario.systemPrompt,
        personaName: scenario.personaName,
        personaGreeting: scenario.personaGreeting,
        personaTone: scenario.personaTone,
        guardrailsEnabled: true,
        tools: scenario.tools,
        guardrailRules: scenario.guardrailRules,
      });

      results.push(`[OK] ${scenario.slug}: app + ${scenario.tools.length} tools + ${scenario.guardrailRules.length} rules`);

      // Seed knowledge documents with embeddings (one at a time — each is an action)
      for (const doc of scenario.knowledgeDocs) {
        await ctx.runAction(internal.knowledgeInternal.upsertWithEmbedding, {
          appSlug: scenario.slug,
          title: doc.title,
          content: doc.content,
          category: doc.category,
          sourceType: doc.sourceType,
          updatedBy: "seed-script",
        });
      }

      results.push(`[OK] ${scenario.slug}: ${scenario.knowledgeDocs.length} knowledge docs`);

      // Seed scenario state (if applicable)
      const initialState = getInitialState(scenario.slug);
      if (initialState) {
        await ctx.runMutation(internal.scenarioStateDb.upsertState, {
          appSlug: scenario.slug,
          state: JSON.stringify(initialState),
        });
        results.push(`[OK] ${scenario.slug}: scenario state seeded`);
      }
    }

    return results.join("\n");
  },
});
