import {
  Bookmark,
  BookmarkCheck,
  Send,
  Zap,
} from 'lucide-react';
import type { Job, JobStatus } from '../types';

const statusColors: Record<JobStatus, string> = {
  not_applied: 'bg-jp-text-muted/20 text-jp-text-muted',
  reviewing: 'bg-jp-orange/15 text-jp-orange',
  applied: 'bg-jp-accent/15 text-jp-accent',
  rejected: 'bg-jp-rose/15 text-jp-rose',
  interview: 'bg-jp-cyan/15 text-jp-cyan',
};

const platformStyles: Record<string, { bg: string; text: string }> = {
  linkedin: { bg: 'bg-[#0a66c2]/15', text: 'text-[#70b5f9]' },
  naukri: { bg: 'bg-[#4a90d9]/15', text: 'text-[#93c5fd]' },
};

const companyColors: Record<string, string> = {
  A: 'from-[#ff9900] to-[#ff6600]',
  B: 'from-[#0066ff] to-[#0044cc]',
  C: 'from-[#cc0000] to-[#990000]',
  D: 'from-[#5865f2] to-[#7289da]',
  G: 'from-[#1a73e8] to-[#4285f4]',
  M: 'from-[#f25022] to-[#ffb900]',
  N: 'from-[#00c853] to-[#009624]',
  S: 'from-[#ff6b6b] to-[#ee5a24]',
  T: 'from-[#00b4d8] to-[#0077b6]',
};

function getLogoGradient(company: string): string {
  const first = company.charAt(0).toUpperCase();
  return companyColors[first] ?? 'from-jp-surface-3 to-jp-surface-2';
}

interface Props {
  job: Job;
  selected?: boolean;
  onSelect: () => void;
  onBookmark: () => void;
  onApply: () => void;
  onStatusChange: (status: JobStatus) => void;
}

export default function JobCard({
  job,
  selected,
  onSelect,
  onBookmark,
  onApply,
  onStatusChange,
}: Props) {
  const score = job.matchScore ?? 0;
  const scoreColor =
    score >= 75 ? 'text-jp-accent' : score >= 50 ? 'text-jp-orange' : 'text-jp-rose';

  const pStyle = platformStyles[job.platform] ?? platformStyles.linkedin;

  return (
    <article
      onClick={onSelect}
      className={`grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-4 bg-jp-surface border rounded-jp cursor-pointer transition-all items-start ${
        selected
          ? 'border-jp-accent bg-jp-accent-glow'
          : 'border-jp-border-subtle hover:border-jp-border hover:translate-x-0.5'
      }`}
    >
      <div
        className={`w-11 h-11 rounded-[10px] bg-gradient-to-br ${getLogoGradient(job.company)} flex items-center justify-center text-white text-lg font-bold flex-shrink-0`}
      >
        {job.company.charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[0.92rem] tracking-tight truncate">{job.title}</h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark();
            }}
            className="p-0.5 flex-shrink-0 hover:text-jp-accent transition-colors"
          >
            {job.isBookmarked ? (
              <BookmarkCheck className="w-4 h-4 text-jp-accent" />
            ) : (
              <Bookmark className="w-4 h-4 text-jp-text-muted" />
            )}
          </button>
        </div>
        <p className="text-sm text-jp-text-secondary mt-0.5">{job.company}</p>

        <div className="flex gap-3 mt-2 flex-wrap">
          {job.location && (
            <span className="text-xs text-jp-text-muted">📍 {job.location}</span>
          )}
          {job.salary && <span className="text-xs text-jp-text-muted">💰 {job.salary}</span>}
          {job.postedDate && (
            <span className="text-xs text-jp-text-muted">📅 {job.postedDate}</span>
          )}
          {job.jobType && (
            <span className="text-xs text-jp-text-muted">💼 {job.jobType}</span>
          )}
          {job.applyType === 'easy_apply' && (
            <span className="text-xs font-medium text-jp-accent bg-jp-accent/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Zap className="w-3 h-3" /> Easy Apply
            </span>
          )}
          {job.applyType === 'external' && (
            <span className="text-xs text-jp-text-muted bg-jp-surface-3 px-1.5 py-0.5 rounded">
              External
            </span>
          )}
        </div>

        {job.aiProcessing || job.aiSummary === 'Generating...' ? (
          <div className="animate-pulse h-4 bg-jp-surface-3 rounded mt-2 w-3/4" />
        ) : job.aiSummary ? (
          <p className="text-xs text-jp-text-muted mt-2 line-clamp-1">{job.aiSummary}</p>
        ) : null}

        <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <span className={`badge ${statusColors[job.status]}`}>
            {job.status.replace('_', ' ')}
          </span>
          <select
            value={job.status}
            onChange={(e) => onStatusChange(e.target.value as JobStatus)}
            className="text-xs bg-jp-bg border border-jp-border rounded-md px-1.5 py-0.5 text-jp-text-secondary focus:outline-none focus:border-jp-accent"
          >
            <option value="not_applied">Not Applied</option>
            <option value="reviewing">Reviewing</option>
            <option value="applied">Applied</option>
            <option value="interview">Interview</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={onApply}
            disabled={job.status === 'applied'}
            className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
          >
            <Send className="w-3 h-3" />
            Apply
          </button>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        {job.aiProcessing ? (
          <div>
            <div className="w-10 h-5 bg-jp-surface-3 rounded animate-pulse" />
            <p className="text-[10px] text-jp-text-muted uppercase tracking-wide text-right mt-1">match</p>
          </div>
        ) : job.matchScore != null && job.matchScore > 0 ? (
          <div>
            <p className={`font-mono font-bold text-lg leading-none ${scoreColor}`}>{score}%</p>
            <p className="text-[10px] text-jp-text-muted uppercase tracking-wide text-right">match</p>
          </div>
        ) : (
          <div>
            <p className="font-mono font-bold text-lg leading-none text-jp-text-muted">—</p>
            <p className="text-[10px] text-jp-text-muted uppercase tracking-wide text-right">match</p>
          </div>
        )}
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${pStyle.bg} ${pStyle.text}`}>
          {job.platform === 'linkedin' ? 'LinkedIn' : 'Naukri'}
        </span>
      </div>
    </article>
  );
}
