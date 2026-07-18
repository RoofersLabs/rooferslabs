import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HardHat, Building2, Bot, BookOpen, PartyPopper, Check, Plus, X } from 'lucide-react';
import { AiVoice, KnowledgeCategory, OnboardingStep } from '@rooferslabs/shared';
import {
  useCompany,
  useCreateCompany,
  useSaveKnowledgeArticle,
  useSetOnboardingStep,
  useUpdateAiConfig,
  useUpdateCompany,
  useCompleteOnboarding,
  useSessionQuery,
} from '@/hooks/queries';
import { useSessionStore } from '@/state/session.store';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { FullScreenSpinner } from '@/components/ui/Spinner';

const STEPS = [
  { key: OnboardingStep.COMPANY, label: 'Company', icon: Building2 },
  { key: OnboardingStep.BUSINESS, label: 'Business', icon: HardHat },
  { key: OnboardingStep.AI, label: 'AI Receptionist', icon: Bot },
  { key: OnboardingStep.KNOWLEDGE, label: 'Knowledge', icon: BookOpen },
] as const;

/**
 * Guided onboarding wizard implementing the core customer journey:
 * Create Company → Business Configuration → AI Configuration → Knowledge Base
 * → Dashboard. Progress persists on the company record, so users can resume.
 */
export function OnboardingPage() {
  const session = useSessionStore();
  const hasCompany = Boolean(session.company);
  const company = useCompany(hasCompany);

  if (hasCompany && company.isLoading) return <FullScreenSpinner label="Loading your setup…" />;

  const currentStep = hasCompany
    ? (company.data?.onboardingStep ?? OnboardingStep.BUSINESS)
    : OnboardingStep.COMPANY;

  return (
    <div className="min-h-screen bg-surface-2 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700">
            <HardHat className="h-5 w-5 text-white" aria-hidden />
          </span>
          <span className="text-lg font-bold text-ink">RoofersLabs setup</span>
        </div>

        <StepIndicator current={currentStep} />

        <div className="card mt-6 p-6 sm:p-8">
          {currentStep === OnboardingStep.COMPANY && <CompanyStep />}
          {currentStep === OnboardingStep.BUSINESS && <BusinessStep />}
          {currentStep === OnboardingStep.AI && <AiStep />}
          {currentStep === OnboardingStep.KNOWLEDGE && <KnowledgeStep />}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: OnboardingStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center justify-between gap-2" aria-label="Setup progress">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={
                done
                  ? 'flex h-9 w-9 items-center justify-center rounded-full bg-success text-white'
                  : active
                    ? 'flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-white'
                    : 'flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-faint'
              }
            >
              {done ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
            </span>
            <span
              className={active ? 'text-xs font-semibold text-brand-800' : 'text-xs text-ink-muted'}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — create company
// ---------------------------------------------------------------------------

const companySchema = z.object({
  name: z.string().min(2, 'Company name is required').max(120),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().max(32).optional().or(z.literal('')),
  city: z.string().max(120).optional().or(z.literal('')),
  state: z.string().max(64).optional().or(z.literal('')),
});
type CompanyForm = z.infer<typeof companySchema>;

function CompanyStep() {
  const createCompany = useCreateCompany();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyForm>({ resolver: zodResolver(companySchema) });

  const onSubmit = handleSubmit((values) => {
    createCompany.mutate({
      name: values.name,
      email: values.email || undefined,
      phone: values.phone || undefined,
      city: values.city || undefined,
      state: values.state || undefined,
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">Create your company</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Tell us about your roofing business. You can refine everything later in Settings.
        </p>
      </div>
      <Input
        label="Company name"
        placeholder="Summit Roofing Co."
        {...register('name')}
        error={errors.name?.message}
      />
      <Input
        label="Business email"
        type="email"
        placeholder="office@summitroofing.com"
        {...register('email')}
        error={errors.email?.message}
      />
      <Input
        label="Business phone number"
        placeholder="+1 512 555 0100"
        hint="The number your customers already call — you’ll keep it and forward it to your AI line."
        {...register('phone')}
        error={errors.phone?.message}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="City"
          placeholder="Austin"
          {...register('city')}
          error={errors.city?.message}
        />
        <Input
          label="State"
          placeholder="TX"
          {...register('state')}
          error={errors.state?.message}
        />
      </div>
      {createCompany.isError && (
        <p className="text-sm text-emergency">{(createCompany.error as Error).message}</p>
      )}
      <Button type="submit" className="w-full" loading={createCompany.isPending}>
        Create company
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — business configuration
// ---------------------------------------------------------------------------

const DEFAULT_SERVICES = [
  'Roof Replacement',
  'Roof Repair',
  'Storm & Hail Damage',
  'Roof Inspection',
  'Gutter Installation',
  'Commercial Roofing',
];

function BusinessStep() {
  const company = useCompany();
  const updateCompany = useUpdateCompany();
  const setStep = useSetOnboardingStep();

  const [services, setServices] = useState<string[]>(
    company.data?.roofingServices.length ? company.data.roofingServices : [],
  );
  const [areas, setAreas] = useState<string[]>(company.data?.serviceAreas ?? []);
  const [areaInput, setAreaInput] = useState('');
  const [emergencyEnabled, setEmergencyEnabled] = useState(
    company.data?.emergencyServiceEnabled ?? true,
  );
  const [emergencyPhone, setEmergencyPhone] = useState(company.data?.emergencyPhone ?? '');

  const toggleService = (service: string) =>
    setServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service],
    );

  const addArea = () => {
    const value = areaInput.trim();
    if (value && !areas.includes(value)) setAreas((prev) => [...prev, value]);
    setAreaInput('');
  };

  const saving = updateCompany.isPending || setStep.isPending;

  const onContinue = async () => {
    await updateCompany.mutateAsync({
      roofingServices: services,
      serviceAreas: areas,
      emergencyServiceEnabled: emergencyEnabled,
      emergencyPhone: emergencyPhone || undefined,
    });
    await setStep.mutateAsync(OnboardingStep.AI);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink">Configure your business</h1>
        <p className="mt-1 text-sm text-ink-muted">
          The AI uses this to answer callers accurately.
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Services you offer</legend>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_SERVICES.map((service) => {
            const active = services.includes(service);
            return (
              <button
                key={service}
                type="button"
                onClick={() => toggleService(service)}
                className={
                  active
                    ? 'focus-ring rounded-full bg-brand-700 px-3.5 py-1.5 text-xs font-medium text-white'
                    : 'focus-ring rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:border-brand-400'
                }
                aria-pressed={active}
              >
                {service}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="area-input" className="mb-2 block text-sm font-medium text-ink">
          Service areas (cities or ZIP codes)
        </label>
        <div className="flex gap-2">
          <input
            id="area-input"
            value={areaInput}
            onChange={(e) => setAreaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addArea();
              }
            }}
            placeholder="Austin, TX"
            className="focus-ring block w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <Button type="button" variant="secondary" onClick={addArea} aria-label="Add service area">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {areas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {areas.map((area) => (
              <span
                key={area}
                className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-3 py-1 text-xs text-ink"
              >
                {area}
                <button
                  type="button"
                  onClick={() => setAreas((prev) => prev.filter((a) => a !== area))}
                  className="focus-ring rounded-full text-ink-faint hover:text-ink-muted"
                  aria-label={`Remove ${area}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line-subtle p-4">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium text-ink">Emergency service</span>
            <span className="block text-xs text-ink-muted">
              Prioritize active leaks and storm damage calls.
            </span>
          </span>
          <input
            type="checkbox"
            checked={emergencyEnabled}
            onChange={(e) => setEmergencyEnabled(e.target.checked)}
            className="focus-ring h-5 w-5 rounded border-line text-brand-700"
          />
        </label>
        {emergencyEnabled && (
          <div className="mt-3">
            <Input
              label="Emergency contact number (optional)"
              placeholder="+1 512 555 0111"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
            />
          </div>
        )}
      </div>

      {(updateCompany.isError || setStep.isError) && (
        <p className="text-sm text-emergency">
          {((updateCompany.error ?? setStep.error) as Error).message}
        </p>
      )}
      <Button className="w-full" onClick={() => void onContinue()} loading={saving}>
        Continue
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — AI configuration
// ---------------------------------------------------------------------------

const aiSchema = z.object({
  assistantName: z.string().min(2).max(80),
  voice: z.nativeEnum(AiVoice),
  greeting: z.string().min(10, 'Give the AI a friendly opening line').max(500),
  persona: z.string().min(3).max(200),
});
type AiForm = z.infer<typeof aiSchema>;

function AiStep() {
  const sessionCompany = useSessionStore((s) => s.company);
  const updateAi = useUpdateAiConfig();
  const setStep = useSetOnboardingStep();
  const companyName = sessionCompany?.name ?? 'your company';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AiForm>({
    resolver: zodResolver(aiSchema),
    defaultValues: {
      assistantName: `Riley from ${companyName}`,
      voice: AiVoice.ALLOY,
      greeting: `Thanks for calling ${companyName}! This is Riley. How can I help you with your roof today?`,
      persona: 'professional, warm, and efficient',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await updateAi.mutateAsync(values);
    await setStep.mutateAsync(OnboardingStep.KNOWLEDGE);
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">Set up your AI receptionist</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Give it a name, a voice, and the greeting your callers will hear.
        </p>
      </div>
      <Input
        label="Assistant name"
        {...register('assistantName')}
        error={errors.assistantName?.message}
      />
      <Select label="Voice" {...register('voice')} error={errors.voice?.message}>
        {Object.entries(AiVoice).map(([label, value]) => (
          <option key={value} value={value}>
            {label.charAt(0) + label.slice(1).toLowerCase()}
          </option>
        ))}
      </Select>
      <Textarea
        label="Greeting"
        rows={3}
        hint="The first thing callers hear when the AI answers."
        {...register('greeting')}
        error={errors.greeting?.message}
      />
      <Input
        label="Personality"
        hint="A few adjectives, e.g. “professional, warm, and efficient”."
        {...register('persona')}
        error={errors.persona?.message}
      />
      {(updateAi.isError || setStep.isError) && (
        <p className="text-sm text-emergency">
          {((updateAi.error ?? setStep.error) as Error).message}
        </p>
      )}
      <Button type="submit" className="w-full" loading={updateAi.isPending || setStep.isPending}>
        Continue
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — knowledge base seed + finish
// ---------------------------------------------------------------------------

const KNOWLEDGE_PROMPTS: { category: KnowledgeCategory; title: string; placeholder: string }[] = [
  {
    category: KnowledgeCategory.PRICING,
    title: 'Estimates & pricing',
    placeholder:
      'e.g. We offer free, no-obligation estimates. Typical roof replacements range from…',
  },
  {
    category: KnowledgeCategory.WARRANTY,
    title: 'Warranty',
    placeholder: 'e.g. All installations include a 10-year workmanship warranty…',
  },
  {
    category: KnowledgeCategory.FAQ,
    title: 'Insurance & storm damage',
    placeholder: 'e.g. We work directly with insurance carriers on hail and storm claims…',
  },
];

function KnowledgeStep() {
  const saveArticle = useSaveKnowledgeArticle();
  const complete = useCompleteOnboarding();
  const sessionQuery = useSessionQuery(true);
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);

  const filled = useMemo(
    () => KNOWLEDGE_PROMPTS.filter((p) => (answers[p.title] ?? '').trim().length > 0),
    [answers],
  );

  const onFinish = async () => {
    for (const prompt of filled) {
      await saveArticle.mutateAsync({
        title: prompt.title,
        category: prompt.category,
        content: answers[prompt.title]!.trim(),
      });
    }
    await complete.mutateAsync();
    await sessionQuery.refetch();
    setFinished(true);
    setTimeout(() => navigate('/dashboard', { replace: true }), 1600);
  };

  if (finished) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <PartyPopper className="h-12 w-12 text-brand-600" aria-hidden />
        <h1 className="mt-4 text-xl font-bold text-ink">You’re all set!</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your AI receptionist is ready. Taking you to your dashboard…
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          Tip: use “Add to Home Screen” in the header to install RoofersLabs on your phone.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink">Teach your AI the essentials</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Answer any of these in your own words — the AI will use them on calls. You can add much
          more later in the Knowledge Base.
        </p>
      </div>

      {KNOWLEDGE_PROMPTS.map((prompt) => (
        <Textarea
          key={prompt.title}
          label={prompt.title}
          placeholder={prompt.placeholder}
          rows={3}
          value={answers[prompt.title] ?? ''}
          onChange={(e) => setAnswers((prev) => ({ ...prev, [prompt.title]: e.target.value }))}
        />
      ))}

      {(saveArticle.isError || complete.isError) && (
        <p className="text-sm text-emergency">
          {((saveArticle.error ?? complete.error) as Error).message}
        </p>
      )}

      <Button
        className="w-full"
        onClick={() => void onFinish()}
        loading={saveArticle.isPending || complete.isPending}
      >
        {filled.length > 0
          ? `Save ${filled.length} and finish setup`
          : 'Skip for now and finish setup'}
      </Button>
    </div>
  );
}
