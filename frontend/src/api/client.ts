const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () =>
    request<{
      status: string;
      llmProvider: string;
      llmConfigured: boolean;
      hasAnthropicKey: boolean;
      hasCopilotToken: boolean;
      hasEncryption: boolean;
    }>('/health'),

  ai: {
    status: () =>
      request<{
        provider: string;
        providerName: string;
        configured: boolean;
        model: string;
        copilotModels: string[];
        aiEnabled: boolean;
      }>('/ai/status'),
    test: () => request<{ ok: boolean; reply?: string; error?: string }>('/ai/test', { method: 'POST' }),
    providers: () =>
      request<{
        active: string;
        providers: {
          id: string;
          name: string;
          configured: boolean;
          defaultModel: string;
          models: string[];
          hasEnvKey: boolean;
          hasDbKey: boolean;
        }[];
      }>('/ai/providers'),
    setProvider: (data: { provider: string; apiKey?: string; model?: string }) =>
      request<{ success: boolean }>('/ai/provider', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  credentials: {
    list: () => request<import('../types').PlatformCredential[]>('/credentials'),
    save: (data: { platform: string; username: string; password: string }) =>
      request('/credentials', { method: 'POST', body: JSON.stringify(data) }),
    test: (platform: string) =>
      request<{ ok: boolean; message: string }>(`/credentials/test/${platform}`, { method: 'POST' }),
    browserLogin: (platform: string) =>
      request<{ ok: boolean; message: string }>(`/credentials/browser-login/${platform}`, { method: 'POST' }),
    delete: (platform: string) =>
      request(`/credentials/${platform}`, { method: 'DELETE' }),
  },

  jobs: {
    list: (params: Record<string, string>) => {
      const q = new URLSearchParams(params).toString();
      return request<{ jobs: import('../types').Job[]; total: number; totalPages: number }>(
        `/jobs?${q}`
      );
    },
    get: (id: string) => request<import('../types').Job>(`/jobs/${id}`),
    fetch: (data: Record<string, unknown>) =>
      request<{ added: number; total: number; errors: string[]; expandedKeywords?: string[] }>('/jobs/fetch', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<{ status: string; isBookmarked: boolean }>) =>
      request(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    bookmark: (id: string) => request(`/jobs/${id}/bookmark`, { method: 'POST' }),
  },

  resume: {
    getBase: () => request<unknown[]>('/resume/base'),
    uploadBase: (file: File) => {
      const fd = new FormData();
      fd.append('resume', file);
      return fetch(`${BASE}/resume/base`, { method: 'POST', body: fd }).then(async (r) => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error ?? 'Upload failed'); }
        return r.json();
      });
    },
    tailor: (jobId: string) =>
      request(`/resume/job/${jobId}/tailor`, { method: 'POST' }),
    tailorSync: (jobId: string) =>
      request<{ contentText: string }>(`/resume/job/${jobId}/tailor/sync`, { method: 'POST' }),
    getJob: (jobId: string) =>
      request<{ tailored: { contentText: string; aiProcessing: boolean } | null }>(
        `/resume/job/${jobId}`
      ),
    update: (jobId: string, contentText: string) =>
      request(`/resume/job/${jobId}`, { method: 'PUT', body: JSON.stringify({ contentText }) }),
    diff: (jobId: string) =>
      request<{ diff: { type: string; value: string }[] }>(`/resume/job/${jobId}/diff`),
    download: (jobId: string, format = 'docx') =>
      window.open(`${BASE}/resume/job/${jobId}/download?format=${format}`, '_blank'),
    coverLetter: (jobId: string) =>
      request<{ content: string }>(`/resume/job/${jobId}/cover-letter`, { method: 'POST' }),
    interviewPrep: (jobId: string) =>
      request<{ questions: string[] }>(`/resume/job/${jobId}/interview-prep`),
  },

  profile: {
    get: () => request<import('../types').UserProfile>('/profile'),
    update: (data: Partial<import('../types').UserProfile>) =>
      request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  },

  apply: {
    single: (jobId: string) =>
      request<{ status: string; message: string }>(`/apply/job/${jobId}`, { method: 'POST' }),
    batch: (jobIds?: string[]) =>
      request<{ batchId: string; count: number }>('/apply/batch', {
        method: 'POST',
        body: JSON.stringify({ jobIds }),
      }),
    progress: (batchId: string) =>
      request<import('../types').ApplyProgress[]>(`/apply/progress/${batchId}`),
    markApplied: (jobId: string) =>
      request(`/apply/job/${jobId}/mark-applied`, { method: 'POST' }),
    history: () => request<unknown[]>('/apply/history'),
  },

  ats: {
    score: (resumeText: string, jobDescription?: string) =>
      request<import('../types').ATSResult>('/ats/score', {
        method: 'POST',
        body: JSON.stringify({ resumeText, jobDescription }),
      }),
    scoreUpload: (file: File, jobDescription?: string) => {
      const fd = new FormData();
      fd.append('resume', file);
      if (jobDescription) fd.append('jobDescription', jobDescription);
      return fetch(`${BASE}/ats/score/upload`, { method: 'POST', body: fd }).then(async r => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error ?? 'Upload failed'); }
        return r.json() as Promise<import('../types').ATSResult & { extractedText: string }>;
      });
    },
    scoreForJob: (jobId: string) =>
      request<import('../types').ATSResult>(`/ats/score/job/${jobId}`, { method: 'POST' }),
    enhance: (resumeText: string, jobDescription?: string) =>
      request<{ enhanced: string }>('/ats/enhance', {
        method: 'POST',
        body: JSON.stringify({ resumeText, jobDescription }),
      }),
    downloadDocx: async (resumeText: string) => {
      const res = await fetch(`${BASE}/ats/download/docx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText }),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'enhanced-resume.docx';
      a.click();
      URL.revokeObjectURL(url);
    },
    downloadPdf: async (resumeText: string) => {
      const res = await fetch(`${BASE}/ats/download/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText }),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'enhanced-resume.pdf';
      a.click();
      URL.revokeObjectURL(url);
    },
    enhanceUpload: (file: File, jobDescription?: string) => {
      const fd = new FormData();
      fd.append('resume', file);
      if (jobDescription) fd.append('jobDescription', jobDescription);
      return fetch(`${BASE}/ats/enhance/upload`, { method: 'POST', body: fd }).then(async r => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error ?? 'Upload failed'); }
        return r.json() as Promise<{ enhanced: string; originalText: string }>;
      });
    },
    applyFix: (resumeText: string, suggestion: string, userInput: string, jobDescription?: string) =>
      request<{ updated: string }>('/ats/apply-fix', {
        method: 'POST',
        body: JSON.stringify({ resumeText, suggestion, userInput, jobDescription }),
      }),
    visualScan: (resumeText: string) =>
      request<import('../types').VisualScanResult>('/ats/visual-scan', {
        method: 'POST',
        body: JSON.stringify({ resumeText }),
      }),
    visualScanUpload: (file: File) => {
      const fd = new FormData();
      fd.append('resume', file);
      return fetch(`${BASE}/ats/visual-scan/upload`, { method: 'POST', body: fd }).then(async r => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error ?? 'Upload failed'); }
        return r.json() as Promise<import('../types').VisualScanResult & { extractedText: string }>;
      });
    },
  },

  latex: {
    enhance: (latexCode: string, jobDescription?: string) =>
      request<{ enhanced: string }>('/ats/latex/enhance', {
        method: 'POST',
        body: JSON.stringify({ latexCode, jobDescription }),
      }),
    fix: (latexCode: string, suggestion: string, userInput: string, jobDescription?: string) =>
      request<{ updated: string }>('/ats/latex/fix', {
        method: 'POST',
        body: JSON.stringify({ latexCode, suggestion, userInput, jobDescription }),
      }),
  },

  dashboard: {
    stats: (range?: string) => request<import('../types').DashboardStats>(`/dashboard/stats${range && range !== 'All' ? `?range=${range}` : ''}`),
    activity: () => request<{ type: string; message: string; createdAt: string }[]>('/dashboard/activity'),
    notifications: (unread?: boolean) =>
      request<{ id: string; title: string; message: string; type: string; read: boolean }[]>(
        `/dashboard/notifications${unread ? '?unread=true' : ''}`
      ),
    markRead: (id: string) =>
      request(`/dashboard/notifications/${id}/read`, { method: 'PATCH' }),
    readAll: () => request('/dashboard/notifications/read-all', { method: 'PATCH' }),
    exportCsv: () => window.open(`${BASE}/dashboard/export/csv`, '_blank'),
    skillGaps: () => request<{ gaps: { skill: string; frequency: number }[] }>('/dashboard/skill-gaps'),
    reset: () => request('/dashboard/reset', { method: 'POST', body: JSON.stringify({ confirm: true }) }),
  },
};
