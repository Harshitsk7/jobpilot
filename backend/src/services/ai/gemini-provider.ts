import { config } from '../../lib/config.js';
import type { LLMCompleteOptions, LLMProvider } from './provider.js';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private overrideApiKey?: string;
  private overrideModel?: string;

  constructor(overrideApiKey?: string, overrideModel?: string) {
    this.overrideApiKey = overrideApiKey;
    this.overrideModel = overrideModel;
  }

  private getApiKey(): string {
    return this.overrideApiKey || config.geminiApiKey;
  }

  isConfigured(): boolean {
    return !!this.getApiKey();
  }

  async complete(
    prompt: string,
    system: string,
    options?: LLMCompleteOptions
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const model = this.overrideModel || config.geminiModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.3,
        },
      }),
    });

    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`Gemini API error (${resp.status}): ${text.slice(0, 200).replace(/key=[^&\s]+/g, 'key=***')}`);
    }

    let data: GeminiResponse;
    try {
      data = JSON.parse(text) as GeminiResponse;
    } catch {
      throw new Error('Invalid JSON from Gemini API');
    }

    if (data.error?.message) {
      throw new Error(data.error.message);
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('Empty response from Gemini API');
    }
    return content;
  }
}
