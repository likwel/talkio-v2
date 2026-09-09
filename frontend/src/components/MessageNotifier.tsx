import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/context/ToastContext';

interface Notify {
  channelId: string;
  workspaceId: string;
  isDirect: boolean;
  from: { id: string; fullName: string };
  preview: string;
  /** L'utilisateur courant a été mentionné (@) dans ce message. */
  mention?: boolean;
}

// --- Son de message (WebAudio, sans asset) --------------------------------
let audioCtx: AudioContext | null = null;
function playPing() {
  try {
    if (localStorage.getItem('talkio.mute') === '1') return;
  } catch {
    /* ignore */
  }
  try {
    audioCtx = audioCtx ?? new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const t = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    [880, 1244].forEach((f, i) => {
      const osc = audioCtx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + i * 0.09);
      osc.connect(gain);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.32);
    });
  } catch {
    /* audio indisponible */
  }
}

/**
 * Ecoute globale des nouveaux messages (`message:notify`, room `user:<id>`).
 * Rafraichit les compteurs de non lus en temps reel + joue un son.
 */
export default function MessageNotifier() {
  const qc = useQueryClient();
  const { refreshList } = useWorkspace();
  const { toast } = useToast();
  const location = useLocation();

  useEffect(() => {
    const socket = getSocket();
    const onNotify = (n: Notify) => {
      // Compteurs (bulle flottante, liste des conversations, badges d'espace)
      qc.invalidateQueries({ queryKey: ['channels'] });
      refreshList();

      // Son : sauf si on est deja actif dans la messagerie sur ce canal
      const inThisChannel =
        document.hasFocus() &&
        (location.pathname === `/chat/${n.channelId}` ||
          (location.pathname === '/' && !n.isDirect));
      if (!inThisChannel) playPing();

      // Mention explicite : le mentionné reçoit une notification visible.
      if (n.mention && !inThisChannel) {
        toast(`${n.from.fullName} vous a mentionné`, 'info');
      }
    };
    socket.on('message:notify', onNotify);
    return () => {
      socket.off('message:notify', onNotify);
    };
  }, [qc, refreshList, toast, location.pathname]);

  return null;
}
