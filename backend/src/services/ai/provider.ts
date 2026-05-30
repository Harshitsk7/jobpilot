export interface LLMCompleteOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface LLMProvider {
  readonly name: string;
  complete(prompt: string, system: string, options?: LLMCompleteOptions): Promise<string>;
  isConfigured(): boolean;
}
