import { useEffect, useState } from 'react';
import { X, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import type { ApplyProgress } from '../types';

interface Props {
  batchId: string;
  onClose: () => void;
}

const icons = {
  pending: Clock,
  running: Clock,
  done: CheckCircle,
  failed: XCircle,
  skipped: AlertTriangle,
  manual: AlertTriangle,
};

const statusColors = {
  done: 'text-jp-accent',
  failed: 'text-jp-rose',
  skipped: 'text-jp-orange',
  manual: 'text-jp-orange',
  pending: 'text-jp-text-muted',
  running: 'text-jp-cyan',
};

export default function ApplyProgressModal({ batchId, onClose }: Props) {
  const [items, setItems] = useState<ApplyProgress[]>([]);

  useEffect(() => {
    const poll = () => api.apply.progress(batchId).then(setItems);
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [batchId]);

  const done = items.filter((i) => ['done', 'failed', 'skipped', 'manual'].includes(i.status)).length;
  const complete = items.length > 0 && done === items.length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-jp-surface border border-jp-border-subtle rounded-jp w-full max-w-lg max-h-[80vh] flex flex-col p-5 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">Batch Apply Progress</h2>
          <button onClick={onClose} className="p-1 hover:bg-jp-surface-2 rounded-lg transition-colors">
            <X className="w-5 h-5 text-jp-text-secondary" />
          </button>
        </div>
        <div className="flex-1 overflow-auto space-y-2">
          {items.map((item) => {
            const Icon = icons[item.status] ?? Clock;
            const color = statusColors[item.status] ?? statusColors.pending;
            return (
              <div
                key={item.jobId}
                className="flex items-center gap-3 p-3 rounded-jp-sm bg-jp-bg text-sm"
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                <span className="flex-1 truncate">{item.title}</span>
                <span className="text-xs text-jp-text-muted capitalize font-mono">{item.status}</span>
              </div>
            );
          })}
        </div>
        {complete && (
          <p className="text-sm text-jp-accent mt-4 text-center font-medium">
            Batch complete — {items.filter((i) => i.status === 'done').length} applied,{' '}
            {items.filter((i) => i.status === 'failed').length} failed
          </p>
        )}
      </div>
    </div>
  );
}
