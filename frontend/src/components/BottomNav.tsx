import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NAV_ITEMS } from '@/lib/nav';

/** Barre de navigation fixe en bas, visible sur mobile / tablette (< lg). */
export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ to, label, end, Icon }) => (
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
              <Icon className="h-6 w-6 shrink-0" />
              <span className={clsx('truncate', isActive && 'font-semibold')}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
