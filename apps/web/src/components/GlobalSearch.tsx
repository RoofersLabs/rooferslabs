import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, CalendarClock, BookOpen, User } from 'lucide-react';
import { useGlobalSearch } from '@/hooks/queries';
import { humanizeEnum, timeAgo } from '@/lib/utils';
import { SearchInput } from '@/components/ui/SearchInput';

/**
 * Header search with debounced global results across all business entities.
 *
 * `inputClassName` is forwarded to the field so the shell can soften its radius
 * on the dashboard without the shared `SearchInput` changing for the Calls,
 * Customers and Knowledge pages that also render it.
 */
export function GlobalSearch({ inputClassName }: { inputClassName?: string }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const results = useGlobalSearch(debounced);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

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

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <SearchInput
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder="Search customers, calls, appointments…"
        aria-label="Global search"
        inputClassName={inputClassName}
      />

      {open && debounced.trim().length >= 2 && (
        <div className="absolute z-40 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-line-subtle bg-surface-overlay p-2 shadow-dropdown">
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
                      icon={<User className="h-4 w-4 text-ink-faint" />}
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
                      icon={<Phone className="h-4 w-4 text-ink-faint" />}
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
                      icon={<CalendarClock className="h-4 w-4 text-ink-faint" />}
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
                      icon={<BookOpen className="h-4 w-4 text-ink-faint" />}
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
      className="focus-ring flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors duration-fast hover:bg-surface-2"
    >
      {icon}
      <span className="min-w-0">
        <span className="block truncate text-body font-medium text-ink">{title}</span>
        <span className="block truncate text-small text-ink-muted">{subtitle}</span>
      </span>
    </button>
  );
}
