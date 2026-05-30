import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../lib/config.js';
import type { LLMCompleteOptions, LLMProvider } from './provider.js';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private overrideApiKey?: string;
  private overrideModel?: string;

  constructor(overrideApiKey?: string, overrideModel?: string) {
    this.overrideApiKey = overrideApiKey;
    this.overrideModel = overrideModel;
  }

  private getApiKey(): string {
    return this.overrideApiKey || config.anthropicApiKey;
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
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
    const c = new Anthropic({ apiKey });
    const model = this.overrideModel || config.claudeModel;
    const response = await c.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected Anthropic response type');
    return block.text;
  }
}
