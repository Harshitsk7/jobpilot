import { Router } from 'express';
import { config } from '../lib/config.js';
import { getLLMProvider, getCopilotProvider, isAiEnabled, getAiSettings, resetLLMProviderCache } from '../services/ai/factory.js';
import { AnthropicProvider } from '../services/ai/anthropic-provider.js';
import { OpenAIProvider } from '../services/ai/openai-provider.js';
import { GeminiProvider } from '../services/ai/gemini-provider.js';
import { prisma } from '../lib/prisma.js';
import { encrypt } from '../services/encryption.js';

const router = Router();

router.get('/status', async (_req, res) => {
  const provider = getLLMProvider();
  const aiEnabled = await isAiEnabled();
  const settings = await getAiSettings();
  let copilotModels: string[] = [];

  if (provider.name === 'github_copilot' && provider.isConfigured()) {
    try {
      copilotModels = (await getCopilotProvider()?.listModels()) ?? [];
    } catch {
      /* token may be invalid */
    }
  }

  res.json({
    provider: settings.provider || config.llmProvider,
    providerName: provider.name,
    configured: provider.isConfigured(),
    model: settings.model || (config.llmProvider === 'anthropic' ? config.claudeModel : config.llmProvider === 'openai' ? config.openaiModel : config.llmProvider === 'gemini' ? config.geminiModel : config.copilotModel),
    copilotModels: copilotModels.slice(0, 20),
    aiEnabled,
    sso: {
      appIdConfigured: !!config.githubCopilotAppId,
      appId: config.githubCopilotAppId
        ? `${config.githubCopilotAppId.slice(0, 6)}…`
        : null,
      tokenConfigured: !!config.githubCopilotToken,
    },
    editorProfile: {
      editorVersion: config.copilotEditorVersion,
      pluginVersion: config.copilotPluginVersion,
      userAgent: config.copilotUserAgent,
      authMethod: 'oauth',
    },
  });
});

router.get('/providers', async (_req, res) => {
  const settings = await getAiSettings();
  const activeProvider = settings.provider || config.llmProvider;

  res.json({
    active: activeProvider,
    providers: [
      {
        id: 'anthropic',
        name: 'Anthropic (Claude)',
        configured: !!config.anthropicApiKey || (settings.provider === 'anthropic' && !!settings.apiKey),
        defaultModel: config.claudeModel,
        models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
        hasEnvKey: !!config.anthropicApiKey,
        hasDbKey: settings.provider === 'anthropic' && !!settings.apiKey,
      },
      {
        id: 'openai',
        name: 'OpenAI (GPT)',
        configured: !!config.openaiApiKey || (settings.provider === 'openai' && !!settings.apiKey),
        defaultModel: config.openaiModel,
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'],
        hasEnvKey: !!config.openaiApiKey,
        hasDbKey: settings.provider === 'openai' && !!settings.apiKey,
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        configured: !!config.geminiApiKey || (settings.provider === 'gemini' && !!settings.apiKey),
        defaultModel: config.geminiModel,
        models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
        hasEnvKey: !!config.geminiApiKey,
        hasDbKey: settings.provider === 'gemini' && !!settings.apiKey,
      },
      {
        id: 'copilot',
        name: 'GitHub Copilot',
        configured: !!config.githubCopilotToken && !!config.githubCopilotAppId,
        defaultModel: config.copilotModel,
        models: [],
        hasEnvKey: !!config.githubCopilotToken,
        hasDbKey: false,
      },
    ],
  });
});

router.put('/provider', async (req, res) => {
  const { provider, apiKey, model } = req.body;
  if (!provider) return res.status(400).json({ error: 'provider is required' });

  const validProviders = ['anthropic', 'openai', 'gemini', 'copilot'];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({ error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` });
  }

  const encryptedKey = apiKey ? encrypt(apiKey) : '';

  await prisma.userProfile.update({
    where: { id: 'default' },
    data: {
      aiProvider: provider,
      aiApiKey: encryptedKey,
      aiModel: model || '',
    },
  });

  resetLLMProviderCache();
  res.json({ success: true, provider, model: model || '' });
});

router.post('/test', async (_req, res) => {
  try {
    const aiOn = await isAiEnabled();
    if (!aiOn) {
      return res.status(400).json({ ok: false, error: 'AI mode is disabled. Enable AI in Settings first.' });
    }
    const settings = await getAiSettings();
    let provider;
    if (settings.provider && settings.apiKey) {
      const { decrypt: dec } = await import('../services/encryption.js');
      const decryptedKey = dec(settings.apiKey);
      provider = getLLMProvider(settings.provider, decryptedKey, settings.model || undefined);
    } else {
      provider = getLLMProvider();
    }
    const reply = await provider.complete(
      'Reply with exactly: JobPilot AI connected.',
      'You are a helpful assistant.',
      { maxTokens: 32 }
    );
    res.json({ ok: true, provider: provider.name, reply: reply.trim() });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
