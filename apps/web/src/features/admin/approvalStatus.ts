import { CompanyStatus } from '@rooferslabs/shared';
import type { AdminCompanyRow } from '@/types/api';

/**
 * How each lifecycle status is presented, and which decisions it offers.
 *
 * One table, read by the summary cards, the filter tabs, the status badges, the
 * row actions and the drawer. The alternative — each of those five deciding for
 * itself what orange means and which button a paused account gets — is exactly
 * how a Resume button ends up on a pending account.
 *
 * The action lists are a *presentation* of the API's preconditions, not a
 * substitute for them: `AdminService` refuses an approve on anything but a
 * pending account regardless of which button a browser managed to render.
 */
export const STATUS_PRESENTATION = {
  [CompanyStatus.PENDING_APPROVAL]: {
    label: 'Pending',
    /** Yellow: something is waiting on a person. */
    tone: 'warning' as const,
    action: 'approve' as const,
    actionLabel: 'Accept',
    /** Cards for statuses nobody has to act on read as noise; this one does not. */
    summary: 'Pending customers',
  },
  [CompanyStatus.ACTIVE]: {
    label: 'Active',
    tone: 'success' as const,
    action: 'pause' as const,
    actionLabel: 'Pause',
    summary: 'Active customers',
  },
  [CompanyStatus.PAUSED]: {
    label: 'Paused',
    tone: 'danger' as const,
    action: 'resume' as const,
    actionLabel: 'Resume',
    summary: 'Paused customers',
  },
  [CompanyStatus.ONBOARDING]: {
    label: 'In setup',
    /** Grey: nothing is being asked of the founder until setup finishes. */
    tone: 'neutral' as const,
    /** No decision to make. A tenant mid-wizard has not applied yet. */
    action: null,
    actionLabel: null,
    summary: 'In setup',
  },
} as const;

export type StatusPresentation = (typeof STATUS_PRESENTATION)[CompanyStatus];

/**
 * The order the founder reads them in: what needs a decision, then what is
 * running, then what is switched off, then what has not arrived yet.
 */
export const STATUS_ORDER: readonly CompanyStatus[] = [
  CompanyStatus.PENDING_APPROVAL,
  CompanyStatus.ACTIVE,
  CompanyStatus.PAUSED,
  CompanyStatus.ONBOARDING,
];

/**
 * A row's presentation, defaulting to "in setup" when the status is missing.
 *
 * `AdminCompanyRow.status` is optional at the type level, and an unrecognised
 * value has to render *something* — a blank status cell reads as a broken table
 * rather than as an unusual account.
 */
export function presentationFor(status: AdminCompanyRow['status']): StatusPresentation {
  return STATUS_PRESENTATION[status ?? CompanyStatus.ONBOARDING] ?? STATUS_PRESENTATION.ONBOARDING;
}
