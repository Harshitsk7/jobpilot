import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from '../api/client';

interface AppRecord {
  id: string;
  status: string;
  appliedAt: string;
  errorMessage?: string | null;
  job: { title: string; company: string; url: string; platform: string };
}

const statusBadge: Record<string, string> = {
  success: 'bg-jp-accent/15 text-jp-accent',
  manual: 'bg-jp-orange/15 text-jp-orange',
  failed: 'bg-jp-rose/15 text-jp-rose',
  skipped: 'bg-jp-text-muted/20 text-jp-text-muted',
};

export default function Applications() {
  const [apps, setApps] = useState<AppRecord[]>([]);

  useEffect(() => {
    api.apply.history().then((r) => setApps(r as AppRecord[])).catch(() => {});
  }, []);

  return (
    <div className="p-7 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
        <p className="text-sm text-jp-text-muted mt-1">
          {apps.length} total applications
        </p>
      </div>

      <div className="bg-jp-surface border border-jp-border-subtle rounded-jp overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-jp-border text-jp-text-muted text-left">
              <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Job</th>
              <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Platform</th>
              <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {apps.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-jp-text-muted">
                  No applications yet
                </td>
              </tr>
            ) : (
              apps.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-jp-border-subtle hover:bg-jp-surface-2/50 transition-colors"
                >
                  <td className="px-5 py-3.5 text-jp-text-muted font-mono text-xs">
                    {new Date(a.appliedAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium">{a.job.title}</p>
                    <p className="text-jp-text-muted text-xs mt-0.5">{a.job.company}</p>
                    {a.errorMessage && (
                      <p className="text-xs text-jp-rose mt-1">{a.errorMessage}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 capitalize text-jp-text-secondary text-xs">
                    {a.job.platform}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${statusBadge[a.status] ?? statusBadge.failed}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <a
                      href={a.job.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-jp-accent hover:text-jp-accent-dim transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
