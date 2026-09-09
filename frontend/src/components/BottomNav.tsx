import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NAV_ITEMS } from '@/lib/nav';
import { useT } from '@/i18n';

/** Barre de navigation fixe en bas, visible sur mobile / tablette (< lg). */
export default function BottomNav() {
  const t = useT();
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ to, labelKey, end, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            clsx('bottom-nav-item', isActive && 'text-[var(--accent)]')
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={clsx('h-6 w-6 shrink-0', isActive ? 'icon-3d-strong' : 'icon-3d')}
              />
              <span className={clsx('truncate', isActive && 'font-semibold')}>{t(labelKey)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
