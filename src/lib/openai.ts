

import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (_client) return _client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  _client = new OpenAI({ apiKey });
  return _client;
}


export const ADMIN_MODEL = process.env.OPENAI_ADMIN_MODEL ?? 'gpt-5.4';


export const CUSTOMER_MODEL = process.env.OPENAI_CUSTOMER_MODEL ?? 'gpt-5.4-mini';
