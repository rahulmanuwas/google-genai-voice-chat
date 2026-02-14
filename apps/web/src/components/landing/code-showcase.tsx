'use client';

import { useState } from 'react';
import { FadeIn } from '@/components/ui/fade-in';

/* ── Token types for minimal syntax highlighting ─────────────── */
type Token =
  | { t: 'kw'; v: string }   // keyword
  | { t: 'str'; v: string }  // string
  | { t: 'cmt'; v: string }  // comment
  | { t: 'tag'; v: string }  // JSX tag / component name
  | { t: 'prop'; v: string } // property / attribute
  | { t: 'fn'; v: string }   // function / method
  | { t: 'op'; v: string }   // operator / punctuation
  | { t: 'txt'; v: string }; // plain text

const kw = (v: string): Token => ({ t: 'kw', v });
const str = (v: string): Token => ({ t: 'str', v });
const cmt = (v: string): Token => ({ t: 'cmt', v });
const tag = (v: string): Token => ({ t: 'tag', v });
const prop = (v: string): Token => ({ t: 'prop', v });
const fn = (v: string): Token => ({ t: 'fn', v });
const op = (v: string): Token => ({ t: 'op', v });
const txt = (v: string): Token => ({ t: 'txt', v });

/* ── Snippets ────────────────────────────────────────────────── */

const WIDGET_TOKENS: Token[][] = [
  [kw('import'), txt(' '), op('{'), txt(' '), tag('ChatBot'), txt(' '), op('}'), txt(' '), kw('from'), txt(' '), str("'@genai-voice/livekit/chatbot'"), op(';')],
  [],
  [op('<'), tag('ChatBot')],
  [txt('  '), prop('apiKey'), op('={'), txt('process.env.NEXT_PUBLIC_GEMINI_API_KEY'), op('}')],
  [txt('  '), prop('config'), op('={{')],
  [txt('    '), prop('systemPrompt'), op(':'), txt(' '), str("'You are a helpful assistant.'"), op(',')],
  [txt('    '), prop('replyAsAudio'), op(':'), txt(' '), kw('true'), op(',')],
  [txt('  '), op('}}')],
  [op('/>')],
];

const HOOK_TOKENS: Token[][] = [
  [kw('import'), txt(' '), op('{'), txt(' '), fn('useVoiceChat'), txt(' '), op('}'), txt(' '), kw('from'), txt(' '), str("'@genai-voice/livekit/chatbot'"), op(';')],
  [],
  [kw('const'), txt(' '), op('{')],
  [txt('  '), txt('messages'), op(','), txt(' isConnected'), op(','), txt(' isListening'), op(',')],
  [txt('  '), txt('connect'), op(','), txt(' disconnect'), op(','), txt(' sendText'), op(','), txt(' toggleMic'), op(',')],
  [op('}'), txt(' '), op('='), txt(' '), fn('useVoiceChat'), op('({')],
  [txt('  '), prop('apiKey'), op(':'), txt(' '), txt('process.env.NEXT_PUBLIC_GEMINI_API_KEY'), op(',')],
  [txt('  '), prop('config'), op(':'), txt(' '), op('{')],
  [txt('    '), prop('systemPrompt'), op(':'), txt(' '), str("'You are a helpful assistant.'"), op(',')],
  [txt('    '), prop('replyAsAudio'), op(':'), txt(' '), kw('true'), op(',')],
  [txt('  '), op('},')],
  [op('});')],
];

const LIVEKIT_TOKENS: Token[][] = [
  [kw('import'), txt(' '), op('{'), txt(' '), tag('LiveKitVoiceChat'), txt(' '), op('}'), txt(' '), kw('from'), txt(' '), str("'@genai-voice/livekit'"), op(';')],
  [],
  [cmt('// Session tokens, personas, guardrails — handled automatically')],
  [op('<'), tag('LiveKitVoiceChat')],
  [txt('  '), prop('convexUrl'), op('='), str('"https://your-app.convex.cloud"')],
  [txt('  '), prop('appSlug'), op('='), str('"support"')],
  [txt('  '), prop('getSessionToken'), op('={'), fn('fetchToken'), op('}')],
  [txt('  '), prop('serverUrl'), op('='), str('"wss://your-app.livekit.cloud"')],
  [op('/>')],
];

const TABS = [
  {
    id: 'widget',
    label: 'Drop-in Widget',
    description: 'One component. Floating chat widget with voice and text, zero config.',
    tokens: WIDGET_TOKENS,
    package: '@genai-voice/livekit/chatbot',
  },
  {
    id: 'hook',
    label: 'Custom Hook',
    description: 'Full control over UI. Messages, mic state, connection — all yours.',
    tokens: HOOK_TOKENS,
    package: '@genai-voice/livekit/chatbot',
  },
  {
    id: 'livekit',
    label: 'Production',
    description: 'Backend-powered with guardrails, tools, handoffs, and persona management.',
    tokens: LIVEKIT_TOKENS,
    package: '@genai-voice/livekit',
  },
] as const;

/* ── Token color map ─────────────────────────────────────────── */
const COLOR: Record<Token['t'], string> = {
  kw: 'text-[hsl(280_60%_70%)]',    // purple
  str: 'text-[hsl(120_40%_62%)]',    // green
  cmt: 'text-muted-foreground/50',   // dimmed
  tag: 'text-[hsl(190_70%_65%)]',    // cyan
  prop: 'text-[hsl(38_80%_68%)]',    // amber (brand-adjacent)
  fn: 'text-[hsl(210_60%_72%)]',     // blue
  op: 'text-muted-foreground/70',    // subtle
  txt: 'text-foreground/80',         // default
};

function CodeLine({ tokens }: { tokens: Token[] }) {
  if (tokens.length === 0) return <br />;
  return (
    <div>
      {tokens.map((token, i) => (
        <span key={i} className={COLOR[token.t]}>{token.v}</span>
      ))}
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────── */

export function CodeShowcase() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <section id="code" className="relative py-20 sm:py-28 lg:py-36 border-t border-border overflow-hidden">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute right-[20%] top-[30%] h-[500px] w-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(280 60% 50% / 0.04) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="relative max-w-4xl mx-auto px-6">
        <FadeIn className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Three lines to your first agent
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Widget, hook, or full production. Same SDK, your choice of depth.
          </p>
        </FadeIn>

        <FadeIn delay={0.15}>
          {/* Code panel */}
          <div className="rounded-xl gradient-border p-px">
            <div className="rounded-xl bg-[hsl(0_0%_4.5%)] overflow-hidden">

              {/* Tab bar */}
              <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 pb-2">
                <div className="flex gap-2 overflow-x-auto scrollbar-none py-1">
                  {TABS.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => setActive(i)}
                      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                        i === active
                          ? 'bg-brand/12 text-brand ring-1 ring-brand/25'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <span className="hidden sm:inline-flex items-center rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 text-[10px] font-mono text-muted-foreground shrink-0">
                  {tab.package}
                </span>
              </div>

              {/* Description */}
              <div className="px-5 sm:px-6 pb-3">
                <p className="text-sm text-muted-foreground transition-opacity duration-150">
                  {tab.description}
                </p>
              </div>

              {/* Divider */}
              <div className="mx-5 sm:mx-6 border-t border-white/[0.06]" />

              {/* Code block */}
              <div className="px-5 sm:px-6 py-5 sm:py-6 overflow-x-auto">
                <pre className="font-mono text-[13px] sm:text-sm leading-relaxed">
                  {tab.tokens.map((line, i) => (
                    <CodeLine key={`${tab.id}-${i}`} tokens={line} />
                  ))}
                </pre>
              </div>

            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
