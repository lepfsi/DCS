'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [err, setErr] = useState('');
  function load() {
    api('/notifications').then((r) => { setNotifs(r.data); setUnread(r.unreadCount); }).catch((e) => setErr(e.message));
  }
  useEffect(() => { load(); }, []);
  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: 'POST' });
    load();
  }
  return (
    <div>
      <h1>Notifications ({unread} non lues)</h1>
      {err && <p style={{ background: '#fff3f3', padding: 12 }}>Erreur : {err}</p>}
      {notifs.map((n) => (
        <div key={n.id} style={{ background: n.read ? '#f0f0f0' : '#fff', padding: 12, marginBottom: 8 }}>
          <strong>{n.kind}</strong> · {n.message} <em>({n.createdAt.slice(0, 16)})</em>{' '}
          {!n.read && <button onClick={() => markRead(n.id)}>Marquer lue</button>}
        </div>
      ))}
      {notifs.length === 0 && !err && <p>Aucune notification.</p>}
    </div>
  );
}
