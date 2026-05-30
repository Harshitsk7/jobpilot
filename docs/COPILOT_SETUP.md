# GitHub Copilot as JobPilot's LLM

JobPilot can use your **GitHub Copilot subscription** instead of Anthropic. It exchanges your IDE OAuth token for a short-lived session token, then calls the same `chat/completions` API Copilot Chat uses—with editor client headers (`editor-version`, `copilot-chat` plugin, etc.).

> Use only with your own Copilot license. Misuse may violate [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).

## 1. Configure `.env`

```env
LLM_PROVIDER=copilot
GITHUB_COPILOT_TOKEN=ghu_xxxxxxxx   # your IDE OAuth token
COPILOT_MODEL=claude-opus-4-6       # default; see /api/ai/status for your plan's models
```

## 2. Get your Copilot OAuth token

The token is created when you sign into **GitHub Copilot in VS Code or Cursor**. It is **not** a classic PAT for `api.github.com`—it is the Copilot-internal OAuth token.

### Option A — VS Code (recommended)

1. Install **GitHub Copilot** and sign in.
2. Command Palette → `GitHub Copilot: Log in` (if needed).
3. Extract token using one of:
   - **Copilot Debug** (if available in your VS Code version)
   - Or run this in a terminal where `code` CLI works:

```bash
# Some setups expose token via GitHub auth:
gh auth status
```

### Option B — From VS Code / Cursor storage (advanced)

1. Sign in to Copilot in the IDE.
2. On Windows, credentials may live in Credential Manager under `git:https://github.com` or Copilot-specific entries.
3. Alternatively use the **GitHub Pull Requests** extension auth, then call the token endpoint:

```bash
curl -H "Authorization: Bearer YOUR_GITHUB_OAUTH_TOKEN" \
  https://api.github.com/copilot_internal/v2/token
```

The `token` field in the JSON response is the **session** token (short-lived). JobPilot does this exchange automatically if you set `GITHUB_COPILOT_TOKEN` to your **OAuth** token (starts with `ghu_` or similar).

### Option C — Environment from another tool

If you already use `claude-code-router`, `copilot-api`, or similar, you may have `COPILOT_OAUTH_TOKEN` set—JobPilot also reads:

- `COPILOT_OAUTH_TOKEN`
- `COPILOT_GITHUB_TOKEN`

## 3. Verify

```bash
curl http://localhost:3001/api/ai/status
curl -X POST http://localhost:3001/api/ai/test
```

Or in the UI: **Settings → AI / Copilot** → **Test AI connection**.

## 4. Models

List available models:

```bash
curl http://localhost:3001/api/ai/status
# → copilotModels: [...]
```

Set `COPILOT_MODEL` to one of those IDs (default: `claude-opus-4-6`).

## 5. Troubleshooting

| Error | Fix |
|-------|-----|
| Token exchange 401 | Re-login to Copilot in IDE; copy a fresh OAuth token |
| 403 on chat/completions | Try `COPILOT_API_BASE=https://api.individual.githubcopilot.com` (Education/Individual plans) |
| Empty models list | Token valid but wrong plan—check Copilot subscription |
| Rate limited | Copilot quotas apply; reduce parallel AI jobs |

## Switch back to Anthropic

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```
