import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Briefcase, MapPin } from 'lucide-react';
import { api } from '../api/client';
import type { Job } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Job[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.jobs.list({ search: query, limit: '8', sort: 'createdAt', order: 'desc' });
        setResults(r.jobs);
        setSelected(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const selectJob = (job: Job) => {
    onClose();
    navigate(`/jobs?highlight=${job.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && results[selected]) {
      selectJob(results[selected]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-jp-surface border border-jp-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-jp-border-subtle">
          <Search className="w-4 h-4 text-jp-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search jobs by title or company..."
            className="flex-1 bg-transparent text-sm text-jp-text outline-none placeholder:text-jp-text-muted"
          />
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 bg-jp-surface-3 rounded text-jp-text-secondary">ESC</kbd>
        </div>

        {loading && (
          <div className="px-4 py-3 text-xs text-jp-text-muted">Searching...</div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-jp-text-muted">No jobs found</div>
        )}

        {results.length > 0 && (
          <div className="max-h-[320px] overflow-y-auto py-1">
            {results.map((job, i) => (
              <button
                key={job.id}
                onClick={() => selectJob(job)}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selected ? 'bg-jp-accent/10' : 'hover:bg-jp-surface-2'
                }`}
              >
                <Briefcase className="w-4 h-4 text-jp-text-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  <p className="text-xs text-jp-text-muted truncate flex items-center gap-1">
                    {job.company}
                    {job.location && (
                      <>
                        <MapPin className="w-3 h-3 inline" />
                        {job.location}
                      </>
                    )}
                  </p>
                </div>
                {job.matchScore != null && (
                  <span className="text-xs font-mono text-jp-accent">{job.matchScore}%</span>
                )}
              </button>
            ))}
          </div>
        )}

        {!query && (
          <div className="px-4 py-6 text-center text-xs text-jp-text-muted">
            Type to search jobs by title or company
          </div>
        )}
      </div>
    </div>
  );
}
