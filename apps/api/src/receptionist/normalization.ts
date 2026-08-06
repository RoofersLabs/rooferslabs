import type { NormalizedTranscriptEntry, TranscriptEntry } from '@rooferslabs/shared';

/**
 * The one place RoofersLabs decides what its stored records read like.
 *
 * Every business record this platform keeps — transcript, summary, key points,
 * appointment notes, the fields that become CRM columns — is produced by a
 * single post-call analysis pass, and every rule that pass follows is written
 * here. That centralisation is the point: the language policy, the summary
 * structure and the roofing vocabulary were the kind of thing that gets pasted
 * into a second prompt six months later and quietly drifts, so there is exactly
 * one copy and every caller composes it.
 *
 * Nothing in this file talks to a model, a database, or a company record. It
 * builds strings, which makes the entire policy readable in one sitting and
 * testable without a network.
 */

/**
 * The language rule, stated once.
 *
 * RoofersLabs stores operational data in English. A caller may speak Spanish,
 * Hindi, Telugu, or move between languages mid-sentence, and the receptionist
 * answers them naturally — but the record the office reads back later has to be
 * one language, or a roofing company with three office staff ends up unable to
 * work its own leads.
 *
 * The escape hatch matters more than the rule. A model asked to translate
 * everything will translate the parts it cannot hear, and an invented address is
 * far worse than an untranslated one. So a segment below the confidence bar
 * keeps its original wording and is flagged, which is a record someone can act
 * on rather than a fluent guess nobody can check.
 */
export const ENGLISH_POLICY = [
  'LANGUAGE POLICY — every stored record must be professional English.',
  'The caller may speak any language, mix languages, or speak English with a strong regional accent.',
  'Whatever was said, the stored transcript, summary, key points and notes must read as fluent, professional English.',
  'Translate meaning, not words: render what the caller actually communicated the way a fluent English speaker would say it.',
  'Never translate a segment you cannot confidently interpret. Keep its original wording verbatim, set lowConfidence to true for that line, and move on.',
  'A flagged original is correct. A confident-sounding guess is not.',
].join(' ');

/**
 * What "clean the transcript" means, precisely.
 *
 * Speech recognition output is not a transcript — it is a stream of guesses with
 * no punctuation, repeated tokens where the model re-emitted a partial, and
 * roofing words rendered phonetically. The list below is deliberately split into
 * what to fix and what to leave, because the failure mode of a transcript
 * cleaner is over-editing: a summariser that "tidies" a caller's words until
 * they sound like the AI wrote them has destroyed the only unmediated record of
 * what the customer asked for.
 */
export const TRANSCRIPT_RULES = [
  'TRANSCRIPT — rewrite each line into clean written English.',
  'Fix spelling, punctuation, capitalisation, grammar and sentence boundaries.',
  'Remove duplicated words and half-repeated phrases that are streaming artifacts, not speech.',
  'Remove recogniser noise such as stray tokens and obvious mis-segmentation.',
  'Correct roofing vocabulary that was transcribed phonetically.',
  'Correct a company name only when the conversation makes it unambiguous.',
  'Correct an address only when you are confident of every part you change; otherwise leave it exactly as heard.',
  'PRESERVE MEANING EXACTLY. Do not add, infer, summarise, soften, or omit anything the speaker said.',
  'Keep the conversational tone — a caller who was upset should still read as upset.',
  'Keep every line in speaker order, one entry per line, with the same speaker attribution.',
  'Set originalText to the recogniser wording whenever you changed the line, and null when you did not.',
].join(' ');

/**
 * The sections a summary may contain, in reading order.
 *
 * Ordered the way an office manager triages: who is this, where, what is wrong,
 * how fast, then the detail. A section with nothing in it is omitted rather than
 * written as "N/A" — a wall of empty headings is what makes a structured summary
 * slower to read than a paragraph, which defeats the reason for structuring it.
 */
export const SUMMARY_SECTIONS = [
  'Caller',
  'Property',
  'Reason for Call',
  'Urgency',
  'Damage Reported',
  'Insurance Status',
  'Roof Information',
  'Customer Concerns',
  'Appointment Preference',
  'Actions Taken',
  'Follow-up Required',
  'Outstanding Questions',
  'Additional Notes',
] as const;

/**
 * Roofing vocabulary the recogniser reliably mangles, and the term the trade
 * actually uses.
 *
 * Not a find-and-replace table — it is shown to the model as the house style, so
 * that "drip edge" and "dripping edge" and "drip ledge" all land on one term the
 * office can filter a CRM column by. Consistency is the whole value: a lead list
 * where the same defect is written four ways cannot be counted.
 */
export const ROOFING_TERMS = [
  'shingle (not "single" or "shingal")',
  'asphalt shingle, architectural shingle, three-tab shingle',
  'underlayment (not "under layment")',
  'flashing, step flashing, drip edge',
  'soffit, fascia, ridge vent, valley',
  'decking / sheathing, rafters, trusses',
  'ice and water shield, felt paper',
  'gutter, downspout, gutter guard',
  'hail damage, wind damage, granule loss, blistering, curling',
  'tear-off, re-roof, overlay, patch repair',
  'square (roofing measurement), pitch, slope',
  'insurance claim, adjuster, deductible, supplement, scope of loss',
  'TPO, EPDM, modified bitumen, standing seam metal',
].join('; ');

/**
 * The complete instruction for the post-call analysis pass.
 *
 * One prompt produces the structured record, the summary and the normalized
 * transcript together, because they are three views of one conversation and
 * splitting them into separate model calls would let them disagree — a summary
 * naming a defect the transcript no longer mentions is worse than either alone,
 * and it costs a second round trip to produce.
 *
 * `companyName` is the only company-specific input: it is what lets the model
 * recognise the business's own name when a caller says it, and it appears in the
 * summary's voice.
 */
export function buildAnalysisInstructions(companyName: string): string {
  return [
    `You are an experienced roofing office manager at ${companyName} writing up a phone call for the team.`,
    'You produce three things from one transcript: a structured record, a summary, and a cleaned transcript.',

    ENGLISH_POLICY,
    TRANSCRIPT_RULES,

    `ROOFING VOCABULARY — use these standard terms consistently: ${ROOFING_TERMS}.`,

    'SUMMARY — write it the way an experienced office manager would, not the way a machine would.',
    `Use only the relevant sections from this list, in this order: ${SUMMARY_SECTIONS.join(', ')}.`,
    'Omit any section the call gives you nothing for. Never write "N/A", "None", or "Not discussed".',
    'Format each section as "Section Name: content" on its own line. Keep each one to a sentence or two.',
    'It must be scannable in ten seconds by someone about to return the call, and it must be complete enough that they do not need the transcript.',

    'STRUCTURED FIELDS — these become CRM columns, so they must be consistent between calls.',
    'Normalise every free-text field into professional English using the vocabulary above: serviceType, damage descriptions, leak locations, roof type, insurance status, appointment notes.',
    'Base every field strictly on the transcript. Use null for anything the caller did not give.',

    'NEVER INVENT. Do not fabricate a name, a phone number, an address, a date, a roof detail, or an insurance status.',
    'A missing value is null. An uncertain value is null. Only a value the caller actually gave is a value.',

    'leadQuality rubric:',
    '- HOT: an emergency, or a visit was agreed, or they have a real problem now and gave contact details.',
    '- WARM: a genuine roofing need and reachable contact details, but no visit agreed yet.',
    '- COLD: early-stage interest only — price curiosity, a general question, no timeline, or incomplete contact details.',
    '- UNQUALIFIED: no roofing need, out of the service area, a wrong number, a sales call, or nothing usable was captured.',
    'Mark the outcome SPAM for solicitations, robocalls, and sales calls, and do not grade them as leads.',

    'keyPoints are for the person who calls this customer back: what is wrong, what was committed to, and anything about access, timing, or the decision maker.',
    'detectedLanguages lists the languages actually heard, lowercase ("en", "es", "hi"). Use ["en"] for an ordinary English call.',
  ].join(' ');
}

/**
 * The transcript as the model receives it.
 *
 * Lines are numbered so the model can be told to return exactly this many
 * entries in this order — without an index it silently merges or drops lines,
 * and a transcript that has quietly lost a turn is worse than one that reads
 * awkwardly. The speaker label is spelled out rather than passed as a role
 * string because the model is being asked to reason about a conversation, not to
 * fill in a data structure.
 */
export function renderTranscriptForAnalysis(
  entries: readonly { role: 'assistant' | 'customer'; text: string }[],
): string {
  if (entries.length === 0) return 'No conversation content was recorded.';
  return entries
    .map(
      (entry, index) =>
        `[${index + 1}] ${entry.role === 'assistant' ? 'AI' : 'Caller'}: ${entry.text}`,
    )
    .join('\n');
}

/**
 * Merge the model's normalized lines back onto the recorded transcript.
 *
 * The normalized lines carry no timing — the model is given text and returns
 * text — so the offsets come from the live entries, which is also what forces
 * the two to line up one-for-one. If they do not, the normalized transcript is
 * discarded wholesale and the recorded one is kept unchanged.
 *
 * That is deliberately all-or-nothing. The failure this guards against is a
 * model quietly merging two turns or dropping a short one, which produces a
 * transcript that reads perfectly and is missing the sentence where the caller
 * gave their address. A transcript that reads a little rough is recoverable; one
 * that is subtly incomplete is not, and nobody would ever notice.
 */
export function mergeNormalizedTranscript(
  raw: readonly TranscriptEntry[],
  normalized: readonly NormalizedTranscriptEntry[] | undefined,
): { entries: TranscriptEntry[]; applied: boolean; reason?: string } {
  if (!normalized || normalized.length === 0) {
    return { entries: [...raw], applied: false, reason: 'no normalized transcript returned' };
  }
  if (normalized.length !== raw.length) {
    return {
      entries: [...raw],
      applied: false,
      reason: `line count changed (${raw.length} → ${normalized.length})`,
    };
  }

  const misaligned = raw.findIndex((entry, i) => normalized[i]?.role !== entry.role);
  if (misaligned !== -1) {
    return {
      entries: [...raw],
      applied: false,
      reason: `speaker order changed at line ${misaligned + 1}`,
    };
  }

  return {
    entries: raw.map((entry, i) => {
      const line = normalized[i]!;
      const text = line.text?.trim() || entry.text;
      // An empty rewrite is a dropped line, not a cleaned one.
      const changed = text !== entry.text;
      return {
        role: entry.role,
        text,
        offsetMs: entry.offsetMs,
        ...(changed ? { originalText: entry.text } : {}),
        ...(line.lowConfidence ? { lowConfidence: true } : {}),
      };
    }),
    applied: true,
  };
}
