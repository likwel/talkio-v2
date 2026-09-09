import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import { IconClose, IconPrev, IconNext, IconDownload } from '@/lib/icons';

export interface ViewerImage {
  url: string;
  name?: string;
}

interface ImageViewerApi {
  /** Ouvre la visionneuse sur `images`, positionnée sur `index`. */
  open: (images: ViewerImage[], index?: number) => void;
}

const Ctx = createContext<ImageViewerApi | undefined>(undefined);

export function ImageViewerProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<ViewerImage[] | null>(null);
  const [idx, setIdx] = useState(0);

  const open = useCallback((imgs: ViewerImage[], index = 0) => {
    if (!imgs.length) return;
    setImages(imgs);
    setIdx(Math.max(0, Math.min(index, imgs.length - 1)));
  }, []);
  const close = useCallback(() => setImages(null), []);
  const go = useCallback(
    (dir: 1 | -1) => setIdx((i) => (images ? (i + dir + images.length) % images.length : 0)),
    [images],
  );

  useEffect(() => {
    if (!images) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [images, close, go]);

  const cur = images?.[idx];
  const multi = (images?.length ?? 0) > 1;

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {images && cur && (
        <div
          className="fixed inset-0 z-[120] flex flex-col bg-black/90 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          {/* Barre supérieure */}
          <div className="flex items-center gap-2 px-3 py-2.5 text-white sm:px-5">
            <span className="min-w-0 flex-1 truncate text-sm text-white/80">{cur.name}</span>
            {multi && (
              <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium">
                {idx + 1} / {images.length}
              </span>
            )}
            <a
              href={cur.url}
              download={cur.name}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
              title="Télécharger"
            >
              <IconDownload className="h-5 w-5" />
            </a>
            <button
              onClick={close}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Fermer"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>

          {/* Image */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-3 sm:px-6"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            {multi && (
              <>
                <button
                  onClick={() => go(-1)}
                  className="absolute left-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white transition hover:bg-black/60 sm:left-3"
                  aria-label="Précédent"
                >
                  <IconPrev className="h-6 w-6" />
                </button>
                <button
                  onClick={() => go(1)}
                  className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white transition hover:bg-black/60 sm:right-3"
                  aria-label="Suivant"
                >
                  <IconNext className="h-6 w-6" />
                </button>
              </>
            )}
            <img
              key={cur.url}
              src={cur.url}
              alt={cur.name ?? ''}
              className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
              draggable={false}
            />
          </div>

          {/* Miniatures */}
          {multi && (
            <div className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 pb-4">
              {images.map((im, i) => (
                <button
                  key={im.url + i}
                  onClick={() => setIdx(i)}
                  className={clsx(
                    'h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition',
                    i === idx ? 'border-white' : 'border-transparent opacity-50 hover:opacity-90',
                  )}
                >
                  <img src={im.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useImageViewer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useImageViewer doit être utilisé dans un ImageViewerProvider');
  return ctx;
}
