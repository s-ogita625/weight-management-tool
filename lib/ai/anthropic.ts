import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY が設定されていません。.env.local または Vercel 環境変数に設定してください。',
    );
  }
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export const HAIKU_MODEL = 'claude-haiku-4-5';
