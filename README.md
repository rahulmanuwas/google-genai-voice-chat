# google-genai-voice-chat

Real-time voice and text chat component for Google Gemini Live API.

[![npm version](https://badge.fury.io/js/google-genai-voice-chat.svg)](https://www.npmjs.com/package/google-genai-voice-chat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🎙️ **Real-time voice chat** with Gemini Live API
- 💬 **Text chat** fallback option
- 🔄 **Session resumption** for persistent conversations
- 🎨 **Customizable UI** with configurable themes
- 📱 **Responsive design** that works on all devices
- ⚡ **Easy integration** with Next.js and React apps

## Installation

```bash
npm install google-genai-voice-chat @google/genai
```

## Quick Start

```tsx
import { ChatBot } from 'google-genai-voice-chat';

function App() {
  return (
    <ChatBot
      apiKey={process.env.NEXT_PUBLIC_GEMINI_API_KEY!}
      config={{
        systemPrompt: 'You are a helpful assistant...',
        welcomeMessage: 'Hello! How can I help you today?',
        chatTitle: 'AI Assistant',
        suggestedQuestions: [
          'What can you help me with?',
          'Tell me about your capabilities',
        ],
      }}
    />
  );
}
```

## Configuration

### VoiceChatConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `systemPrompt` | `string` | **required** | System instruction for the AI |
| `welcomeMessage` | `string` | `'Hello! How can I help you today?'` | Welcome message shown on connect |
| `suggestedQuestions` | `string[]` | `[]` | Suggested questions to show |
| `sessionStorageKey` | `string` | `'genai-voice-chat-session'` | localStorage key for session |
| `replyAsAudio` | `boolean` | `true` | Whether AI replies with audio |
| `chatTitle` | `string` | `'AI Assistant'` | Title in chat header |
| `theme.primaryColor` | `string` | `'#2563eb'` | Primary accent color |
| `theme.position` | `'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Launcher position |

## Using Individual Hooks

For more control, use the hooks directly:

```tsx
import { useVoiceChat } from 'google-genai-voice-chat';

function CustomChat() {
  const {
    messages,
    isConnected,
    isListening,
    isAISpeaking,
    connect,
    disconnect,
    sendText,
    toggleMute,
    toggleMic,
  } = useVoiceChat({
    apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
    config: {
      systemPrompt: 'You are a helpful assistant...',
    },
  });

  // Build your own UI...
}
```

## Text-only API Route

For server-side text chat (Next.js):

```ts
// app/api/chat/route.ts
import { createChatHandler } from 'google-genai-voice-chat/api';

export const POST = createChatHandler({
  systemPrompt: 'You are a helpful assistant...',
  model: 'gemini-2.0-flash',
});
```

## Environment Variables

```bash
# For client-side (Next.js)
NEXT_PUBLIC_GEMINI_API_KEY=your-api-key

# For server-side API routes
GEMINI_API_KEY=your-api-key
```

## Requirements

- React 18+
- `@google/genai` package
- Gemini API key with Live API access

## License

MIT © Rahul Manuwas
