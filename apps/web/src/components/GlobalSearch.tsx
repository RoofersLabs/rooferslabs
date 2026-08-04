import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '@/hooks/queries';
import { cn, humanizeEnum, timeAgo } from '@/lib/utils';
import { SearchInput } from '@/components/ui/SearchInput';
import {
  BookOpenIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

/**
 * Header search with debounced global results across all business entities.
 *
 * Collapsed to a 40px pill until asked for. The header carries the drawer
 * trigger, the install button, the bell and the avatar, and on a 390px phone a
 * permanently-open field left the search about 145px — too narrow to read what
 * you had typed. Collapsed it costs one control's width and gives the row back.
 *
 * `inputClassName` is forwarded to the field for the shell's own overrides.
 */
export function GlobalSearch({ inputClassName }: { inputClassName?: string }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const results = useGlobalSearch(debounced);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  /**
   * Collapsing is conditional on purpose: a field with something typed in it
   * has state worth keeping, and throwing that away because the user clicked
   * the page behind it would be the interaction losing their work. Empty, it
   * has nothing to lose, so it gets out of the way.
   */
  const collapseIfEmpty = useCallback(() => {
    setOpen(false);
    if (!query.trim()) setExpanded(false);
  }, [query]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) collapseIfEmpty();
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [collapseIfEmpty]);

  // Focus follows expansion rather than the click, so the caret lands in a field
  // that is already growing instead of one that has not been laid out yet.
  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const go = (path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  const data = results.data;
  const hasResults =
    data &&
    (data.customers.length ||
      data.conversations.length ||
      data.appointments.length ||
      data.knowledgeArticles.length);

  /**
   * The width animation is on `max-width`, not `width`.
   *
   * The element stays `flex-1 min-w-0` in both states, so the header's flex
   * algebra never changes and there is no reflow to jump through — only the cap
   * moves, from one control's width to the field's. `width` would have needed a
   * definite target, and `auto`/percentage targets are what make these
   * animations snap on the first frame.
   *
   * `min-w-0` is separately load-bearing: as a flex item this container defaults
   * to `min-width: auto`, which floors it at an `<input>`'s intrinsic width
   * (~180px) and makes the row unshrinkable. That is what pushed the header
   * sideways on a 390px phone once the install button joined it.
   */
  return (
    <div
      ref={containerRef}
      // Read by the header, which yields the install button on a phone while
      // the field is open — see AppLayout. Exposed as an attribute rather than
      // lifted into the layout's state so this component stays self-contained
      // and the header needs no knowledge of when to re-render.
      data-search-expanded={expanded ? 'true' : 'false'}
      onKeyDown={(event) => {
        // Escape gives the field back without discarding a query mid-thought:
        // it closes the results, and only collapses when there is nothing typed.
        if (event.key === 'Escape') {
          event.stopPropagation();
          inputRef.current?.blur();
          collapseIfEmpty();
        }
      }}
      className={cn(
        'relative flex-1 transition-[max-width] duration-base ease-standard',
        // The expanded cap is responsive because the *animation* range has to
        // match the travel, not just the destination. A phone header only has
        // ~224px to give, so sweeping the cap to 28rem there meant the field hit
        // its real ceiling about 70ms into a 200ms transition and appeared to
        // snap. Capping near the space that actually exists spends the whole
        // duration moving.
        expanded ? 'min-w-0 max-w-[15rem] sm:max-w-md' : 'max-w-10',
      )}
    >
      {/* The collapsed affordance. A real button, so it is tabbable, has a name,
          and announces the state it controls — the input behind it is inert
          until it opens. */}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Search customers, calls and appointments"
          aria-expanded={false}
          // The `after:` block is the same transparent 44px hit area the shared
          // Button applies to its 40px sizes — this control is hand-rolled
          // because it is a search field's collapsed state rather than a button
          // variant, so it has to opt in explicitly.
          className="focus-ring relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors duration-fast ease-standard after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:border-line-strong hover:text-ink"
        >
          <MagnifyingGlassIcon className="h-[18px] w-[18px]" aria-hidden />
        </button>
      )}

      {/* Kept mounted so the query survives a collapse, and so the field is not
          being created in the same frame it is asked to take focus. Hidden from
          the tab order and from assistive tech while it is closed. */}
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
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Search customers, calls, appointments…"
          aria-label="Global search"
          inputClassName={inputClassName}
        />
      </div>

      {expanded && open && debounced.trim().length >= 2 && (
        <div className="absolute z-40 mt-2 max-h-96 w-full overflow-y-auto border border-line-subtle bg-surface-overlay p-2 shadow-dropdown">
          {results.isLoading ? (
            <p className="px-3 py-4 text-body text-ink-muted">Searching…</p>
          ) : !hasResults ? (
            <p className="px-3 py-4 text-body text-ink-muted">No results for “{debounced}”.</p>
          ) : (
            <>
              {data.customers.length > 0 && (
                <SearchSection label="Customers">
                  {data.customers.map((c) => (
                    <SearchRow
                      key={c.id}
                      icon={<UserIcon className="h-4 w-4 text-ink-faint" />}
                      title={c.fullName ?? c.phone ?? 'Unknown'}
                      subtitle={c.email ?? c.phone ?? ''}
                      onClick={() => go('/customers')}
                    />
                  ))}
                </SearchSection>
              )}
              {data.conversations.length > 0 && (
                <SearchSection label="Conversations">
                  {data.conversations.map((c) => (
                    <SearchRow
                      key={c.id}
                      icon={<PhoneIcon className="h-4 w-4 text-ink-faint" />}
                      title={c.customer?.fullName ?? 'Caller'}
                      subtitle={`${c.summary?.slice(0, 60) ?? ''} · ${timeAgo(c.createdAt)}`}
                      onClick={() => go(`/conversations/${c.id}`)}
                    />
                  ))}
                </SearchSection>
              )}
              {data.appointments.length > 0 && (
                <SearchSection label="Appointments">
                  {data.appointments.map((a) => (
                    <SearchRow
                      key={a.id}
                      icon={<CalendarDaysIcon className="h-4 w-4 text-ink-faint" />}
                      title={a.serviceRequested ?? 'Appointment'}
                      subtitle={humanizeEnum(a.status)}
                      onClick={() => go('/appointments')}
                    />
                  ))}
                </SearchSection>
              )}
              {data.knowledgeArticles.length > 0 && (
                <SearchSection label="Knowledge Base">
                  {data.knowledgeArticles.map((k) => (
                    <SearchRow
                      key={k.id}
                      icon={<BookOpenIcon className="h-4 w-4 text-ink-faint" />}
                      title={k.title}
                      subtitle={humanizeEnum(k.category)}
                      onClick={() => go('/knowledge')}
                    />
                  ))}
                </SearchSection>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SearchSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-caption font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      {children}
    </div>
  );
}

function SearchRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="focus-ring flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-fast hover:bg-surface-2"
    >
      {icon}
      <span className="min-w-0">
        <span className="block truncate text-body font-medium text-ink">{title}</span>
        <span className="block truncate text-small text-ink-muted">{subtitle}</span>
      </span>
    </button>
  );
}
