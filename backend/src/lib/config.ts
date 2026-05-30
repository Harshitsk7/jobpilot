import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(backendRoot, '.env') });

export type LLMProviderName = 'anthropic' | 'copilot' | 'github_copilot' | 'openai' | 'gemini' | 'none';

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),

  /** anthropic | copilot | github_copilot */
  llmProvider: (process.env.LLM_PROVIDER ?? 'copilot').toLowerCase() as LLMProviderName,

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  claudeModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-6',

  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o',

  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',

  /** Copilot SSO oauth_token (gho_...) from IDE auth session */
  githubCopilotToken:
    process.env.GITHUB_COPILOT_TOKEN ??
    process.env.COPILOT_OAUTH_TOKEN ??
    process.env.OAUTH_TOKEN ??
    process.env.COPILOT_GITHUB_TOKEN ??
    '',
  /** Copilot SSO githubAppId (Ov23...) — IDE client registration */
  githubCopilotAppId:
    process.env.GITHUB_COPILOT_APP_ID ??
    process.env.GITHUB_APP_ID ??
    process.env.COPILOT_GITHUB_APP_ID ??
    '',
  /** Copilot uses dotted IDs e.g. claude-opus-4.6 (not claude-opus-4-6) */
  copilotModel: process.env.COPILOT_MODEL ?? 'claude-opus-4.6',
  copilotApiBase: (process.env.COPILOT_API_BASE ?? 'https://api.githubcopilot.com').replace(/\/$/, ''),
  copilotApiVersion: process.env.COPILOT_API_VERSION ?? '2025-04-01',
  /** VS Code + Copilot Chat client fingerprint (required by Copilot API) */
  copilotEditorVersion: process.env.COPILOT_EDITOR_VERSION ?? 'vscode/1.96.0',
  copilotPluginVersion: process.env.COPILOT_PLUGIN_VERSION ?? 'copilot-chat/0.26.7',
  copilotUserAgent: process.env.COPILOT_USER_AGENT ?? 'GitHubCopilotChat/0.26.7',
  encryptionSecret: process.env.ENCRYPTION_SECRET ?? '',
  dataDir: path.resolve(process.env.DATA_DIR ?? path.join(backendRoot, 'data')),
  resumesDir: path.resolve(process.env.DATA_DIR ?? path.join(backendRoot, 'data'), 'resumes'),
  uploadsDir: path.resolve(process.env.DATA_DIR ?? path.join(backendRoot, 'data'), 'uploads'),
  sessionsDir: path.resolve(process.env.DATA_DIR ?? path.join(backendRoot, 'data'), 'sessions'),
  playwrightHeadless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
  applyDelayMinMs: 3000,
  applyDelayMaxMs: 8000,
};
