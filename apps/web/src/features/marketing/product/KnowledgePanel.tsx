import { KNOWLEDGE } from './data';

/**
 * What the receptionist knows about this specific business.
 *
 * Each answer carries its source, because the failure mode owners fear is an
 * AI inventing a price or a warranty. Attribution is the whole feature.
 */
export function KnowledgePanel() {
  return (
    <div className="h-[24.5rem] overflow-y-auto p-4 sm:p-5">
      <ul className="space-y-2.5">
        {KNOWLEDGE.map((entry, index) => (
          <li
            key={entry.question}
            className="rounded-lg border border-subtle bg-white/[0.02] p-4 transition-[border-color,background-color] duration-200 ease-out hover:border-strong hover:bg-white/[0.045]"
            style={{
              animation: `panel-row 440ms var(--ease-out) ${index * 55}ms both`,
            }}
          >
            <p className="text-sm font-medium">{entry.question}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{entry.answer}</p>
            <p className="mt-3 font-mono text-[0.6875rem] uppercase tracking-wider text-ink-quaternary">
              {entry.source}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
