import { useState } from 'react';
import { BookOpen, Plus, Search, Trash2 } from 'lucide-react';
import { KnowledgeCategory } from '@rooferslabs/shared';
import {
  useDeleteKnowledgeArticle,
  useKnowledgeArticles,
  useSaveKnowledgeArticle,
} from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { KnowledgeArticle } from '@/types/api';
import { humanizeEnum, timeAgo } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/pagination';

export function KnowledgePage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<KnowledgeArticle | null>(null);
  const [creating, setCreating] = useState(false);

  const articles = useKnowledgeArticles({
    page,
    search: debouncedSearch || undefined,
    category: category || undefined,
  });

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="Everything your AI receptionist knows about your business. It answers callers using only this content."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New article
          </Button>
        }
      />

      <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search articles…"
            className="focus-ring h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-form-input text-ink placeholder:text-ink-faint transition-colors duration-fast hover:border-line-strong"
            aria-label="Search knowledge base"
          />
        </div>
        <Select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by category"
          className="sm:w-52"
        >
          <option value="">All categories</option>
          {Object.values(KnowledgeCategory).map((value) => (
            <option key={value} value={value}>
              {humanizeEnum(value)}
            </option>
          ))}
        </Select>
      </div>

      {articles.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card flex flex-col p-5">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="mt-3.5 h-4 w-4/5" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-3/5" />
              <Skeleton className="mt-4 h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : articles.isError ? (
        <div className="card">
          <ErrorState
            title="Couldn’t load the knowledge base"
            message={(articles.error as Error).message}
            onRetry={() => void articles.refetch()}
          />
        </div>
      ) : !articles.data?.items.length ? (
        <div className="card">
          <EmptyState
            icon={BookOpen}
            title="No articles yet"
            description="Add FAQs, services, warranty terms, pricing guidance, and policies so the AI can answer accurately."
            actionLabel="Write your first article"
            onAction={() => setCreating(true)}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.data.items.map((article) => (
              <button
                key={article.id}
                onClick={() => setEditing(article)}
                className="card-interactive flex flex-col items-start p-5 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle">
                  <BookOpen className="h-4 w-4 text-accent" aria-hidden />
                </span>
                <span className="mt-3.5 line-clamp-2 text-body font-medium text-ink">
                  {article.title}
                </span>
                <span className="mt-2 line-clamp-3 text-small text-ink-muted">
                  {article.content.slice(0, 140)}
                </span>
                <span className="mt-4 flex flex-wrap items-center gap-1.5">
                  <Badge tone="brand">{humanizeEnum(article.category)}</Badge>
                  {article.status !== 'PUBLISHED' && <Badge>{humanizeEnum(article.status)}</Badge>}
                </span>
                <span className="mt-3 block text-caption text-ink-faint">
                  Updated {timeAgo(article.updatedAt)} · v{article.version}
                </span>
              </button>
            ))}
          </div>
          <div className="card mt-4">
            <Pagination pagination={articles.data.pagination} onPageChange={setPage} />
          </div>
        </>
      )}

      <ArticleModal
        open={creating || editing !== null}
        article={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function ArticleModal({
  open,
  article,
  onClose,
}: {
  open: boolean;
  article: KnowledgeArticle | null;
  onClose: () => void;
}) {
  const save = useSaveKnowledgeArticle();
  const remove = useDeleteKnowledgeArticle();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<KnowledgeCategory>(KnowledgeCategory.FAQ);

  // Sync form when target changes.
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = article?.id ?? 'new';
  if (key !== lastKey) {
    setLastKey(key);
    setTitle(article?.title ?? '');
    setContent(article?.content ?? '');
    setCategory(article?.category ?? KnowledgeCategory.FAQ);
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({ id: article?.id, title, content, category }, { onSuccess: onClose });
  };

  return (
    <Modal open={open} onClose={onClose} title={article ? 'Edit article' : 'New article'} wide>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
        />
        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value as KnowledgeCategory)}
        >
          {Object.values(KnowledgeCategory).map((value) => (
            <option key={value} value={value}>
              {humanizeEnum(value)}
            </option>
          ))}
        </Select>
        <Textarea
          label="Content"
          rows={8}
          hint="Written for callers — the AI reads this back in conversation."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        {(save.isError || remove.isError) && (
          <p className="text-small text-emergency">
            {((save.error ?? remove.error) as Error).message}
          </p>
        )}
        <div className="flex items-center justify-between">
          {article ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              loading={remove.isPending}
              onClick={() => remove.mutate(article.id, { onSuccess: onClose })}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {article ? 'Save changes' : 'Publish article'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
