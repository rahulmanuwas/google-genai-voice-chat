'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Headset,
  ShoppingBag,
  Truck,
  Stethoscope,
  UtensilsCrossed,
  ArrowRight,
} from 'lucide-react';

const SCENARIOS = [
  {
    id: 'support',
    label: 'Customer Support',
    icon: Headset,
    text: 'I found your booking #RF-4821 on the United flight to Seoul. There\'s a 10:45 AM departure next Tuesday with window seats available. I can rebook you right now and send the updated confirmation to your email — shall I go ahead?',
    context: 'Flight rebooking',
    capability: 'Knowledge base + tool execution',
    href: '/demos/livekit',
  },
  {
    id: 'concierge',
    label: 'Concierge',
    icon: UtensilsCrossed,
    text: 'Great news — Osteria Mozza has a table for 8 at 7:30 tonight. They have a private dining room that would be perfect for your group. I\'ve tentatively held it for 15 minutes. Want me to confirm the reservation?',
    context: 'Restaurant booking',
    capability: 'Real-time availability + actions',
    href: '/demos/livekit',
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: ShoppingBag,
    text: 'Based on your team size and usage, the Growth plan at $299/mo would save you about $1,200 annually versus your current setup. I can walk you through the migration, or connect you with Sarah from our solutions team right now.',
    context: 'Plan recommendation',
    capability: 'Guardrails + handoff routing',
    href: '/demos/chatbot',
  },
  {
    id: 'logistics',
    label: 'Logistics',
    icon: Truck,
    text: 'Shipment #TK-9182 cleared customs at Incheon 2 hours ago and is en route to your Busan warehouse. Current ETA is tomorrow at 6 AM KST. I\'ve flagged the temperature variance during transit — do you want me to escalate to QA?',
    context: 'Shipment tracking',
    capability: 'API integration + escalation',
    href: '/demos/custom',
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    icon: Stethoscope,
    text: 'Your prescription for Lisinopril 10mg is ready for refill. I see Dr. Park has an opening Thursday at 2 PM for your follow-up. I can schedule both the refill pickup and the appointment — would that work for you?',
    context: 'Rx refill + scheduling',
    capability: 'Multi-step workflow',
    href: '/demos/livekit',
  },
];

function MiniWaveform() {
  return (
    <div className="flex items-center gap-[2px] h-4" aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => {
        const h = 30 + Math.sin(i * 0.7) * 25 + Math.cos(i * 1.3) * 20;
        return (
          <div
            key={i}
            className="w-[2px] rounded-full bg-[hsl(200_80%_55%)]"
            style={{
              height: `${h}%`,
              opacity: 0.4 + (h / 100) * 0.6,
              animation: `wave-bar ${1.2 + (i % 5) * 0.2}s ease-in-out ${i * 0.06}s infinite`,
              transformOrigin: 'center',
            }}
          />
        );
      })}
    </div>
  );
}

export function DemoShowcase() {
  const [active, setActive] = useState(0);
  const scenario = SCENARIOS[active];

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Gradient border wrapper */}
      <div className="rounded-2xl bg-gradient-to-b from-[hsl(200_80%_55%/0.15)] via-[hsl(200_80%_55%/0.05)] to-transparent p-px">
        <div className="rounded-2xl bg-[hsl(0_0%_5.5%)] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(200_80%_55%)] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(200_80%_55%)]" />
              </span>
              Live Demo
            </div>
            <MiniWaveform />
          </div>

          {/* Scenario pills */}
          <div className="px-5 sm:px-6 pb-4 overflow-x-auto scrollbar-none">
            <div className="flex gap-2">
              {SCENARIOS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActive(i)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      i === active
                        ? 'bg-[hsl(200_80%_55%/0.12)] text-[hsl(200_80%_55%)] ring-1 ring-[hsl(200_80%_55%/0.25)]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_100%/0.04)]'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 sm:mx-6 border-t border-[hsl(0_0%_100%/0.06)]" />

          {/* Conversation area */}
          <div className="px-5 sm:px-6 py-5 sm:py-6 min-h-[140px] sm:min-h-[160px]">
            <p className="text-sm sm:text-base leading-relaxed text-foreground/90 transition-opacity duration-200">
              {scenario.text}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 sm:py-4 border-t border-[hsl(0_0%_100%/0.06)] bg-[hsl(0_0%_4%)]">
            <div className="min-w-0 flex-1 text-xs text-muted-foreground truncate sm:whitespace-normal">
              <span>{scenario.context}</span>
              <span className="mx-1.5">·</span>
              <span className="text-[hsl(200_80%_55%/0.7)]">{scenario.capability}</span>
            </div>
            <Link
              href={scenario.href}
              className="group inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-background transition-all hover:opacity-90 shrink-0"
            >
              Try it live
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
