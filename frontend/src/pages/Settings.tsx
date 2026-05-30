import { useEffect, useState } from 'react';
import { Shield, Link2, CheckCircle, XCircle, Loader2, Trash2, Zap, ZapOff, Key, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { UserProfile, PlatformCredential } from '../types';

interface ProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  defaultModel: string;
  models: string[];
  hasEnvKey: boolean;
  hasDbKey: boolean;
}

export default function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [credentials, setCredentials] = useState<PlatformCredential[]>([]);
  const [testing, setTesting] = useState<string | null>(null);

  const [health, setHealth] = useState<{
    llmProvider?: string;
    llmConfigured?: boolean;
    hasCopilotToken?: boolean;
    hasAnthropicKey?: boolean;
    hasEncryption: boolean;
  } | null>(null);
  const [aiStatus, setAiStatus] = useState<{
    provider: string;
    model: string;
    configured: boolean;
    copilotModels: string[];
    aiEnabled: boolean;
  } | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [activeProvider, setActiveProvider] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.profile.get().then(setProfile).catch(() => {});
    api.credentials.list().then(setCredentials).catch(() => {});
    api.health().then(setHealth).catch(() => {});
    api.ai.status().then(setAiStatus).catch(() => {});
    api.ai.providers().then((r) => {
      setProviders(r.providers);
      setActiveProvider(r.active);
      setSelectedProvider(r.active);
    }).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const toggleAi = async (enabled: boolean) => {
    if (!profile) return;
    try {
      await api.profile.update({ aiEnabled: enabled });
      setProfile({ ...profile, aiEnabled: enabled });
      toast.success(enabled ? 'AI mode enabled' : 'AI mode disabled');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle AI');
    }
  };

  const saveProvider = async () => {
    setSaving(true);
    try {
      await api.ai.setProvider({
        provider: selectedProvider,
        apiKey: apiKeyInput || undefined,
        model: selectedModel || undefined,
      });
      setApiKeyInput('');
      toast.success(`Switched to ${providers.find(p => p.id === selectedProvider)?.name ?? selectedProvider}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await api.profile.update(profile);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const testConnection = async (platform: string) => {
    setTesting(platform);
    try {
      const r = await api.credentials.test(platform);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(null);
    }
  };

  if (!profile) {
    return (
      <div className="p-7 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-jp-accent" />
      </div>
    );
  }

  const currentProviderInfo = providers.find(p => p.id === selectedProvider);

  return (
    <div className="p-7 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-jp-text-muted mt-1">AI, credentials, and profile configuration</p>
      </div>

      {health && !health.hasEncryption && (
        <div className="card border-jp-orange/30 bg-jp-orange/5">
          <p className="text-sm text-jp-orange">
            Set ENCRYPTION_SECRET (32+ chars) in backend/.env.
          </p>
        </div>
      )}

      {/* AI Mode Toggle */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile.aiEnabled ? (
              <Zap className="w-5 h-5 text-jp-accent" />
            ) : (
              <ZapOff className="w-5 h-5 text-jp-text-muted" />
            )}
            <div>
              <p className="font-semibold">AI Mode</p>
              <p className="text-xs text-jp-text-muted">
                {profile.aiEnabled
                  ? 'AI features enabled — resume tailoring, match scoring, ATS analysis'
                  : 'AI disabled — core features (job search, tracking, apply) still work'}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleAi(!profile.aiEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              profile.aiEnabled ? 'bg-jp-accent' : 'bg-jp-surface-3'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                profile.aiEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      {/* AI Provider Selection */}
      {profile.aiEnabled && (
        <section className="card space-y-4">
          <p className="section-title">AI Provider</p>

          <div className="space-y-3">
            {providers.map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedProvider === p.id
                    ? 'border-jp-accent bg-jp-accent/5'
                    : 'border-jp-border hover:border-jp-text-muted'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value={p.id}
                  checked={selectedProvider === p.id}
                  onChange={() => {
                    setSelectedProvider(p.id);
                    setSelectedModel('');
                    setApiKeyInput('');
                  }}
                  className="accent-jp-accent"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{p.name}</span>
                    {p.configured && (
                      <span className="badge bg-jp-accent/15 text-jp-accent text-[10px]">Configured</span>
                    )}
                    {p.id === activeProvider && (
                      <span className="badge bg-jp-cyan/15 text-jp-cyan text-[10px]">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-jp-text-muted mt-0.5">
                    {p.hasEnvKey ? 'API key set via .env' : p.hasDbKey ? 'API key saved in app' : 'No API key configured'}
                    {' · '}{p.defaultModel}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {currentProviderInfo && selectedProvider !== 'copilot' && (
            <div className="space-y-3 pt-2 border-t border-jp-border-subtle">
              <div>
                <label className="text-xs text-jp-text-muted block mb-1 flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  API Key {currentProviderInfo.hasEnvKey && '(overrides .env key)'}
                </label>
                <input
                  type="password"
                  className="input font-mono text-sm"
                  placeholder={currentProviderInfo.configured ? '••••••••  (key already saved)' : 'Paste your API key...'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
              </div>

              {currentProviderInfo.models.length > 0 && (
                <div>
                  <label className="text-xs text-jp-text-muted block mb-1">Model</label>
                  <div className="relative">
                    <select
                      className="input appearance-none pr-8 text-sm"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      <option value="">Default ({currentProviderInfo.defaultModel})</option>
                      {currentProviderInfo.models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-jp-text-muted pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={saveProvider}
              disabled={saving || selectedProvider === activeProvider && !apiKeyInput && !selectedModel}
              className="btn-primary text-sm"
            >
              {saving ? 'Saving...' : 'Save Provider'}
            </button>
            <button
              type="button"
              disabled={aiTesting}
              onClick={async () => {
                setAiTesting(true);
                try {
                  const r = await api.ai.test();
                  if (r.ok) toast.success(`AI OK: ${r.reply}`);
                  else toast.error(r.error ?? 'Test failed');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Test failed');
                } finally {
                  setAiTesting(false);
                  load();
                }
              }}
              className="btn-secondary text-sm"
            >
              {aiTesting ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {aiStatus && (
            <div className="text-xs text-jp-text-muted pt-2 border-t border-jp-border-subtle">
              Active: <span className="text-jp-text font-medium">{aiStatus.provider}</span>
              {' · '}Model: <span className="font-mono text-jp-text">{aiStatus.model}</span>
              {' · '}Status:{' '}
              {aiStatus.configured ? (
                <span className="text-jp-accent">Ready</span>
              ) : (
                <span className="text-jp-rose">Not configured</span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Platform Connections */}
      <section className="card space-y-4">
        <p className="section-title flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-jp-accent" />
          Platform Connections
        </p>
        {(['linkedin', 'naukri'] as const).map((platform) => {
          const cred = credentials.find((c) => c.platform === platform);
          const status = cred?.status ?? 'disconnected';
          return (
            <div key={platform} className="border border-jp-border rounded-jp-sm p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium capitalize flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-jp-text-secondary" />
                  {platform}
                </span>
                <span
                  className={`badge flex items-center gap-1 ${
                    status === 'connected'
                      ? 'bg-jp-accent/15 text-jp-accent'
                      : status === 'error'
                        ? 'bg-jp-rose/15 text-jp-rose'
                        : 'bg-jp-text-muted/20 text-jp-text-muted'
                  }`}
                >
                  {status === 'connected' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {status}
                </span>
              </div>
              {cred?.hasCredentials && (
                <p className="text-xs text-jp-text-muted">Session stored (encrypted)</p>
              )}
              {cred?.lastError && (
                <p className="text-xs text-jp-rose">{cred.lastError}</p>
              )}
              <p className="text-xs text-jp-text-secondary">
                Open a browser window and log in with your existing account.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setTesting(platform);
                    try {
                      toast.loading(`Opening ${platform} login...`, { id: `browser-${platform}` });
                      const r = await api.credentials.browserLogin(platform);
                      toast.dismiss(`browser-${platform}`);
                      if (r.ok) toast.success(r.message);
                      else toast.error(r.message);
                      load();
                    } catch (err) {
                      toast.dismiss(`browser-${platform}`);
                      toast.error(err instanceof Error ? err.message : 'Login failed');
                    } finally {
                      setTesting(null);
                    }
                  }}
                  disabled={testing === platform}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  {testing === platform ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  {testing === platform ? 'Waiting...' : 'Login via Browser'}
                </button>
                <button onClick={() => testConnection(platform)} disabled={testing === platform} className="btn-secondary text-sm">
                  Test
                </button>
                {cred?.hasCredentials && (
                  <button onClick={() => api.credentials.delete(platform).then(load)} className="btn-secondary text-sm text-jp-rose hover:border-jp-rose">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Profile Form */}
      <form onSubmit={saveProfile} className="card space-y-5">
        <p className="section-title">Application Profile</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(
            [
              ['fullName', 'Full name'],
              ['email', 'Email'],
              ['phone', 'Phone'],
              ['linkedinUrl', 'LinkedIn URL'],
              ['githubUrl', 'GitHub URL'],
              ['portfolioUrl', 'Portfolio URL'],
              ['currentLocation', 'Location'],
              ['currentRole', 'Current role'],
              ['currentCompany', 'Current company'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="text-xs text-jp-text-muted block mb-1">{label}</label>
              <input
                className="input"
                value={(profile[key] as string) ?? ''}
                onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-jp-text-muted block mb-1">Years of experience</label>
            <input
              type="number"
              className="input"
              value={profile.yearsExperience}
              onChange={(e) =>
                setProfile({ ...profile, yearsExperience: parseInt(e.target.value, 10) || 0 })
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-jp-text-muted block mb-1">Skills (comma-separated)</label>
            <textarea
              className="input h-20"
              value={profile.skills}
              onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-jp-text-muted block mb-1">Education</label>
            <textarea
              className="input h-20"
              value={profile.education}
              onChange={(e) => setProfile({ ...profile, education: e.target.value })}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-jp-text-secondary">
          <input
            type="checkbox"
            checked={profile.willingToRelocate}
            onChange={(e) => setProfile({ ...profile, willingToRelocate: e.target.checked })}
            className="accent-jp-accent"
          />
          Willing to relocate
        </label>
        <button type="submit" className="btn-primary">
          Save profile
        </button>
      </form>

      {/* Danger Zone */}
      <section className="card border-jp-rose/20">
        <p className="section-title text-jp-rose mb-3">Danger Zone</p>
        <button
          onClick={async () => {
            if (confirm('Delete all jobs and application history? Profile and credentials are kept.')) {
              await api.dashboard.reset();
              toast.success('Data reset');
            }
          }}
          className="btn-secondary text-sm text-jp-rose hover:border-jp-rose"
        >
          Reset job data
        </button>
      </section>
    </div>
  );
}
