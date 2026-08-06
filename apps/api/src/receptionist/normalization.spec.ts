import type { NormalizedTranscriptEntry, TranscriptEntry } from '@rooferslabs/shared';
import {
  ENGLISH_POLICY,
  ROOFING_TERMS,
  SUMMARY_SECTIONS,
  TRANSCRIPT_RULES,
  buildAnalysisInstructions,
  mergeNormalizedTranscript,
  renderTranscriptForAnalysis,
} from './normalization';

/**
 * The stored-record policy, tested where it is decided.
 *
 * `mergeNormalizedTranscript` gets the most attention here, and deliberately: it
 * is the only thing standing between "the transcript reads better" and "the
 * transcript quietly lost the turn where the caller gave their address". Every
 * other rule in this file is an instruction to a model; this one is enforcement.
 */

const line = (role: 'assistant' | 'customer', text: string, offsetMs: number): TranscriptEntry => ({
  role,
  text,
  offsetMs,
});

const norm = (
  role: 'assistant' | 'customer',
  text: string,
  overrides: Partial<NormalizedTranscriptEntry> = {},
): NormalizedTranscriptEntry => ({
  role,
  text,
  originalText: null,
  lowConfidence: false,
  ...overrides,
});

describe('the analysis instructions', () => {
  const instructions = buildAnalysisInstructions('Summit Roofing');

  it('names the company, so the model can recognise it when a caller says it', () => {
    expect(instructions).toContain('Summit Roofing');
  });

  it('carries the language policy, the transcript rules and the vocabulary', () => {
    // Composed rather than restated: if any of these ever gets its own copy in a
    // second prompt, this is the case that stops being true.
    expect(instructions).toContain(ENGLISH_POLICY);
    expect(instructions).toContain(TRANSCRIPT_RULES);
    expect(instructions).toContain(ROOFING_TERMS);
  });

  it('lists every summary section in reading order', () => {
    expect(instructions).toContain(SUMMARY_SECTIONS.join(', '));
    expect(SUMMARY_SECTIONS[0]).toBe('Caller');
    expect(SUMMARY_SECTIONS).toContain('Insurance Status');
    expect(SUMMARY_SECTIONS).toContain('Follow-up Required');
  });

  it('forbids empty sections rather than asking for placeholders', () => {
    expect(instructions).toMatch(/Omit any section/i);
    expect(instructions).toMatch(/Never write "N\/A"/i);
  });

  it('forbids invention in the strongest terms available', () => {
    // The single most consequential instruction in the product: a fabricated
    // address sends a crew to the wrong house.
    expect(instructions).toContain('NEVER INVENT');
    expect(instructions).toMatch(/An uncertain value is null/i);
  });

  it('tells the model to preserve, not summarise, inside the transcript', () => {
    expect(TRANSCRIPT_RULES).toContain('PRESERVE MEANING EXACTLY');
    expect(TRANSCRIPT_RULES).toMatch(/Do not add, infer, summarise, soften, or omit/i);
  });

  it('requires low-confidence speech to survive rather than be guessed at', () => {
    expect(ENGLISH_POLICY).toMatch(/Never translate a segment you cannot confidently interpret/i);
    expect(ENGLISH_POLICY).toMatch(/A flagged original is correct/i);
  });

  it('standardises the roofing vocabulary the recogniser mangles', () => {
    expect(ROOFING_TERMS).toContain('shingle');
    expect(ROOFING_TERMS).toContain('underlayment');
    expect(ROOFING_TERMS).toContain('drip edge');
    expect(ROOFING_TERMS).toContain('deductible');
  });
});

describe('rendering the transcript for the model', () => {
  it('numbers the lines and names the speakers', () => {
    const rendered = renderTranscriptForAnalysis([
      { role: 'assistant', text: 'Thanks for calling.' },
      { role: 'customer', text: 'my roof is leaking' },
    ]);
    expect(rendered).toBe('[1] AI: Thanks for calling.\n[2] Caller: my roof is leaking');
  });

  it('says so plainly when there is nothing to analyse', () => {
    expect(renderTranscriptForAnalysis([])).toBe('No conversation content was recorded.');
  });
});

describe('merging the normalized transcript', () => {
  const raw = [
    line('assistant', 'thanks for calling summit roofing', 0),
    line('customer', 'yeah so uh my my roof is is leaking', 1200),
  ];

  it('applies the cleaned text and keeps the recorded timings', () => {
    const { entries, applied } = mergeNormalizedTranscript(raw, [
      norm('assistant', 'Thanks for calling Summit Roofing.'),
      norm('customer', 'My roof is leaking.'),
    ]);

    expect(applied).toBe(true);
    expect(entries[0]?.text).toBe('Thanks for calling Summit Roofing.');
    expect(entries[1]?.text).toBe('My roof is leaking.');
    // Timings come from the recording; the model never sees them.
    expect(entries.map((e) => e.offsetMs)).toEqual([0, 1200]);
  });

  it('keeps what was actually heard whenever a line was rewritten', () => {
    const { entries } = mergeNormalizedTranscript(raw, [
      norm('assistant', 'Thanks for calling Summit Roofing.'),
      norm('customer', 'My roof is leaking.'),
    ]);
    expect(entries[1]?.originalText).toBe('yeah so uh my my roof is is leaking');
  });

  it('does not record an original for a line it left alone', () => {
    const { entries } = mergeNormalizedTranscript(
      [line('customer', 'My roof is leaking.', 0)],
      [norm('customer', 'My roof is leaking.')],
    );
    expect(entries[0]).not.toHaveProperty('originalText');
  });

  it('carries the low-confidence flag through', () => {
    const { entries } = mergeNormalizedTranscript(
      [line('customer', 'esta goteando el techo', 0)],
      [norm('customer', 'esta goteando el techo', { lowConfidence: true })],
    );
    expect(entries[0]?.lowConfidence).toBe(true);
    expect(entries[0]?.text).toBe('esta goteando el techo');
  });

  it('translates a foreign-language line while keeping the original', () => {
    const { entries, applied } = mergeNormalizedTranscript(
      [line('customer', 'mi techo tiene una gotera en la cocina', 0)],
      [
        norm('customer', 'My roof has a leak in the kitchen.', {
          originalText: 'mi techo tiene una gotera en la cocina',
        }),
      ],
    );
    expect(applied).toBe(true);
    expect(entries[0]?.text).toBe('My roof has a leak in the kitchen.');
    expect(entries[0]?.originalText).toBe('mi techo tiene una gotera en la cocina');
    expect(entries[0]?.lowConfidence).toBeUndefined();
  });

  // ---- The refusals. These are the point of the function. ----------------

  it('refuses a transcript that lost a line', () => {
    // The dangerous failure: it would read perfectly and be missing a turn.
    const { entries, applied, reason } = mergeNormalizedTranscript(raw, [
      norm('assistant', 'Thanks for calling Summit Roofing.'),
    ]);
    expect(applied).toBe(false);
    expect(reason).toMatch(/line count changed/);
    expect(entries).toEqual(raw);
  });

  it('refuses a transcript that gained a line', () => {
    const { applied } = mergeNormalizedTranscript(raw, [
      norm('assistant', 'Thanks for calling.'),
      norm('customer', 'My roof is leaking.'),
      norm('customer', 'It started last night.'),
    ]);
    expect(applied).toBe(false);
  });

  it('refuses a transcript whose speakers no longer line up', () => {
    const { applied, reason, entries } = mergeNormalizedTranscript(raw, [
      norm('customer', 'My roof is leaking.'),
      norm('assistant', 'Thanks for calling Summit Roofing.'),
    ]);
    expect(applied).toBe(false);
    expect(reason).toMatch(/speaker order changed at line 1/);
    expect(entries).toEqual(raw);
  });

  it('refuses an absent transcript without complaint', () => {
    // The tenant-gated and no-model paths both return nothing here; that is
    // ordinary, not an error.
    expect(mergeNormalizedTranscript(raw, undefined).applied).toBe(false);
    expect(mergeNormalizedTranscript(raw, []).applied).toBe(false);
    expect(mergeNormalizedTranscript(raw, []).entries).toEqual(raw);
  });

  it('keeps the recorded wording when the model returns an empty line', () => {
    // An empty rewrite is a dropped line wearing the right shape.
    const { entries } = mergeNormalizedTranscript(raw, [
      norm('assistant', '   '),
      norm('customer', 'My roof is leaking.'),
    ]);
    expect(entries[0]?.text).toBe('thanks for calling summit roofing');
  });

  it('handles an empty call without inventing anything', () => {
    expect(mergeNormalizedTranscript([], []).entries).toEqual([]);
  });

  it('never mutates the recorded transcript', () => {
    const original = structuredClone(raw);
    mergeNormalizedTranscript(raw, [
      norm('assistant', 'Thanks for calling Summit Roofing.'),
      norm('customer', 'My roof is leaking.'),
    ]);
    expect(raw).toEqual(original);
  });
});
