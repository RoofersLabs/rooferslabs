import { useState } from 'react';
import { cn, humanizeEnum } from '@/lib/utils';
import { REFINED_BUTTON } from '@/components/ui/refinedControls';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/FilterBar';
import { IconTile } from '@/components/ui/IconTile';
import { Select } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/SearchInput';
import { EnumStatusText, StatusText } from '@/components/ui/StatusText';
import { ArrowLeftIcon, BookOpenIcon, PlusIcon } from '@heroicons/react/24/outline';
import { articles } from '../data';
import { Reveal, StaggerList, StaggerRow } from '../animation';
import { PreviewPageHeader } from '../chrome';
import { usePhone, useWide } from '../formFactor';

const CATEGORIES = [
  'BUSINESS_INFO',
  'SERVICES',
  'FAQ',
  'POLICIES',
  'WARRANTY',
  'PRICING',
  'FINANCING',
  'EMERGENCY',
  'SERVICE_AREAS',
];

/**
 * The Knowledge Base, matching `features/knowledge/KnowledgePage`: a filter
 * card above a grid of article tiles, and one article open over them.
 *
 * This is the page that explains the product to a visitor faster than any copy
 * on the site does — the AI answers callers from these articles and nothing
 * else, so seeing warranty terms, financing and the emergency policy sitting in
 * a list is seeing where the answers come from.
 *
 * The search is controlled when the showcase is typing into it and uncontrolled
 * the rest of the time, so the demo and a visitor use the same field rather than
 * two fields that look alike.
 */
export function KnowledgeView({
  search: driven,
  open,
  onOpen,
}: {
  search?: string;
  open?: string | null;
  onOpen?: (id: string | null) => void;
}) {
  const phone = usePhone();
  const wide = useWide();
  const [own, setOwn] = useState<string | null>(null);
  const [category, setCategory] = useState('');

  const search = own ?? driven ?? '';
  const needle = search.trim().toLowerCase();
  const visible = articles.filter(
    (article) =>
      (!category || article.category === category) &&
      (!needle || `${article.title} ${article.excerpt}`.toLowerCase().includes(needle)),
  );

  const article = open ? articles.find((entry) => entry.id === open) : undefined;

  if (article) {
    return (
      <div>
        <Reveal>
          <button
            type="button"
            onClick={() => onOpen?.(null)}
            data-demo-target="article:back"
            className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded-focus text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden />
            Back to results
          </button>

          <PreviewPageHeader
            title={article.title}
            description={`Updated ${article.updated} · v${article.version}`}
            actions={<StatusText tone="brand">{humanizeEnum(article.category)}</StatusText>}
          />
        </Reveal>

        <Reveal index={1}>
          <Card>
            <CardHeader>
              <CardTitle>What the receptionist tells callers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-body leading-6 text-ink">{article.excerpt}</p>
              <p className="text-body leading-6 text-ink-muted">
                Callers reporting an active leak are never asked to wait for office hours. The
                receptionist confirms the address, checks it against your service area, pages the
                on-call crew and holds the first available emergency slot — then texts the caller
                the visit window it just booked.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    );
  }

  return (
    <div>
      <Reveal as="header">
        <PreviewPageHeader
          title="Knowledge Base"
          description="Everything your AI receptionist knows about your business. It answers callers using only this content."
          actions={
            <Button className={REFINED_BUTTON} size="sm">
              <PlusIcon aria-hidden />
              New article
            </Button>
          }
        />
      </Reveal>

      <Reveal index={1}>
        <Card className="mb-4">
          <FilterBar className="border-b-0">
            <SearchInput
              className="flex-1 sm:max-w-sm"
              value={search}
              onChange={(event) => setOwn(event.target.value)}
              data-demo-target="kb:search"
              placeholder="Search articles…"
              aria-label="Search knowledge base"
            />
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter by category"
              className={cn(!phone && 'w-52')}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {humanizeEnum(value)}
                </option>
              ))}
            </Select>
          </FilterBar>
        </Card>
      </Reveal>

      {!visible.length ? (
        <Card>
          <p className="px-6 py-10 text-center text-body text-ink-muted">
            No articles match that filter.
          </p>
        </Card>
      ) : (
        <StaggerList
          as="div"
          delay={0.1}
          // `sm:grid-cols-2 lg:grid-cols-3`, as the page has it.
          className={cn('grid gap-4', wide ? 'grid-cols-3' : phone ? 'grid-cols-1' : 'grid-cols-2')}
        >
          {visible.map((entry) => (
            <StaggerRow key={entry.id} as="div">
              <button
                type="button"
                onClick={() => onOpen?.(entry.id)}
                data-demo-target={`article:${entry.id}`}
                className="card-interactive flex h-full w-full flex-col items-start px-6 py-5 text-left"
              >
                <IconTile icon={BookOpenIcon} />
                <span className="mt-4 line-clamp-2 text-body font-medium text-ink">
                  {entry.title}
                </span>
                <span className="mt-2 line-clamp-3 text-small text-ink-muted">{entry.excerpt}</span>
                <span className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <StatusText tone="brand">{humanizeEnum(entry.category)}</StatusText>
                  {entry.status && <EnumStatusText value={entry.status} />}
                </span>
                <span className="mt-3 block text-caption text-ink-faint">
                  Updated {entry.updated} · v{entry.version}
                </span>
              </button>
            </StaggerRow>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
