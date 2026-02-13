export function getServerEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value;
}

export function getGeminiServerApiKey(): string | undefined {
  return getServerEnv('GEMINI_API_KEY') ?? getServerEnv('NEXT_PUBLIC_GEMINI_API_KEY');
}
