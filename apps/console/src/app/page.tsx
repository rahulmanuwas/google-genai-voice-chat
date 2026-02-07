import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
        genai-voice Demo
      </h1>
      <p style={{ color: 'var(--muted)', marginBottom: 48 }}>
        Four ways to add genai-voice features to your app.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <DemoCard
          href="/chatbot"
          title="1. Drop-in ChatBot"
          description="The <ChatBot /> component — a floating voice/text chat widget you can add with one line."
          pkg="@genai-voice/react"
        />
        <DemoCard
          href="/custom"
          title="2. Custom UI with useVoiceChat"
          description="Build your own voice chat UI using the useVoiceChat hook for full control."
          pkg="@genai-voice/react"
        />
        <DemoCard
          href="/livekit"
          title="3. LiveKit Voice Agent"
          description="Server-side AI agent via LiveKit rooms + Gemini Live API (speech-to-speech)."
          pkg="@genai-voice/livekit"
        />
        <DemoCard
          href="/twilio-call"
          title="4. PSTN Call (LiveKit SIP)"
          description="Dial a phone number via LiveKit SIP (Twilio trunk) and bridge it into a LiveKit room."
          pkg="@genai-voice/livekit"
        />
      </div>
    </main>
  );
}

function DemoCard({
  href,
  title,
  description,
  pkg,
}: {
  href: string;
  title: string;
  description: string;
  pkg: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: 24,
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--card)',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 12 }}>
        {description}
      </div>
      <code
        style={{
          fontSize: 12,
          padding: '4px 8px',
          background: '#1a1a2e',
          borderRadius: 4,
          color: '#7dd3fc',
        }}
      >
        {pkg}
      </code>
    </Link>
  );
}
