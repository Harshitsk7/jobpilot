import { useCallback, useEffect, useState } from 'react';
import { Search, Loader2, Send, Filter, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { Job } from '../types';
import JobCard from '../components/JobCard';
import JobDetailPanel from '../components/JobDetailPanel';
import ApplyProgressModal from '../components/ApplyProgressModal';

export default function JobSearch() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [selected, setSelected] = useState<Job | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    title: 'Software Engineer',
    keywords: '',
    location: '',
    experienceLevel: '',
    jobType: '',
    datePosted: 'week',
    platforms: ['linkedin', 'naukri'] as string[],
    includeFeedPosts: true,
    sort: 'matchScore',
    status: '',
    platform: '',
    bookmarked: false,
    applyType: '',
    minScore: '',
  });

  const updateFilters = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: '18',
        sort: filters.sort,
        order: 'desc',
      };
      if (filters.status) params.status = filters.status;
      if (filters.platform) params.platform = filters.platform;
      if (filters.bookmarked) params.bookmarked = 'true';
      if (filters.applyType) params.applyType = filters.applyType;
      if (filters.minScore) params.minScore = filters.minScore;
      const data = await api.jobs.list(params);
      setJobs(data.jobs);
      setTotalPages(data.totalPages);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [page, filters.sort, filters.status, filters.platform, filters.bookmarked, filters.applyType, filters.minScore]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Auto-refresh while any job is still being AI-processed
  useEffect(() => {
    const hasProcessing = jobs.some((j) => j.aiProcessing);
    if (!hasProcessing) return;
    const timer = setInterval(loadJobs, 5000);
    return () => clearInterval(timer);
  }, [jobs, loadJobs]);

  useEffect(() => {
    const handler = () => loadJobs();
    window.addEventListener('jobpilot:refresh', handler);
    return () => window.removeEventListener('jobpilot:refresh', handler);
  }, [loadJobs]);

  const fetchJobs = async () => {
    setFetching(true);
    try {
      const result = await api.jobs.fetch({
        title: filters.title,
        keywords: filters.keywords || undefined,
        location: filters.location || undefined,
        experienceLevel: filters.experienceLevel || undefined,
        jobType: filters.jobType || undefined,
        datePosted: filters.datePosted || undefined,
        platforms: filters.platforms,
        includeFeedPosts: filters.includeFeedPosts,
      });
      toast.success(
        `${result.added} new jobs added (${result.total} fetched${result.expandedKeywords ? `, searched ${result.expandedKeywords.length} related terms` : ''})`
      );
      if (result.errors?.length) {
        result.errors.forEach((e) => toast.error(e));
      }
      await loadJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setFetching(false);
    }
  };

  const applyOne = async (job: Job) => {
    toast.loading(`Applying to ${job.title}...`, { id: job.id });
    try {
      const r = await api.apply.single(job.id);
      toast.dismiss(job.id);
      if (r.status === 'success') toast.success(r.message);
      else if (r.status === 'manual') toast(r.message, { icon: '⚠️' });
      else toast.error(r.message);
      loadJobs();
    } catch (e) {
      toast.dismiss(job.id);
      toast.error(e instanceof Error ? e.message : 'Apply failed');
    }
  };

  const applyAll = async () => {
    try {
      const { batchId: id, count } = await api.apply.batch(jobs.map((j) => j.id));
      setBatchId(id);
      toast.success(`Batch apply started (${count} jobs)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Batch failed');
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search bar */}
        <div className="p-5 space-y-3">
          <div className="flex gap-2.5">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jp-text-muted" />
              <input
                className="input pl-9"
                placeholder="Search jobs, companies, skills..."
                value={filters.title}
                onChange={(e) => updateFilters({ ...filters, title: e.target.value })}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-jp-sm text-sm font-medium border transition-all ${
                showFilters
                  ? 'border-jp-accent text-jp-accent bg-jp-accent-glow'
                  : 'border-jp-border text-jp-text-secondary hover:border-jp-text-muted hover:text-jp-text'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>
            {['linkedin', 'naukri'].map((p) => (
              <button
                key={p}
                onClick={() =>
                  updateFilters({
                    ...filters,
                    platform: filters.platform === p ? '' : p,
                  })
                }
                className={`px-4 py-2 rounded-jp-sm text-sm font-medium border transition-all ${
                  filters.platform === p
                    ? 'border-jp-accent text-jp-accent bg-jp-accent-glow'
                    : 'border-jp-border text-jp-text-secondary hover:border-jp-text-muted hover:text-jp-text'
                }`}
              >
                {p === 'linkedin' ? 'LinkedIn' : 'Naukri'}
              </button>
            ))}
            <button
              onClick={() =>
                updateFilters({ ...filters, minScore: filters.minScore ? '' : '70' })
              }
              className={`flex items-center gap-1.5 px-4 py-2 rounded-jp-sm text-sm font-medium border transition-all ${
                filters.minScore
                  ? 'border-jp-accent text-jp-accent bg-jp-accent-glow'
                  : 'border-jp-border text-jp-text-secondary hover:border-jp-text-muted hover:text-jp-text'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Score 70%+
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2.5 items-end p-4 bg-jp-surface rounded-jp border border-jp-border-subtle">
              <div className="w-40">
                <label className="text-xs text-jp-text-muted block mb-1">Location</label>
                <input
                  className="input"
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                />
              </div>
              <div className="w-36">
                <label className="text-xs text-jp-text-muted block mb-1">Keywords</label>
                <input
                  className="input"
                  value={filters.keywords}
                  onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
                />
              </div>
              <div className="w-28">
                <label className="text-xs text-jp-text-muted block mb-1">Job type</label>
                <select
                  className="input"
                  value={filters.jobType}
                  onChange={(e) => setFilters({ ...filters, jobType: e.target.value })}
                >
                  <option value="">Any</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </div>
              <div className="w-36">
                <label className="text-xs text-jp-text-muted block mb-1">Experience</label>
                <select
                  className="input"
                  value={filters.experienceLevel}
                  onChange={(e) => setFilters({ ...filters, experienceLevel: e.target.value })}
                >
                  <option value="">Any</option>
                  <option value="fresher">Fresher (0-1 yrs)</option>
                  <option value="junior">Junior (1-3 yrs)</option>
                  <option value="mid">Mid-Level (3-5 yrs)</option>
                  <option value="senior">Senior (5-8 yrs)</option>
                  <option value="lead">Lead (8-12 yrs)</option>
                  <option value="expert">Expert (12+ yrs)</option>
                </select>
              </div>
              <div className="w-28">
                <label className="text-xs text-jp-text-muted block mb-1">Posted</label>
                <select
                  className="input"
                  value={filters.datePosted}
                  onChange={(e) => setFilters({ ...filters, datePosted: e.target.value })}
                >
                  <option value="24h">24 hours</option>
                  <option value="week">This week</option>
                  <option value="month">This month</option>
                </select>
              </div>
              <div className="w-32">
                <label className="text-xs text-jp-text-muted block mb-1">Sort by</label>
                <select
                  className="input"
                  value={filters.sort}
                  onChange={(e) => updateFilters({ ...filters, sort: e.target.value })}
                >
                  <option value="matchScore">Match score</option>
                  <option value="createdAt">Date fetched</option>
                  <option value="postedDate">Posted date</option>
                  <option value="title">Title</option>
                </select>
              </div>
              <div className="w-32">
                <label className="text-xs text-jp-text-muted block mb-1">Apply type</label>
                <select
                  className="input"
                  value={filters.applyType}
                  onChange={(e) => updateFilters({ ...filters, applyType: e.target.value })}
                >
                  <option value="">Any</option>
                  <option value="easy_apply">Easy Apply</option>
                  <option value="external">External</option>
                </select>
              </div>
              <label className="flex items-center gap-1.5 text-sm text-jp-text-secondary">
                <input
                  type="checkbox"
                  checked={filters.includeFeedPosts}
                  onChange={(e) => setFilters({ ...filters, includeFeedPosts: e.target.checked })}
                  className="accent-jp-accent"
                />
                Feed posts
              </label>
              {(['linkedin', 'naukri'] as const).map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-sm text-jp-text-secondary">
                  <input
                    type="checkbox"
                    checked={filters.platforms.includes(p)}
                    onChange={(e) => {
                      const platforms = e.target.checked
                        ? [...filters.platforms, p]
                        : filters.platforms.filter((x) => x !== p);
                      setFilters({ ...filters, platforms });
                    }}
                    className="accent-jp-accent"
                  />
                  {p === 'linkedin' ? 'LinkedIn' : 'Naukri'}
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center">
            <p className="text-xs text-jp-text-muted font-mono">
              R = refresh · ESC = close panel
            </p>
            <div className="flex gap-2">
              <button onClick={fetchJobs} disabled={fetching} className="btn-primary flex items-center gap-2">
                {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Fetch Jobs
              </button>
              <button onClick={applyAll} className="btn-secondary flex items-center gap-2">
                <Send className="w-4 h-4" />
                Apply All
              </button>
            </div>
          </div>
        </div>

        {/* Job list */}
        <div className="flex-1 overflow-auto px-5 pb-5">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-jp-surface rounded-jp animate-pulse" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-20 text-jp-text-muted">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No jobs yet. Configure credentials in Settings, then Fetch Jobs.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  selected={selected?.id === job.id}
                  onSelect={() => setSelected(job)}
                  onBookmark={async () => {
                    await api.jobs.bookmark(job.id);
                    loadJobs();
                  }}
                  onApply={() => applyOne(job)}
                  onStatusChange={async (status) => {
                    await api.jobs.update(job.id, { status });
                    loadJobs();
                  }}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <span className="text-sm text-jp-text-muted self-center font-mono">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <JobDetailPanel job={selected} onClose={() => setSelected(null)} />
      {batchId && <ApplyProgressModal batchId={batchId} onClose={() => setBatchId(null)} />}
    </div>
  );
}
