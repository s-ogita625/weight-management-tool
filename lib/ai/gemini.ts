import 'server-only';

import { GoogleGenAI } from '@google/genai';

let _client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (_client) return _client;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY が設定されていません。.env.local または Vercel 環境変数に設定してください。',
    );
  }
  _client = new GoogleGenAI({ apiKey: key });
  return _client;
}

/** 軽量・高速・無料枠ありのモデル */
export const GEMINI_FLASH = 'gemini-2.5-flash';
/** 旧Flashモデル（フォールバック用） */
export const GEMINI_FLASH_2 = 'gemini-2.0-flash';
