import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../api/client';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<
    { id: string; title: string; message: string; type: string; read: boolean }[]
  >([]);

  const load = () => api.dashboard.notifications().then(setItems).catch(() => {});

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-jp-text-secondary hover:bg-jp-surface-2 hover:text-jp-text transition-all"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-[7px] h-[7px] bg-jp-rose rounded-full ring-2 ring-jp-bg" />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-auto bg-jp-surface border border-jp-border-subtle rounded-jp p-4 z-50 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-sm">Notifications</span>
              <button
                className="text-xs text-jp-accent hover:text-jp-accent-dim transition-colors"
                onClick={() => api.dashboard.readAll().then(load).catch(() => {})}
              >
                Mark all read
              </button>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-jp-text-muted py-4 text-center">No notifications</p>
            ) : (
              items.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`py-2.5 border-b border-jp-border-subtle last:border-0 cursor-pointer hover:bg-jp-surface-2 -mx-1 px-1 rounded transition-colors ${!n.read ? 'opacity-100' : 'opacity-50'}`}
                  onClick={() => api.dashboard.markRead(n.id).then(load)}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-jp-text-muted mt-0.5">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
