import { useState } from 'react';
import { humanizeEnum } from '@/lib/utils';
import { REFINED_BUTTON } from '@/components/ui/refinedControls';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/FilterBar';
import { IconTile } from '@/components/ui/IconTile';
import { Select } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/SearchInput';
import { EnumStatusText, StatusText } from '@/components/ui/StatusText';
import { BookOpenIcon, PlusIcon } from '@heroicons/react/24/outline';
import { articles } from '../data';
import { Reveal, StaggerList, StaggerRow } from '../animation';
import { PreviewPageHeader } from '../chrome';

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
 * card above a grid of article tiles.
 *
 * This is the page that explains the product to a visitor faster than any copy
 * on the site does — the AI answers callers from these articles and nothing
 * else, so seeing warranty terms, financing and the emergency policy sitting in
 * a list is seeing where the answers come from.
 */
export function KnowledgeView() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const needle = search.trim().toLowerCase();
  const visible = articles.filter(
    (article) =>
      (!category || article.category === category) &&
      (!needle || `${article.title} ${article.excerpt}`.toLowerCase().includes(needle)),
  );

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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search articles…"
              aria-label="Search knowledge base"
            />
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter by category"
              className="sm:w-52"
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
        <StaggerList as="div" delay={0.1} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((article) => (
            <StaggerRow key={article.id} as="div">
              <div className="card-interactive flex h-full flex-col items-start px-6 py-5 text-left">
                <IconTile icon={BookOpenIcon} />
                <span className="mt-4 line-clamp-2 text-body font-medium text-ink">
                  {article.title}
                </span>
                <span className="mt-2 line-clamp-3 text-small text-ink-muted">
                  {article.excerpt}
                </span>
                <span className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <StatusText tone="brand">{humanizeEnum(article.category)}</StatusText>
                  {article.status && <EnumStatusText value={article.status} />}
                </span>
                <span className="mt-3 block text-caption text-ink-faint">
                  Updated {article.updated} · v{article.version}
                </span>
              </div>
            </StaggerRow>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
