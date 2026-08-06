/**
 * TanStack Query hooks — the single data-access layer for the frontend
 *. Components never call fetch.
 */
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { CompanyStatus } from '@rooferslabs/shared';
import type { BillingInterval, OnboardingStep, SubscriptionPlan } from '@rooferslabs/shared';
import { api, type PaginatedResult } from '@/lib/api-client';
import type {
  AiConfiguration,
  Appointment,
  BusinessHour,
  Call,
  Company,
  Conversation,
  AdminAnalytics,
  AdminApprovalCounts,
  AdminCompanyDetail,
  AdminCompanyRow,
  BillingConfig,
  CheckoutHandle,
  Customer,
  CustomerDetail,
  DashboardOverview,
  GlobalSearchResults,
  InvoiceSummary,
  KnowledgeArticle,
  Notification,
  PhoneNumberSummary,
  PlanChangeResult,
  ReceptionistStatus,
  Session,
  SubscriptionSummary,
} from '@/types/api';

export const queryKeys = {
  session: ['session'] as const,
  company: ['company'] as const,
  subscription: ['billing', 'subscription'] as const,
  invoices: ['billing', 'invoices'] as const,
  billingConfig: ['billing', 'config'] as const,
  aiConfig: ['company', 'ai-config'] as const,
  phoneNumber: ['company', 'phone-number'] as const,
  dashboard: ['dashboard'] as const,
  calls: (params: object) => ['calls', params] as const,
  call: (id: string) => ['calls', 'detail', id] as const,
  conversation: (id: string) => ['conversations', 'detail', id] as const,
  customers: (params: object) => ['customers', params] as const,
  customer: (id: string) => ['customers', 'detail', id] as const,
  appointments: (params: object) => ['appointments', params] as const,
  knowledge: (params: object) => ['knowledge', params] as const,
  notifications: (params: object) => ['notifications', params] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  search: (q: string) => ['search', q] as const,
  receptionistStatus: ['telephony', 'receptionist-status'] as const,
  adminCompanies: (params: object) => ['admin', 'companies', params] as const,
  adminCompany: (id: string) => ['admin', 'companies', 'detail', id] as const,
  adminAnalytics: (days: number) => ['admin', 'analytics', days] as const,
};

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * The bootstrap session. `AccessProvider` is the single consumer and exposes
 * the derived identity, tenant, and billing state to the rest of the app —
 * components read it through `useAccess()`, never by calling this again.
 */
export function useSessionQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.session,
    enabled,
    staleTime: 60_000,
    queryFn: () => api.get<Session>('/auth/me'),
  });
}

// ---------------------------------------------------------------------------
// Company & onboarding
// ---------------------------------------------------------------------------

export function useCompany(enabled = true) {
  return useQuery({
    queryKey: queryKeys.company,
    enabled,
    queryFn: () => api.get<Company>('/companies/me'),
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      email?: string;
      phone?: string;
      city?: string;
      state?: string;
    }) => api.post<Company>('/companies', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.session });
      void qc.invalidateQueries({ queryKey: queryKeys.company });
    },
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Company>) => api.patch<Company>('/companies/me', body),
    onSuccess: (company) => {
      qc.setQueryData(queryKeys.company, company);
      void qc.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

export function useSetBusinessHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hours: BusinessHour[]) =>
      api.put<Company>('/companies/me/business-hours', { hours }),
    onSuccess: (company) => qc.setQueryData(queryKeys.company, company),
  });
}

export function useAiConfig(enabled = true) {
  return useQuery({
    queryKey: queryKeys.aiConfig,
    enabled,
    queryFn: () => api.get<AiConfiguration>('/companies/me/ai-configuration'),
  });
}

export function useUpdateAiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AiConfiguration>) =>
      api.patch<AiConfiguration>('/companies/me/ai-configuration', body),
    onSuccess: (config) => qc.setQueryData(queryKeys.aiConfig, config),
  });
}

/**
 * Mirror a company write into the cached session.
 *
 * The route guard derives the wizard's position from the *session*, not from the
 * company query. Invalidating the session asks for a refetch that settles a
 * round-trip later, but `advanceFrom` navigates immediately — so the guard was
 * still reading the previous step, judged the step the user had just unlocked to
 * be unreachable, and redirected them back to the one they came from. The click
 * looked like it did nothing, and the second click worked only because the
 * refetch had landed by then.
 *
 * Writing the server's own response into the session closes that window: the
 * cache is correct in the same tick the mutation resolves, so `canOpen` agrees
 * with the navigation. The invalidation still follows to reconcile the rest of
 * the session (subscription, flags) against the server.
 *
 * The cancel matters as much as the write. Each earlier step submits more than
 * one mutation — business details PATCHes the company and PUTs the hours before
 * it advances — and each of those invalidates the session too. That leaves a
 * `GET /auth/me` in flight which was issued *before* the step was persisted, so
 * it answers with the previous step and overwrites the value written below.
 * Cancelling first drops that reply on the floor; without it the fix holds on a
 * step opened directly and fails on the same step reached by walking the wizard,
 * which is exactly the intermittent double-click that was reported.
 */
async function syncSessionCompany(
  qc: ReturnType<typeof useQueryClient>,
  company: Pick<
    Company,
    'id' | 'name' | 'slug' | 'status' | 'onboardingStep' | 'logoUrl' | 'primaryColor' | 'createdAt'
  >,
) {
  await qc.cancelQueries({ queryKey: queryKeys.session });
  qc.setQueryData<Session>(queryKeys.session, (session) =>
    session
      ? {
          ...session,
          company: {
            id: company.id,
            name: company.name,
            slug: company.slug,
            status: company.status,
            onboardingStep: company.onboardingStep,
            logoUrl: company.logoUrl,
            primaryColor: company.primaryColor,
            createdAt: company.createdAt,
          },
        }
      : session,
  );
}

export function useSetOnboardingStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (step: OnboardingStep) => api.patch<Company>('/companies/me/onboarding', { step }),
    // Async so `mutateAsync` resolves only once the session cache reflects the
    // new step — `advanceFrom` navigates on the next line.
    onSuccess: async (company) => {
      qc.setQueryData(queryKeys.company, company);
      await syncSessionCompany(qc, company);
      void qc.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Company>('/companies/me/onboarding/complete'),
    onSuccess: async (company) => {
      qc.setQueryData(queryKeys.company, company);
      // Same reason as above, one stage further on: the server answers with
      // `PENDING_APPROVAL`, and writing it here is what flips the visitor from
      // `onboarding` to `approval`. Without it the final click leaves them
      // sitting on the review screen until a refetch happens to land.
      await syncSessionCompany(qc, company);
      void qc.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
//
// Provider-agnostic throughout: every hook talks to our own API, and no payment
// processor's SDK, key, or vocabulary appears in this file. Swapping providers
// changes nothing here.

/**
 * What the browser is told about billing.
 *
 * Long-lived: which provider is active and which estate it points at only
 * change on a redeploy, so this is fetched once and reused rather than
 * re-requested on every mount of the payment page.
 */
export function useBillingConfig() {
  return useQuery({
    queryKey: queryKeys.billingConfig,
    queryFn: () => api.get<BillingConfig>('/billing/config'),
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * The tenant's live subscription state. Polled briefly after checkout, because
 * activation arrives asynchronously by webhook and can land after the browser
 * is back on our own pages.
 */
export function useSubscription(options: { pollUntilActive?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: () => api.get<SubscriptionSummary>('/billing/subscription'),
    refetchInterval: (query) =>
      options.pollUntilActive && !query.state.data?.isActive ? 2_000 : false,
  });
}

/** The tenant's payment history, synchronized from the provider by webhook. */
export function useInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices,
    queryFn: () => api.get<InvoiceSummary[]>('/billing/invoices'),
  });
}

/**
 * Start a checkout. Returns the URL to send the browser to.
 *
 * Nothing is charged by this call — it creates the subscription in a pending
 * state, and the payer approves it at the provider. Activation arrives later by
 * webhook, so a successful return here is never treated as proof of payment.
 */
export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (selection: { plan: SubscriptionPlan; interval?: BillingInterval }) =>
      api.post<CheckoutHandle>('/billing/checkout-session', selection),
  });
}

/**
 * Confirm the subscription the provider redirected back with.
 *
 * Closes the window between the payer approving at PayPal and the activation
 * webhook arriving. Without it the billing page can only poll and hope; with it
 * the tenant's real state is known on the first render after the redirect.
 *
 * Grants nothing — the server re-reads the subscription from the provider and
 * stores what it says, exactly as the webhook would.
 */
export function useConfirmCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subscriptionId: string) =>
      api.post<SubscriptionSummary>('/billing/checkout/confirm', { subscriptionId }),
    onSuccess: (subscription) => {
      qc.setQueryData(queryKeys.subscription, subscription);
      void qc.invalidateQueries({ queryKey: queryKeys.session });
      void qc.invalidateQueries({ queryKey: queryKeys.invoices });
    },
  });
}

/** Open the hosted customer portal (payment methods, invoices, receipts). */
export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () => api.post<{ url: string }>('/billing/portal-session'),
  });
}

/**
 * Move to a different plan. Upgrades apply now, downgrades at renewal.
 *
 * May come back with an `approvalUrl`, which means the change has NOT happened
 * yet: the provider needs the payer to consent first. The caller is responsible
 * for sending the browser there — see BillingPage.
 */
export function useChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (selection: { plan: SubscriptionPlan; interval?: BillingInterval }) =>
      api.post<PlanChangeResult>('/billing/subscription/plan', selection),
    onSuccess: ({ approvalUrl, ...subscription }) => {
      // Only cache the subscription when it is the final answer. Writing a
      // pending change into the cache would show the tenant a plan they have not
      // agreed to pay for yet.
      if (!approvalUrl) {
        qc.setQueryData(queryKeys.subscription, subscription);
      }
      void qc.invalidateQueries({ queryKey: queryKeys.invoices });
      void qc.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SubscriptionSummary>('/billing/subscription/cancel'),
    onSuccess: (subscription) => {
      qc.setQueryData(queryKeys.subscription, subscription);
      void qc.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

export function useResumeSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SubscriptionSummary>('/billing/subscription/resume'),
    onSuccess: (subscription) => {
      qc.setQueryData(queryKeys.subscription, subscription);
      void qc.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

// ---------------------------------------------------------------------------
// Telephony
// ---------------------------------------------------------------------------

export function usePhoneNumber() {
  return useQuery({
    queryKey: queryKeys.phoneNumber,
    queryFn: () => api.get<PhoneNumberSummary | null>('/telephony/phone-number'),
  });
}

export function useVerifyForwarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<PhoneNumberSummary>('/telephony/phone-number/verify-forwarding'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.phoneNumber }),
  });
}

/** Purchase the company's dedicated AI number (idempotent; retries failures). */
export function useProvisionPhoneNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<PhoneNumberSummary>('/telephony/phone-number/provision'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.phoneNumber });
      void qc.invalidateQueries({ queryKey: queryKeys.receptionistStatus });
    },
  });
}

export function useReceptionistStatus() {
  return useQuery({
    queryKey: queryKeys.receptionistStatus,
    queryFn: () => api.get<ReceptionistStatus>('/telephony/receptionist/status'),
  });
}

/** The control-center master switch. */
export function useSetReceptionistEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      api.post<ReceptionistStatus>(`/telephony/receptionist/${enabled ? 'enable' : 'disable'}`),
    onSuccess: (status) => {
      qc.setQueryData(queryKeys.receptionistStatus, status);
      void qc.invalidateQueries({ queryKey: queryKeys.company });
    },
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => api.get<DashboardOverview>('/dashboard/overview'),
    refetchInterval: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Calls & conversations
// ---------------------------------------------------------------------------

export interface ListParams {
  page?: number;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export function useCalls(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.calls(params),
    queryFn: () => api.getPaginated<Call>('/calls', params),
    placeholderData: keepPreviousData,
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.conversation(id ?? ''),
    enabled: Boolean(id),
    queryFn: () => api.get<Conversation>(`/conversations/${id}`),
  });
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export function useCustomers(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.customers(params),
    queryFn: () => api.getPaginated<Customer>('/customers', params),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customer(id ?? ''),
    enabled: Boolean(id),
    queryFn: () => api.get<CustomerDetail>(`/customers/${id}`),
  });
}

export function useSaveCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Customer> & { id?: string }) =>
      id ? api.patch<Customer>(`/customers/${id}`, body) : api.post<Customer>('/customers', body),
    // Invalidating the `customers` root covers both the paginated lists and the
    // `['customers','detail',id]` keys, so a profile reflects an edit made from
    // the list and vice versa.
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<null>(`/customers/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

export function useAppointments(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.appointments(params),
    queryFn: () => api.getPaginated<Appointment>('/appointments', params),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Appointment> & { id: string }) =>
      api.patch<Appointment>(`/appointments/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['appointments'] });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------

export function useKnowledgeArticles(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.knowledge(params),
    queryFn: () => api.getPaginated<KnowledgeArticle>('/knowledge-articles', params),
    placeholderData: keepPreviousData,
  });
}

export function useSaveKnowledgeArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<KnowledgeArticle> & { id?: string }) =>
      id
        ? api.patch<KnowledgeArticle>(`/knowledge-articles/${id}`, body)
        : api.post<KnowledgeArticle>('/knowledge-articles', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['knowledge'] }),
  });
}

export function useDeleteKnowledgeArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/knowledge-articles/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['knowledge'] }),
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function useNotifications(
  params: ListParams,
): ReturnType<typeof useQuery<PaginatedResult<Notification>>> {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: () => api.getPaginated<Notification>('/notifications', params),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: () => api.get<{ unreadCount: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch<Notification>(`/notifications/${id}/read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/** Puts one back on the pile — the counterpart to opening it. */
export function useMarkNotificationUnread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch<Notification>(`/notifications/${id}/unread`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ updated: number }>('/notifications/read-all'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: queryKeys.search(q),
    enabled: q.trim().length >= 2,
    queryFn: () => api.get<GlobalSearchResults>('/search', { q }),
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Internal admin portal
//
// Every one of these hits an endpoint behind `PlatformAdminGuard`. A customer
// reaching them gets a 403 from the server — the client-side routing is a
// convenience, never the protection.
// ---------------------------------------------------------------------------

/**
 * The company list, with the platform-wide lifecycle counts attached.
 *
 * The counts ride on the same response as the page they annotate rather than
 * having their own query. That is what stops the summary cards and the table
 * from being one request out of step with each other after an approval — there
 * is only ever one answer in flight.
 */
export type AdminCompanyPage = PaginatedResult<AdminCompanyRow> & {
  counts?: AdminApprovalCounts;
};

export function useAdminCompanies(params: ListParams & { subscription?: string; status?: string }) {
  return useQuery<AdminCompanyPage>({
    queryKey: queryKeys.adminCompanies(params),
    queryFn: async () => {
      const page = await api.getPaginated<AdminCompanyRow>('/admin/companies', params);
      return { ...page, counts: page.metadata?.counts as AdminApprovalCounts | undefined };
    },
    placeholderData: keepPreviousData,
  });
}

export function useAdminCompany(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminCompany(id ?? ''),
    enabled: Boolean(id),
    queryFn: () => api.get<AdminCompanyDetail>(`/admin/companies/${id}`),
  });
}

export function useAdminAnalytics(days: number) {
  return useQuery({
    queryKey: queryKeys.adminAnalytics(days),
    queryFn: () => api.get<AdminAnalytics>('/admin/analytics', { days: String(days) }),
    placeholderData: keepPreviousData,
  });
}

/** The founder decisions, and the status each one lands the tenant in. */
const APPROVAL_ACTIONS = {
  approve: CompanyStatus.ACTIVE,
  pause: CompanyStatus.PAUSED,
  resume: CompanyStatus.ACTIVE,
} as const;

export type ApprovalAction = keyof typeof APPROVAL_ACTIONS;

/**
 * Approve, pause, or resume a tenant.
 *
 * One hook for all three, because they are one operation to the caller: send the
 * decision, paint the outcome immediately, then let the server's answer settle
 * it. Three near-identical hooks would have been three chances for the optimistic
 * update and the rollback to diverge.
 *
 * The optimistic write repaints only the row's status, and only in the list
 * pages already in the cache. It does not invent `approvedAt` or a history entry
 * — those are the server's to say, they arrive milliseconds later with the
 * invalidation, and a fabricated timestamp that turned out wrong would be a
 * worse experience than a field that fills in a moment late.
 *
 * `onError` restores the exact snapshot rather than refetching. A failed pause
 * has to leave the row saying "Active", and refetching would show the true value
 * only after a round trip the founder is already staring at.
 */
export function useCompanyApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: ApprovalAction; reason?: string }) =>
      api.patch<AdminCompanyRow>(
        `/admin/companies/${id}/${action}`,
        action === 'pause' ? { reason } : undefined,
      ),

    onMutate: async ({ id, action }) => {
      // Stop any in-flight list refetch from landing on top of the optimistic
      // write with the pre-decision status.
      await qc.cancelQueries({ queryKey: ['admin', 'companies'] });
      const snapshot = qc.getQueriesData<AdminCompanyPage>({ queryKey: ['admin', 'companies'] });

      const status = APPROVAL_ACTIONS[action];
      for (const [key, page] of snapshot) {
        if (!page?.items) continue;
        qc.setQueryData<AdminCompanyPage>(key, {
          ...page,
          items: page.items.map((row) => (row.id === id ? { ...row, status } : row)),
        });
      }
      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      for (const [key, page] of context?.snapshot ?? []) qc.setQueryData(key, page);
    },

    // Always revalidate, success or failure: the counts, the audit history and
    // every derived field come from the server, and the optimistic write only
    // ever claimed one column.
    onSettled: () => void qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}
