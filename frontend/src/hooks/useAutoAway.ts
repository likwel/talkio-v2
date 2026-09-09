import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const IDLE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Bascule automatiquement le statut de présence en « Absent » après
 * {@link IDLE_MS} d'inactivité (souris / clavier / onglet caché), puis le
 * remet « En ligne » dès le retour d'activité — uniquement si c'est ce
 * mécanisme qui avait déclenché le passage (on ne touche jamais à un statut
 * choisi manuellement : Occupé, Invisible, ou Absent manuel).
 */
export function useAutoAway() {
  const { user, setStatus } = useAuth();
  const authed = !!user;

  const statusRef = useRef(user?.presenceStatus);
  statusRef.current = user?.presenceStatus;
  const setStatusRef = useRef(setStatus);
  setStatusRef.current = setStatus;

  const autoAwayRef = useRef(false);

  useEffect(() => {
    if (!authed) return;
    let timer: number | undefined;

    const goAway = () => {
      if (statusRef.current === 'ONLINE') {
        autoAwayRef.current = true;
        setStatusRef.current('AWAY').catch(() => undefined);
      }
    };
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(goAway, IDLE_MS);
    };
    const onActivity = () => {
      if (autoAwayRef.current && statusRef.current === 'AWAY') {
        autoAwayRef.current = false;
        setStatusRef.current('ONLINE').catch(() => undefined);
      }
      arm();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onActivity();
      else arm();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onActivity);
    arm();

    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onActivity);
    };
  }, [authed]);
}
