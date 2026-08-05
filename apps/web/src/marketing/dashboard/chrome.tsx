import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn, formatPhone, humanizeEnum } from '@/lib/utils';
import { LogoMark } from '@/components/Brand';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ICON_SIZE, type IconComponent } from '@/components/ui/icon';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/button';
import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  Bars3Icon,
  BellIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  HomeIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  Squares2X2Icon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { COMPANY, appointments, articles, calls, customers } from './data';

/**
 * The authenticated application's chrome, rebuilt for the marketing page.
 *
 * Everything here is a replica of `layouts/AppLayout` and the shared primitives
 * it composes — the same 256px sidebar, the same 64px header, the same
 * collapsed search pill, the same tab bar below `lg`. It is a replica rather
 * than the layout itself because the real one is wired to the router, to Clerk
 * and to React Query: rendering it on a public page would mean a signed-out
 * visitor's clicks navigating the site away from the marketing page.
 *
 * What is *not* replicated is the styling. Colour, type, radius, borders and
 * elevation all come from the product tokens by way of the same utilities the
 * application uses (`bg-surface`, `text-ink`, `border-line-subtle`,
 * `shadow-card`), so this preview re-themes with the product and cannot drift
 * from it by hand.
 */

export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: Squares2X2Icon },
  { id: 'calls', label: 'Calls', icon: PhoneIcon },
  { id: 'customers', label: 'Customers', icon: UsersIcon },
  { id: 'appointments', label: 'Appointments', icon: CalendarDaysIcon },
  { id: 'knowledge', label: 'Knowledge Base', icon: BookOpenIcon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
] as const;

export type ViewId = (typeof NAV)[number]['id'];

/** The handheld tab bar's four destinations, mirroring `BOTTOM_NAV`. */
const TABS: Array<{ id: ViewId; label: string; icon: IconComponent }> = [
  { id: 'dashboard', label: 'Home', icon: HomeIcon },
  { id: 'calls', label: 'Calls', icon: PhoneIcon },
  { id: 'appointments', label: 'Appointments', icon: CalendarDaysIcon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
];

/* ── Panels ──────────────────────────────────────────────────────────────── */

/**
 * The titled dashboard panel, matching `features/dashboard/components/
 * SectionCard`: the shared `Card` surface, a 24px header, and an optional
 * action in the top right.
 *
 * The action is a button rather than the product's router `Link` — it is a
 * preview, so it moves between preview views instead of navigating the site.
 */
export function PanelCard({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  action?: { label: string; onSelect: () => void };
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card
      as="section"
      aria-label={title}
      className={cn(
        'overflow-hidden',
        // The product reserves the hover lift for cards that are themselves a
        // link (`.card-interactive`). Here every panel is part of one live
        // preview, so they all answer the pointer — with the product's own
        // `--elevation-card-hover`, not a shadow invented for the marketing page.
        'transition-shadow duration-base ease-standard hover:shadow-card-hover',
        className,
      )}
    >
      <CardHeader className="items-center">
        <CardTitle as="h3">{title}</CardTitle>
        {action && (
          <button
            type="button"
            onClick={action.onSelect}
            className="focus-ring group inline-flex shrink-0 items-center gap-1 rounded-focus text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
          >
            {action.label}
            <ArrowRightIcon
              className="h-4 w-4 transition-transform duration-fast ease-standard group-hover:translate-x-0.5 motion-reduce:transform-none"
              aria-hidden
            />
          </button>
        )}
      </CardHeader>
      <div className={cn('flex-1', bodyClassName)}>{children}</div>
    </Card>
  );
}

/**
 * The heading block every authenticated page opens with, matching
 * `components/ui/PageHeader`.
 *
 * The title is an `h3` here rather than the product's `h1`: on the marketing
 * page the hero owns the document's only `h1`, and a preview must not claim it.
 * Only the tag changed — the sizes are `PageHeader`'s own two committed steps,
 * so the greeting is the same 26/32px it is after signing in.
 */
export function PreviewPageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="text-h3 text-ink sm:text-h2">{title}</h3>
        <p className="mt-1 text-body text-ink-muted sm:text-body-lg">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Navigation ──────────────────────────────────────────────────────────── */

/**
 * A sidebar row. Shared by the desktop rail and the handheld drawer so the two
 * cannot drift — the active fill, the hover fill and the unread badge are
 * declared once.
 */
function NavRow({
  item,
  active,
  unreadCount,
  onSelect,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  unreadCount: number;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'focus-ring flex h-[52px] w-full items-center gap-3 rounded-full px-3.5 text-left text-body font-medium',
          'transition-colors duration-fast ease-standard',
          active
            ? 'bg-accent-subtle text-accent'
            : 'text-ink-muted hover:bg-surface-3 hover:text-ink',
        )}
      >
        <item.icon className={cn(ICON_SIZE.nav, 'shrink-0')} aria-hidden />
        <span className="flex-1 truncate">{item.label}</span>
        {item.id === 'notifications' && unreadCount > 0 && (
          <span className="font-num ml-auto rounded-full bg-accent px-2 py-0.5 text-caption font-semibold text-ink-on-brand">
            {unreadCount}
          </span>
        )}
      </button>
    </li>
  );
}

function NavList({
  view,
  unreadCount,
  onNavigate,
  className,
}: {
  view: ViewId;
  unreadCount: number;
  onNavigate: (id: ViewId) => void;
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col gap-1.5', className)}>
      {NAV.map((item) => (
        <NavRow
          key={item.id}
          item={item}
          active={item.id === view}
          unreadCount={unreadCount}
          onSelect={() => onNavigate(item.id)}
        />
      ))}
    </ul>
  );
}

/** The sidebar's identity block: mark, product name, company. */
function SidebarBrand() {
  return (
    <div className="flex h-16 shrink-0 flex-row items-center gap-2.5 px-5">
      <LogoMark className="h-[13px] text-brand-950" />
      <div className="min-w-0">
        <p className="truncate text-body font-semibold tracking-[-0.02em] text-ink">rooferslabs</p>
        <p className="truncate text-caption text-ink-faint">{COMPANY.name}</p>
      </div>
    </div>
  );
}

/* ── Search ──────────────────────────────────────────────────────────────── */

type SearchHit = {
  id: string;
  group: string;
  icon: IconComponent;
  title: string;
  subtitle: string;
};

/** The same four entity groups the product's global search returns. */
function searchFixtures(query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const has = (...parts: string[]) => parts.join(' ').toLowerCase().includes(needle);

  return [
    ...customers
      .filter((c) => has(c.name, c.phone, c.email, c.address))
      .map((c) => ({
        id: `customer-${c.id}`,
        group: 'Customers',
        icon: UsersIcon,
        title: c.name,
        subtitle: formatPhone(c.phone),
      })),
    ...calls
      .filter((c) => has(c.name, c.summary, c.city))
      .map((c) => ({
        id: `call-${c.id}`,
        group: 'Conversations',
        icon: PhoneIcon,
        title: c.name,
        subtitle: `${c.summary.slice(0, 60)}… · ${c.ago}`,
      })),
    ...appointments
      .filter((a) => has(a.name, a.service, a.address))
      .map((a) => ({
        id: `appointment-${a.id}`,
        group: 'Appointments',
        icon: CalendarDaysIcon,
        title: a.service,
        subtitle: `${a.name} · ${humanizeEnum(a.status)}`,
      })),
    ...articles
      .filter((a) => has(a.title, a.excerpt))
      .map((a) => ({
        id: `article-${a.id}`,
        group: 'Knowledge Base',
        icon: BookOpenIcon,
        title: a.title,
        subtitle: humanizeEnum(a.category),
      })),
  ].slice(0, 6);
}

/**
 * The header's search, matching `components/GlobalSearch`.
 *
 * Collapsed to a 40px pill until asked for, then swept open on `max-width` —
 * the cap moves, the flex algebra does not, so the row beside it never reflows.
 * It searches the preview's own fixtures, so a visitor typing "Dublin" gets the
 * caller from the list they can see.
 */
function PreviewSearch() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      if (!query.trim()) setExpanded(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [query]);

  const hits = searchFixtures(query);

  return (
    <div
      ref={containerRef}
      data-search-expanded={expanded ? 'true' : 'false'}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        inputRef.current?.blur();
        setOpen(false);
        if (!query.trim()) setExpanded(false);
      }}
      className={cn(
        'relative flex-1 transition-[max-width] duration-base ease-standard',
        expanded ? 'min-w-0 max-w-[15rem] sm:max-w-md' : 'max-w-10',
      )}
    >
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Search customers, calls and appointments"
          aria-expanded={false}
          className="focus-ring relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors duration-fast ease-standard hover:border-line-strong hover:text-ink"
        >
          <MagnifyingGlassIcon className="h-[18px] w-[18px]" aria-hidden />
        </button>
      )}

      <div
        className={cn(
          'transition-opacity duration-base ease-standard',
          expanded ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
        )}
        aria-hidden={!expanded}
      >
        <SearchInput
          ref={inputRef}
          value={query}
          tabIndex={expanded ? undefined : -1}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder="Search customers, calls, appointments…"
          aria-label="Search the preview"
        />
      </div>

      {expanded && open && query.trim().length >= 2 && (
        <div className="absolute z-40 mt-2 max-h-80 w-full overflow-y-auto border border-line-subtle bg-surface-overlay p-2 shadow-dropdown">
          {!hits.length ? (
            <p className="px-3 py-4 text-body text-ink-muted">No results for “{query.trim()}”.</p>
          ) : (
            hits.map((hit) => (
              <div key={hit.id} className="flex items-center gap-3 px-3 py-2">
                <hit.icon className={cn(ICON_SIZE.status, 'shrink-0 text-ink-faint')} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-ink">{hit.title}</span>
                  <span className="block truncate text-small text-ink-muted">
                    {hit.group} · {hit.subtitle}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── The window ──────────────────────────────────────────────────────────── */

/**
 * The application window as it sits on the marketing page's black canvas.
 *
 * `[color-scheme:light]` matters more than it looks: the marketing route sets
 * `color-scheme: dark` on the document so the browser's own UI follows the
 * black page, and without this the scrollbar inside the preview — and the
 * search field's native affordances — would render dark inside a light
 * application.
 */
export function AppWindow({
  view,
  unreadCount,
  onNavigate,
  children,
}: {
  view: ViewId;
  /** Owned by the showcase, so marking a notification read updates the badge. */
  unreadCount: number;
  onNavigate: (id: ViewId) => void;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const reduced = useReducedMotion();
  const activeTab = TABS.findIndex((tab) => tab.id === view);

  const navigate = (id: ViewId) => {
    onNavigate(id);
    setDrawer(false);
  };

  return (
    <figure
      className={cn(
        'm-0 flex flex-col overflow-hidden bg-base font-sans text-ink [color-scheme:light]',
        // The frame. A hairline of white where the app meets the page, and one
        // long brand-tinted shadow underneath — the window is lit by the page it
        // sits on rather than outlined against it.
        'ring-1 ring-white/10 shadow-[0_60px_140px_-60px_rgba(43,92,230,0.55)]',
        // No radius at all, deliberately. The product's structural geometry is
        // 0px, and a rounded preview of a square application is the first thing
        // that would give this away as a mock-up.
        //
        // A window also has a size. A fixed height means moving between sections
        // never resizes the marketing page underneath it, so nothing on the page
        // can shift while the preview is being used.
        'h-[560px] sm:h-[620px] lg:h-[720px]',
      )}
    >
      <figcaption className="sr-only">
        An interactive preview of the rooferslabs dashboard, filled with example data for a roofing
        company. Use the navigation to move between sections.
      </figcaption>

      <BrowserBar />

      <div className="relative flex min-h-0 flex-1">
        {/* The 256px rail, exactly as `Sidebar` renders it above `lg`. */}
        <nav
          aria-label="Preview sections"
          className="hidden w-64 shrink-0 flex-col border-r border-line-subtle bg-surface lg:flex"
        >
          <SidebarBrand />
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <NavList view={view} unreadCount={unreadCount} onNavigate={navigate} />
          </div>
        </nav>

        {/* Below `lg` the same nav arrives as an off-canvas drawer, which is what
            `collapsible="offcanvas"` does in the application. */}
        <AnimatePresence>
          {drawer && (
            <>
              <motion.button
                type="button"
                aria-label="Close navigation"
                onClick={() => setDrawer(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-30 cursor-default bg-black/40 lg:hidden"
              />
              <motion.div
                initial={{ x: reduced ? 0 : '-100%', opacity: reduced ? 0 : 1 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: reduced ? 0 : '-100%', opacity: reduced ? 0 : 1 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="absolute inset-y-0 left-0 z-40 flex w-[18rem] flex-col border-r border-line-subtle bg-surface shadow-dialog lg:hidden"
              >
                <div className="flex items-center justify-between pr-2">
                  <SidebarBrand />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label="Close navigation"
                    onClick={() => setDrawer(false)}
                  >
                    <XMarkIcon className={ICON_SIZE.nav} aria-hidden />
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                  <NavList view={view} unreadCount={unreadCount} onNavigate={navigate} />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* The 64px header: drawer trigger, search, install, bell, avatar. */}
          <header className="group/header relative z-20 flex h-16 shrink-0 items-center gap-3 border-b border-line-subtle bg-[color-mix(in_oklab,var(--surface-1)_88%,transparent)] px-4 backdrop-blur sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
              className="rounded-full lg:hidden"
            >
              <Bars3Icon className={ICON_SIZE.nav} aria-hidden />
            </Button>

            <PreviewSearch />

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                className="hidden rounded-full tracking-tight sm:inline-flex"
              >
                <ArrowDownTrayIcon aria-hidden />
                Install app
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-full"
                aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
                onClick={() => navigate('notifications')}
              >
                <BellIcon className={ICON_SIZE.nav} aria-hidden />
                {unreadCount > 0 && (
                  // The only looping animation in the preview, and it is 8px
                  // wide. `animate-ping` is a compositor-only transform, and the
                  // global reduced-motion rule stops it after one pass.
                  <span className="absolute right-2 top-2 flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emergency opacity-70 motion-reduce:hidden" />
                    <span className="relative h-2 w-2 rounded-full bg-emergency ring-2 ring-surface" />
                  </span>
                )}
              </Button>
              <span
                aria-hidden
                className="font-num flex h-8 w-8 items-center justify-center rounded-full bg-accent text-caption font-semibold text-ink-on-brand"
              >
                {COMPANY.initials}
              </span>
            </div>
          </header>

          {/* The page itself. Scrolls inside the window on desktop, exactly as
              the application scrolls inside the viewport. */}
          {/* Scroll chaining is left at the browser default on purpose: a
              visitor swiping past the bottom of the preview continues down the
              marketing page rather than being held inside it. */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-base">
            <div className="mx-auto w-full max-w-dashboard px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
              {children}
            </div>
          </div>

          {/* The handheld tab bar, matching `components/BottomNav`. */}
          <nav
            aria-label="Preview primary"
            className="shrink-0 border-t border-line-subtle bg-surface lg:hidden"
          >
            <ul className="relative mx-auto flex h-16 max-w-md items-stretch">
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center',
                  'transition-[transform,opacity] duration-slow ease-decelerate motion-reduce:transition-none',
                  activeTab < 0 && 'opacity-0',
                )}
                style={{
                  width: `${100 / TABS.length}%`,
                  transform: `translate3d(${Math.max(activeTab, 0) * 100}%, 0, 0)`,
                }}
              >
                <span className="h-9 w-16 rounded-full bg-accent-subtle" />
              </span>

              {TABS.map((tab, index) => {
                const active = index === activeTab;
                return (
                  <li key={tab.id} className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => navigate(tab.id)}
                      aria-label={tab.label}
                      aria-current={active ? 'page' : undefined}
                      className="group flex h-full w-full items-center justify-center outline-none"
                    >
                      <span className="flex h-9 w-16 items-center justify-center rounded-full group-focus-visible:ring-2 group-focus-visible:ring-focus group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-surface">
                        <tab.icon
                          className={cn(
                            ICON_SIZE.nav,
                            'transition-[color,transform] duration-base ease-standard motion-reduce:transition-none',
                            active ? '-translate-y-px text-accent' : 'translate-y-0 text-ink-muted',
                          )}
                          aria-hidden
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </figure>
  );
}

/**
 * The browser strip above the application.
 *
 * Deliberately understated and built from the product's own surface tokens: it
 * is there to say "this is a running application at an address", not to be a
 * pixel-accurate drawing of somebody's browser.
 */
function BrowserBar() {
  return (
    <div
      aria-hidden
      className="flex h-9 shrink-0 items-center gap-2 border-b border-line-subtle bg-surface-3 px-4"
    >
      <span className="flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
      </span>
      <span className="mx-auto flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-caption text-ink-faint">
        <LockClosedIcon className="h-3 w-3" />
        {COMPANY.host}
      </span>
    </div>
  );
}
