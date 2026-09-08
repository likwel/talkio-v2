import { useEffect, useRef, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { useRouteLoading } from '@/lib/progress';

/** Fallback des <Suspense> de route : signale un chunk en cours de chargement. */
export function RouteFallback() {
  const begin = useRouteLoading((s) => s.begin);
  const end = useRouteLoading((s) => s.end);
  useEffect(() => {
    begin();
    return end;
  }, [begin, end]);
  return <div className="min-h-[40vh]" />;
}

/**
 * Barre de progression fine en haut de l'ecran (degrade), pilotee par :
 * - le chargement des chunks de route (`useRouteLoading`)
 * - les requetes React Query en cours (`useIsFetching`)
 */
export default function TopProgress() {
  const fetching = useIsFetching();
  const routePending = useRouteLoading((s) => s.pending);
  const loading = fetching > 0 || routePending > 0;

  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<number>();
  const startDelay = useRef<number>();

  useEffect(() => {
    window.clearTimeout(timer.current);
    window.clearTimeout(startDelay.current);

    if (loading) {
      // Ne montre la barre que si le chargement dure : evite le clignotement
      // sur les rafraichissements de fond (poll toutes les 20 s).
      startDelay.current = window.setTimeout(() => {
        setVisible(true);
        setWidth((w) => (w < 10 ? 12 : w));
        const trickle = () => {
          setWidth((w) => (w < 92 ? w + Math.max(0.4, (94 - w) * 0.07) : w));
          timer.current = window.setTimeout(trickle, 220);
        };
        trickle();
      }, 180);
    } else if (visible) {
      setWidth(100);
      timer.current = window.setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 320);
    }

    return () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(startDelay.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className="h-full rounded-r-full transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${width}%`,
          opacity: visible ? 1 : 0,
          background:
            'linear-gradient(90deg, var(--accent) 0%, #8774e1 50%, var(--accent) 100%)',
          boxShadow: '0 0 10px 1px var(--accent-ring)',
        }}
      />
    </div>
  );
}
