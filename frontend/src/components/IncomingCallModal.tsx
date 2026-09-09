import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import Avatar from '@/components/Avatar';
import { IconCall, IconVideo, IconCallEnd } from '@/lib/icons';

interface Ring {
  callId: string;
  roomId: string;
  type: 'AUDIO' | 'VIDEO';
  channelId: string;
  channelName: string | null;
  from: { id: string; fullName: string; avatarUrl?: string | null };
}

/** Sonnerie d'appel entrant, globale (modale Accepter / Refuser / Ignorer). */
export default function IncomingCallModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ring, setRing] = useState<Ring | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onRing = (r: Ring) => {
      if (window.location.pathname.startsWith('/call/')) return; // deja dans une salle
      setRing(r);
      try {
        (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.([
          300, 150, 300,
        ]);
      } catch {
        /* ignore */
      }
    };
    const onDeclined = (p: { roomId: string }) =>
      setRing((cur) => (cur && cur.roomId === p.roomId ? null : cur));
    const onActiveChanged = () => {
      // Un appel a change d'etat : on verifie qu'il est toujours actif.
      setRing((cur) => cur);
    };
    socket.on('call:ring', onRing);
    socket.on('call:declined', onDeclined);
    socket.on('calls:active-changed', onActiveChanged);
    return () => {
      socket.off('call:ring', onRing);
      socket.off('call:declined', onDeclined);
      socket.off('calls:active-changed', onActiveChanged);
    };
  }, []);

  useEffect(() => {
    if (!ring) return;
    const t = window.setTimeout(() => setRing(null), 40_000);
    return () => window.clearTimeout(t);
  }, [ring]);

  useEffect(() => {
    if (location.pathname.startsWith('/call/')) setRing(null);
  }, [location.pathname]);

  if (!ring) return null;
  const isVideo = ring.type === 'VIDEO';

  const accept = () => {
    navigate(`/call/${ring.roomId}`);
    setRing(null);
  };
  const decline = () => {
    api.post(`/calls/${ring.roomId}/decline`).catch(() => undefined);
    setRing(null);
  };

  return createPortal(
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-xs rounded-2xl border border-[var(--outline)] bg-[var(--surface)] p-5 text-center shadow-elevation-3">
        <span className="relative mx-auto block h-16 w-16">
          <Avatar id={ring.from.id} name={ring.from.fullName} src={ring.from.avatarUrl} size={64} />
          <span className="absolute inset-0 animate-ping rounded-full border-2 border-[var(--accent)] opacity-60" />
        </span>
        <div className="mt-3 font-display text-lg font-bold">{ring.from.fullName}</div>
        <div className="text-sm text-[var(--text-dim)]">
          {isVideo ? 'Visio entrante' : 'Appel entrant'}
          {ring.channelName ? ` · #${ring.channelName}` : ''}
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={decline}
            className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
            title="Refuser"
          >
            <IconCallEnd className="h-6 w-6" />
          </button>
          <button
            onClick={accept}
            className="flex h-12 items-center gap-2 rounded-full bg-green-600 px-5 text-sm font-semibold text-white transition hover:bg-green-700"
            title="Accepter"
          >
            {isVideo ? <IconVideo className="h-5 w-5" /> : <IconCall className="h-5 w-5" />} Accepter
          </button>
        </div>
        <button
          onClick={() => setRing(null)}
          className="mt-3 text-2xs text-[var(--text-dim)] transition hover:text-[var(--text)]"
        >
          Ignorer
        </button>
      </div>
    </div>,
    document.body,
  );
}
