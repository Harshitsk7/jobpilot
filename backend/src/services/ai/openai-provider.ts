import { config } from '../../lib/config.js';
import type { LLMCompleteOptions, LLMProvider } from './provider.js';

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private overrideApiKey?: string;
  private overrideModel?: string;

  constructor(overrideApiKey?: string, overrideModel?: string) {
    this.overrideApiKey = overrideApiKey;
    this.overrideModel = overrideModel;
  }

  private getApiKey(): string {
    return this.overrideApiKey || config.openaiApiKey;
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
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const model = this.overrideModel || config.openaiModel;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.3,
      }),
    });

    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`OpenAI API error (${resp.status}): ${text.slice(0, 400)}`);
    }

    let data: ChatCompletionResponse;
    try {
      data = JSON.parse(text) as ChatCompletionResponse;
    } catch {
      throw new Error('Invalid JSON from OpenAI API');
    }

    if (data.error?.message) {
      throw new Error(data.error.message);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }
    return content;
  }
}
