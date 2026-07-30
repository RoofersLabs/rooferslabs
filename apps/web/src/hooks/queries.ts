/**
 * TanStack Query hooks — the single data-access layer for the frontend
 *. Components never call fetch.
 */
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
    'id' | 'name' | 'slug' | 'status' | 'onboardingStep' | 'logoUrl' | 'primaryColor'
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
      // Same reason as above, one stage further on: this is what flips the
      // visitor from `onboarding` to `payment`, so without it the final click
      // leaves them sitting on the review screen until a refetch happens to land.
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
 * What the browser needs to open a checkout.
 *
 * Long-lived: the token and environment only change when someone rotates
 * credentials, so this is fetched once and reused rather than re-requested on
 * every mount of the payment page.
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
 * Start a checkout. Returns a handle the caller passes to `openCheckout`,
 * which decides between an in-page overlay and a redirect.
 */
export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (selection: { plan: SubscriptionPlan; interval?: BillingInterval }) =>
      api.post<CheckoutHandle>('/billing/checkout-session', selection),
  });
}

/** Open the hosted customer portal (payment methods, invoices, receipts). */
export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () => api.post<{ url: string }>('/billing/portal-session'),
  });
}

/** Move to a different plan. Upgrades apply now, downgrades at renewal. */
export function useChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (selection: { plan: SubscriptionPlan; interval?: BillingInterval }) =>
      api.post<SubscriptionSummary>('/billing/subscription/plan', selection),
    onSuccess: (subscription) => {
      qc.setQueryData(queryKeys.subscription, subscription);
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

export function useAdminCompanies(params: ListParams & { subscription?: string }) {
  return useQuery({
    queryKey: queryKeys.adminCompanies(params),
    queryFn: () => api.getPaginated<AdminCompanyRow>('/admin/companies', params),
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
