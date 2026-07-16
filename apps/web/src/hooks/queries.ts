/**
 * TanStack Query hooks — the single data-access layer for the frontend
 * (docs/04_Frontend_Architecture §12/§23). Components never call fetch.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import type { OnboardingStep } from '@rooferslabs/shared';
import { api, type PaginatedResult } from '@/lib/api-client';
import { useSessionStore } from '@/state/session.store';
import type {
  AiConfiguration,
  Appointment,
  BusinessHour,
  Call,
  Company,
  Conversation,
  Customer,
  DashboardOverview,
  GlobalSearchResults,
  KnowledgeArticle,
  Notification,
  PhoneNumberSummary,
  Session,
} from '@/types/api';

export const queryKeys = {
  session: ['session'] as const,
  company: ['company'] as const,
  aiConfig: ['company', 'ai-config'] as const,
  phoneNumber: ['company', 'phone-number'] as const,
  dashboard: ['dashboard'] as const,
  calls: (params: object) => ['calls', params] as const,
  call: (id: string) => ['calls', 'detail', id] as const,
  conversations: (params: object) => ['conversations', params] as const,
  conversation: (id: string) => ['conversations', 'detail', id] as const,
  customers: (params: object) => ['customers', params] as const,
  customer: (id: string) => ['customers', 'detail', id] as const,
  appointments: (params: object) => ['appointments', params] as const,
  knowledge: (params: object) => ['knowledge', params] as const,
  notifications: (params: object) => ['notifications', params] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  search: (q: string) => ['search', q] as const,
};

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export function useSessionQuery(enabled: boolean) {
  const setSession = useSessionStore((s) => s.setSession);
  return useQuery({
    queryKey: queryKeys.session,
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const session = await api.get<Session>('/auth/me');
      setSession(session);
      return session;
    },
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
    mutationFn: (body: { name: string; email?: string; phone?: string; city?: string; state?: string }) =>
      api.post<Company>('/companies', body),
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

export function useSetOnboardingStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (step: OnboardingStep) => api.patch<Company>('/companies/me/onboarding', { step }),
    onSuccess: (company) => {
      qc.setQueryData(queryKeys.company, company);
      void qc.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Company>('/companies/me/onboarding/complete'),
    onSuccess: (company) => {
      qc.setQueryData(queryKeys.company, company);
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

export function useConversations(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.conversations(params),
    queryFn: () => api.getPaginated<Conversation>('/conversations', params),
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
    queryFn: () => api.get<Customer>(`/customers/${id}`),
  });
}

export function useSaveCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Customer> & { id?: string }) =>
      id ? api.patch<Customer>(`/customers/${id}`, body) : api.post<Customer>('/customers', body),
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

export function useNotifications(params: ListParams): ReturnType<typeof useQuery<PaginatedResult<Notification>>> {
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
