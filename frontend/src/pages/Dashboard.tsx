import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../api/client';
import type { DashboardStats } from '../types';

function MiniChart({ data, color }: { data: number[]; color: string }) {
  return (
    <div className="flex items-end gap-[3px] h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className="w-[6px] rounded-sm transition-all"
          style={{ height: `${v}%`, background: color }}
        />
      ))}
    </div>
  );
}

function PipelineRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-jp-border-subtle last:border-0">
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="flex-1 text-sm text-jp-text-secondary">{label}</span>
      <div className="flex-1 h-1 bg-jp-surface-3 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono font-semibold text-sm w-10 text-right">{count}</span>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<{ type: string; message: string; createdAt: string }[]>(
    []
  );
  const [gaps, setGaps] = useState<{ skill: string; frequency: number; priority?: string }[]>([]);
  const [timeRange, setTimeRange] = useState('7d');
  const [aiEnabled, setAiEnabled] = useState(true);

  useEffect(() => {
    api.dashboard.stats(timeRange).then(setStats).catch(() => {});
    api.dashboard.activity().then(setActivity).catch(() => {});
    api.dashboard.skillGaps().then((r) => setGaps(r.gaps)).catch(() => {});
    api.ai.status().then((s) => setAiEnabled(s.aiEnabled)).catch(() => {});
  }, [timeRange]);

  const dailyData = stats
    ? Object.entries(stats.dailyApplications).map(([date, count]) => ({
        date: date.slice(5),
        count,
      }))
    : [];

  const totalJobs = stats?.total ?? 0;

  const activityIcons: Record<string, { icon: string; bg: string; fg: string }> = {
    apply: { icon: '✓', bg: 'bg-jp-accent/10', fg: 'text-jp-accent' },
    resume: { icon: '★', bg: 'bg-jp-cyan/10', fg: 'text-jp-cyan' },
    fetch: { icon: '⚡', bg: 'bg-jp-orange/10', fg: 'text-jp-orange' },
    error: { icon: '✗', bg: 'bg-jp-rose/10', fg: 'text-jp-rose' },
  };

  const priorityStyles: Record<string, { bg: string; fg: string }> = {
    high: { bg: 'bg-jp-rose/10', fg: 'text-jp-rose' },
    medium: { bg: 'bg-jp-orange/10', fg: 'text-jp-orange' },
    low: { bg: 'bg-jp-surface-3', fg: 'text-jp-text-muted' },
  };

  const skillBarColors: Record<string, string> = {
    high: '#f0426e',
    medium: '#ff8a3d',
    low: '#555555',
  };

  return (
    <div className="p-7 max-w-[1440px] mx-auto space-y-7">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-jp-text-muted mt-1">
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-0.5 bg-jp-surface rounded-jp-sm p-[3px] border border-jp-border-subtle">
          {['24h', '7d', '30d', 'All'].map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                timeRange === r
                  ? 'bg-jp-surface-3 text-jp-text'
                  : 'text-jp-text-secondary hover:text-jp-text'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Hero stat */}
        <div className="col-span-3 card relative overflow-hidden bg-gradient-to-br from-jp-surface to-jp-accent-glow border-jp-accent/[0.12] hover:border-jp-accent/25">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[radial-gradient(circle,rgba(196,240,66,0.15),transparent_70%)] pointer-events-none" />
          <p className="section-title">Total Jobs Tracked</p>
          <p className="text-5xl font-bold font-mono tracking-tighter text-jp-accent mt-2 leading-none">
            {stats?.total ?? 0}
          </p>
          <div className="mt-3.5 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold font-mono bg-jp-accent/10 text-jp-accent">
            +{stats?.addedThisWeek ?? 0} this week
          </div>
        </div>

        {/* Small stats */}
        <div className="col-span-3 card">
          <p className="section-title">Applied</p>
          <div className="flex justify-between items-end mt-2">
            <p className="text-3xl font-bold font-mono tracking-tight">{stats?.applied ?? 0}</p>
            <MiniChart data={stats?.dailyApplied ?? [0, 0, 0, 0, 0, 0, 0]} color="#c4f042" />
          </div>
        </div>

        <div className="col-span-3 card">
          <p className="section-title">Interviews</p>
          <div className="flex justify-between items-end mt-2">
            <p className="text-3xl font-bold font-mono tracking-tight text-jp-cyan">
              {stats?.interview ?? 0}
            </p>
            <MiniChart data={stats?.dailyInterviews ?? [0, 0, 0, 0, 0, 0, 0]} color="#42d4f0" />
          </div>
        </div>

        <div className="col-span-3 card">
          <p className="section-title">Avg Match Score</p>
          <div className="flex justify-between items-end mt-2">
            <p className="text-3xl font-bold font-mono tracking-tight text-jp-orange">
              {stats?.avgMatchScore != null ? (
                <>{stats.avgMatchScore}<span className="text-base text-jp-text-muted">%</span></>
              ) : (
                <span className="text-base text-jp-text-muted">N/A</span>
              )}
            </p>
          </div>
        </div>

        {/* Activity chart */}
        <div className="col-span-8 card min-h-[280px]">
          <div className="flex justify-between items-center mb-5">
            <p className="section-title">Application Activity</p>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-jp-accent" />
                <span className="text-jp-text-muted">Applied</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-jp-cyan" />
                <span className="text-jp-text-muted">Interviews</span>
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} barGap={4}>
              <XAxis
                dataKey="date"
                tick={{ fill: '#555', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#555', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: '#161616',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontFamily: 'Space Grotesk',
                }}
                cursor={{ fill: 'rgba(196,240,66,0.04)' }}
              />
              <Bar dataKey="count" fill="#c4f042" radius={[6, 6, 2, 2]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline */}
        <div className="col-span-4 card">
          <p className="section-title mb-4">Pipeline</p>
          <PipelineRow
            label="Not Applied"
            count={totalJobs - (stats?.applied ?? 0) - (stats?.reviewing ?? 0) - (stats?.interview ?? 0) - (stats?.rejected ?? 0)}
            total={totalJobs}
            color="#555"
          />
          <PipelineRow
            label="Reviewing"
            count={stats?.reviewing ?? 0}
            total={totalJobs}
            color="#ff8a3d"
          />
          <PipelineRow
            label="Applied"
            count={stats?.applied ?? 0}
            total={totalJobs}
            color="#c4f042"
          />
          <PipelineRow
            label="Interview"
            count={stats?.interview ?? 0}
            total={totalJobs}
            color="#42d4f0"
          />
          <PipelineRow
            label="Rejected"
            count={stats?.rejected ?? 0}
            total={totalJobs}
            color="#f0426e"
          />
        </div>

        {/* Recent Activity */}
        <div className="col-span-5 card relative">
          <p className="section-title mb-3">Recent Activity</p>
          <div className="space-y-0">
            {activity.length === 0 ? (
              <p className="text-sm text-jp-text-muted py-4">No activity yet</p>
            ) : (
              activity.slice(0, 5).map((a, i) => {
                const style = activityIcons[a.type] ?? activityIcons.fetch;
                const timeAgo = getTimeAgo(a.createdAt);
                return (
                  <div
                    key={i}
                    className="flex gap-3 py-2.5 border-b border-jp-border-subtle last:border-0"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm ${style.bg} ${style.fg}`}
                    >
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.message}</p>
                      <p className="text-xs text-jp-text-muted mt-0.5">{a.type}</p>
                    </div>
                    <span className="text-xs text-jp-text-muted font-mono whitespace-nowrap self-start mt-0.5">
                      {timeAgo}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-jp-surface to-transparent pointer-events-none rounded-b-jp" />
        </div>

        {/* Skill Gaps */}
        <div className="col-span-7 card">
          <p className="section-title mb-4">Skill Gaps</p>
          {gaps.length === 0 ? (
            <p className="text-sm text-jp-text-muted">
              {aiEnabled
                ? 'Upload a base resume and fetch jobs to see skill gap analysis'
                : 'Enable AI in Settings for skill gap analysis'}
            </p>
          ) : (
            <div className="space-y-2.5">
              {gaps.slice(0, 6).map((g) => {
                const priority = (g.priority ?? 'medium').toLowerCase();
                const pStyle = priorityStyles[priority] ?? priorityStyles.medium;
                const barColor = skillBarColors[priority] ?? '#ff8a3d';
                const maxFreq = Math.max(...gaps.map((x) => x.frequency), 1);
                const pct = (g.frequency / maxFreq) * 100;
                return (
                  <div key={g.skill} className="flex items-center gap-3.5">
                    <span className="w-36 text-sm font-medium flex-shrink-0 truncate">
                      {g.skill}
                    </span>
                    <div className="flex-1 h-1.5 bg-jp-surface-3 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: barColor }}
                      />
                    </div>
                    <span className="text-xs font-mono text-jp-text-muted w-20 text-right">
                      {g.frequency} jobs
                    </span>
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded w-14 text-center ${pStyle.bg} ${pStyle.fg}`}
                    >
                      {priority}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
