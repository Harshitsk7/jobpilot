import { randomUUID } from 'crypto';
import { config } from '../../lib/config.js';
import type { LLMCompleteOptions, LLMProvider } from './provider.js';

/** Copilot internal token response */
interface CopilotTokenResponse {
  token: string;
  expires_at: number;
  endpoints?: { api?: string };
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

/**
 * GitHub Copilot chat API client.
 * Uses your IDE OAuth token (GITHUB_COPILOT_TOKEN) to obtain a session token,
 * then calls the same chat/completions endpoint VS Code Copilot Chat uses.
 */
export class GitHubCopilotProvider implements LLMProvider {
  readonly name = 'github_copilot';

  private sessionToken: string | null = null;
  private sessionExpiry = 0;
  private apiBase = config.copilotApiBase;

  isConfigured(): boolean {
    return !!config.githubCopilotToken && !!config.githubCopilotAppId;
  }

  /**
   * Client fingerprint matching a VS Code Copilot Chat SSO session
   * (oauth_token + githubAppId from IDE auth storage).
   */
  private ssoClientHeaders(bearerToken: string): Record<string, string> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${bearerToken}`,
      'content-type': 'application/json',
      'editor-version': config.copilotEditorVersion,
      'editor-plugin-version': config.copilotPluginVersion,
      'user-agent': config.copilotUserAgent,
      'x-github-api-version': config.copilotApiVersion,
      'x-vscode-user-agent-library-version': 'electron-fetch',
      'x-github-authentication-method': 'oauth',
      'copilot-integration-id': 'vscode-chat',
      'openai-intent': 'conversation-panel',
    };

    if (config.githubCopilotAppId) {
      headers['x-github-app-id'] = config.githubCopilotAppId;
      headers['x-github-oauth-client-id'] = config.githubCopilotAppId;
    }

    return headers;
  }

  private oauthHeaders(): Record<string, string> {
    if (!config.githubCopilotToken) {
      throw new Error('GITHUB_COPILOT_TOKEN (oauth_token) is not configured');
    }
    if (!config.githubCopilotAppId) {
      throw new Error('GITHUB_COPILOT_APP_ID (githubAppId) is not configured');
    }
    return this.ssoClientHeaders(config.githubCopilotToken);
  }

  /** Session headers after SSO token exchange */
  private ideHeaders(sessionToken: string, vision = false): Record<string, string> {
    return {
      ...this.ssoClientHeaders(sessionToken),
      'copilot-vision-request': String(vision),
      'x-request-id': randomUUID(),
      'X-Initiator': 'user',
    };
  }

  /** Exchange IDE OAuth token for a short-lived Copilot session token */
  private async refreshSessionToken(): Promise<string> {
    const oauth = config.githubCopilotToken;
    if (!oauth || !config.githubCopilotAppId) {
      throw new Error(
        'Set GITHUB_COPILOT_TOKEN (oauth_token) and GITHUB_COPILOT_APP_ID (githubAppId) in backend/.env'
      );
    }

    const now = Date.now();
    if (this.sessionToken && now < this.sessionExpiry - 60_000) {
      return this.sessionToken;
    }

    const resp = await fetch('https://api.github.com/copilot_internal/v2/token', {
      method: 'GET',
      headers: this.oauthHeaders(),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(
        `Copilot token exchange failed (${resp.status}). Ensure GITHUB_COPILOT_TOKEN is a valid IDE OAuth token. ${body.slice(0, 200)}`
      );
    }

    const data = (await resp.json()) as CopilotTokenResponse;
    this.sessionToken = data.token;
    this.sessionExpiry = data.expires_at * 1000;
    if (data.endpoints?.api) {
      this.apiBase = data.endpoints.api.replace(/\/$/, '');
    }
    return this.sessionToken;
  }

  async complete(
    prompt: string,
    system: string,
    options?: LLMCompleteOptions
  ): Promise<string> {
    const sessionToken = await this.refreshSessionToken();
    const url = `${this.apiBase}/chat/completions`;

    const body = {
      model: config.copilotModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.3,
      stream: false,
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: this.ideHeaders(sessionToken),
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    if (!resp.ok) {
      const err = `Copilot API error (${resp.status}) model=${config.copilotModel}: ${text.slice(0, 400)}`;
      console.error('[copilot]', err);
      throw new Error(err);
    }

    let data: ChatCompletionResponse;
    try {
      data = JSON.parse(text) as ChatCompletionResponse;
    } catch {
      throw new Error('Invalid JSON from Copilot API');
    }

    if (data.error?.message) {
      throw new Error(data.error.message);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Copilot API');
    }
    return content;
  }

  /** List models available to your Copilot subscription */
  async listModels(): Promise<string[]> {
    const sessionToken = await this.refreshSessionToken();
    const resp = await fetch(`${this.apiBase}/models`, {
      headers: this.ideHeaders(sessionToken),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { data?: { id: string }[] };
    return data.data?.map((m) => m.id) ?? [];
  }
}
