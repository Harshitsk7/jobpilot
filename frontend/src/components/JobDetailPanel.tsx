import { useEffect, useState } from 'react';
import {
  X,
  RefreshCw,
  Download,
  FileEdit,
  ExternalLink,
  Loader2,
  Check,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Job } from '../types';
import { api } from '../api/client';

interface Props {
  job: Job | null;
  onClose: () => void;
}

export default function JobDetailPanel({ job, onClose }: Props) {
  const [resume, setResume] = useState('');
  const [editing, setEditing] = useState(false);
  const [diff, setDiff] = useState<{ type: string; value: string }[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [interviewQs, setInterviewQs] = useState<string[]>([]);

  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('jobpilot:close-panel', handler);
    return () => window.removeEventListener('jobpilot:close-panel', handler);
  }, [onClose]);

  useEffect(() => {
    if (!job) return;
    api.resume.getJob(job.id).then((r) => {
      if (r.tailored?.contentText) setResume(r.tailored.contentText);
      else setResume('');
    });
    setShowDiff(false);
    setCoverLetter('');
    setInterviewQs([]);
  }, [job?.id]);

  if (!job) return null;

  const tailor = async () => {
    setLoading(true);
    try {
      await api.resume.tailorSync(job.id);
      const r = await api.resume.getJob(job.id);
      setResume(r.tailored?.contentText ?? '');
      toast.success('Resume tailored');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Tailoring failed');
    } finally {
      setLoading(false);
    }
  };

  const loadDiff = async () => {
    const r = await api.resume.diff(job.id);
    setDiff(r.diff);
    setShowDiff(true);
  };

  const saveEdit = async () => {
    await api.resume.update(job.id, resume);
    setEditing(false);
    toast.success('Resume saved');
  };

  return (
    <aside className="w-[420px] flex-shrink-0 bg-jp-surface border-l border-jp-border-subtle flex flex-col h-full">
      <div className="p-5 border-b border-jp-border-subtle flex justify-between items-start">
        <div>
          <h2 className="font-bold text-lg tracking-tight">{job.title}</h2>
          <p className="text-sm text-jp-text-secondary mt-0.5">{job.company}</p>
          {(job.location || job.salary) && (
            <div className="flex gap-3 mt-2 flex-wrap">
              {job.location && (
                <span className="text-xs text-jp-text-muted">📍 {job.location}</span>
              )}
              {job.salary && (
                <span className="text-xs text-jp-text-muted">💰 {job.salary}</span>
              )}
            </div>
          )}
          {job.applyType === 'easy_apply' && (
            <span className="text-xs font-medium text-jp-accent bg-jp-accent/10 px-2 py-0.5 rounded inline-flex items-center gap-1 mt-2">
              <Zap className="w-3 h-3" /> Easy Apply
            </span>
          )}
          {job.applyType === 'external' && (
            <span className="text-xs text-jp-text-muted bg-jp-surface-3 px-2 py-0.5 rounded inline-block mt-2">
              External Application
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-jp-surface-2 rounded-lg transition-colors">
          <X className="w-5 h-5 text-jp-text-secondary" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm text-jp-accent hover:text-jp-accent-dim transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          View original posting
        </a>

        {job.matchRationale && job.matchRationale.length > 0 && (
          <div>
            <p className="section-title mb-2.5">Match Breakdown</p>
            <div className="space-y-2">
              {job.matchRationale.map((r, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Check className="w-3.5 h-3.5 text-jp-accent mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-jp-text-secondary">{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="section-title mb-2.5">AI Summary</p>
          {job.aiSummary ? (
            <p className="text-sm text-jp-text-secondary leading-relaxed">{job.aiSummary}</p>
          ) : (
            <p className="text-sm text-jp-text-muted italic">No summary yet</p>
          )}
        </div>

        <div>
          <p className="section-title mb-2.5">Description</p>
          <p className="text-sm text-jp-text-muted whitespace-pre-wrap max-h-40 overflow-auto leading-relaxed">
            {job.description.slice(0, 2000)}
          </p>
        </div>

        {resume && !editing && (
          <div>
            <p className="section-title mb-2.5">Tailored Resume</p>
            <div className="flex items-center gap-2.5 p-3 bg-jp-surface-3 rounded-[10px] mb-3">
              <Check className="w-4 h-4 text-jp-accent" />
              <span className="text-sm">Ready</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={tailor} disabled={loading} className="btn-primary col-span-2 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {resume ? 'Regenerate Resume' : 'Tailor Resume'}
          </button>
          <button onClick={() => setEditing(!editing)} className="btn-secondary flex items-center justify-center gap-1.5">
            <FileEdit className="w-3.5 h-3.5" />
            Edit
          </button>
          <button onClick={loadDiff} className="btn-secondary text-center">
            View Diff
          </button>
          <button
            className="btn-secondary flex items-center justify-center gap-1.5"
            onClick={async () => {
              const r = await api.resume.coverLetter(job.id);
              setCoverLetter(r.content);
            }}
          >
            Cover Letter
          </button>
          <button
            className="btn-secondary flex items-center justify-center gap-1.5"
            onClick={async () => {
              const r = await api.resume.interviewPrep(job.id);
              setInterviewQs(r.questions);
            }}
          >
            Interview Prep
          </button>
          <button
            onClick={() => api.resume.download(job.id)}
            className="btn-secondary col-span-2 flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download DOCX
          </button>
        </div>

        {showDiff && (
          <div className="font-mono text-xs max-h-48 overflow-auto bg-jp-bg p-3 rounded-jp-sm">
            {diff.map((line, i) => (
              <div
                key={i}
                className={
                  line.type === 'added'
                    ? 'text-jp-accent bg-jp-accent/10'
                    : line.type === 'removed'
                      ? 'text-jp-rose bg-jp-rose/10 line-through'
                      : 'text-jp-text-muted'
                }
              >
                {line.value}
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div>
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              className="input font-mono text-xs h-64"
            />
            <button onClick={saveEdit} className="btn-primary text-xs mt-2 w-full">
              Save changes
            </button>
          </div>
        )}

        {coverLetter && (
          <div>
            <p className="section-title mb-2">Cover Letter</p>
            <pre className="text-xs whitespace-pre-wrap bg-jp-bg p-3 rounded-jp-sm leading-relaxed">
              {coverLetter}
            </pre>
          </div>
        )}

        {interviewQs.length > 0 && (
          <div>
            <p className="section-title mb-2">Interview Questions</p>
            <ol className="space-y-2">
              {interviewQs.map((q, i) => (
                <li key={i} className="text-sm text-jp-text-secondary flex gap-2">
                  <span className="text-jp-text-muted font-mono text-xs mt-0.5">{i + 1}.</span>
                  <span>{q}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </aside>
  );
}
