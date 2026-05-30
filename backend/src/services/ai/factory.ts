import { config } from '../../lib/config.js';
import { prisma } from '../../lib/prisma.js';
import { decrypt } from '../encryption.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { GitHubCopilotProvider } from './copilot-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import type { LLMProvider } from './provider.js';

let cached: LLMProvider | null = null;
let cachedProviderKey = '';
let copilotSingleton: GitHubCopilotProvider | null = null;

export async function isAiEnabled(): Promise<boolean> {
  const profile = await prisma.userProfile.findUnique({ where: { id: 'default' } });
  return profile?.aiEnabled ?? true;
}

export async function getAiSettings(): Promise<{
  provider: string;
  apiKey: string;
  model: string;
}> {
  const profile = await prisma.userProfile.findUnique({ where: { id: 'default' } });
  return {
    provider: profile?.aiProvider || '',
    apiKey: profile?.aiApiKey || '',
    model: profile?.aiModel || '',
  };
}

export function getLLMProvider(overrideProvider?: string, overrideApiKey?: string, overrideModel?: string): LLMProvider {
  const provider = overrideProvider || config.llmProvider;
  const cacheKey = `${provider}:${overrideApiKey ?? ''}:${overrideModel ?? ''}`;

  if (cached && cachedProviderKey === cacheKey) return cached;

  switch (provider) {
    case 'openai':
      cached = new OpenAIProvider(overrideApiKey, overrideModel);
      break;
    case 'gemini':
      cached = new GeminiProvider(overrideApiKey, overrideModel);
      break;
    case 'copilot':
    case 'github_copilot':
      copilotSingleton ??= new GitHubCopilotProvider();
      cached = copilotSingleton;
      break;
    case 'anthropic':
    default:
      cached = new AnthropicProvider(overrideApiKey, overrideModel);
      break;
  }

  cachedProviderKey = cacheKey;
  return cached;
}

export async function getLLMProviderWithDbOverrides(): Promise<LLMProvider> {
  const settings = await getAiSettings();
  if (settings.provider) {
    let decryptedKey: string | undefined;
    if (settings.apiKey) {
      try {
        decryptedKey = decrypt(settings.apiKey);
      } catch {
        decryptedKey = undefined;
      }
    }
    return getLLMProvider(settings.provider, decryptedKey, settings.model || undefined);
  }
  return getLLMProvider();
}

export function getCopilotProvider(): GitHubCopilotProvider | null {
  if (config.llmProvider !== 'copilot' && config.llmProvider !== 'github_copilot') {
    return null;
  }
  copilotSingleton ??= new GitHubCopilotProvider();
  return copilotSingleton;
}

export function resetLLMProviderCache(): void {
  cached = null;
  cachedProviderKey = '';
}
