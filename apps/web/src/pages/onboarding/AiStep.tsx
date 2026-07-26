import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AiVoice, OnboardingStep } from '@rooferslabs/shared';
import { z } from 'zod';
import { stepPath } from '@/auth/stages';
import { useAiConfig, useUpdateAiConfig } from '@/hooks/queries';
import { Field, StepActions, StepError, StepHeading, fieldClass, labelClass } from './fields';
import { useOnboarding } from './useOnboarding';

/** Mirrors UpdateAiConfigurationDto. */
const schema = z
  .object({
    assistantName: z.string().min(1, 'Give your receptionist a name.').max(80),
    voice: z.nativeEnum(AiVoice),
    greeting: z.string().min(1, 'Enter the greeting callers hear.').max(500),
    persona: z.string().max(200).optional(),
    captureLeads: z.boolean(),
    detectEmergencies: z.boolean(),
    requestAppointments: z.boolean(),
    transferToHuman: z.boolean(),
    transferPhone: z.string().max(32).optional(),
  })
  .refine((value) => !value.transferToHuman || Boolean(value.transferPhone?.trim()), {
    message: 'Enter the number to transfer callers to.',
    path: ['transferPhone'],
  });

type FormValues = z.infer<typeof schema>;

const VOICES: { value: AiVoice; label: string }[] = [
  { value: AiVoice.ALLOY, label: 'Alloy — neutral, even' },
  { value: AiVoice.ASH, label: 'Ash — warm, grounded' },
  { value: AiVoice.CORAL, label: 'Coral — bright, friendly' },
  { value: AiVoice.ECHO, label: 'Echo — calm, measured' },
  { value: AiVoice.SAGE, label: 'Sage — steady, reassuring' },
  { value: AiVoice.SHIMMER, label: 'Shimmer — light, upbeat' },
  { value: AiVoice.VERSE, label: 'Verse — expressive' },
];

const CAPABILITIES = [
  {
    name: 'captureLeads' as const,
    label: 'Capture leads',
    blurb: 'Collect name, number, address and job details on every call.',
  },
  {
    name: 'detectEmergencies' as const,
    label: 'Detect emergencies',
    blurb: 'Flag active leaks and storm damage for immediate follow-up.',
  },
  {
    name: 'requestAppointments' as const,
    label: 'Request appointments',
    blurb: 'Offer inspection slots and record the caller’s preferred time.',
  },
];

/** Step 3 — how the receptionist sounds and what it is allowed to do. */
export function AiStep() {
  const navigate = useNavigate();
  const { advanceFrom } = useOnboarding();
  const config = useAiConfig();
  const updateConfig = useUpdateAiConfig();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      assistantName: config.data?.assistantName ?? '',
      voice: (config.data?.voice as AiVoice) ?? AiVoice.ALLOY,
      greeting: config.data?.greeting ?? '',
      persona: config.data?.persona ?? 'professional, warm, and efficient',
      captureLeads: config.data?.captureLeads ?? true,
      detectEmergencies: config.data?.detectEmergencies ?? true,
      requestAppointments: config.data?.requestAppointments ?? true,
      transferToHuman: config.data?.transferToHuman ?? false,
      transferPhone: config.data?.transferPhone ?? '',
    },
  });

  const transferToHuman = useWatch({ control, name: 'transferToHuman' });

  const onSubmit = handleSubmit(async (values) => {
    await updateConfig.mutateAsync({
      assistantName: values.assistantName,
      voice: values.voice,
      greeting: values.greeting,
      captureLeads: values.captureLeads,
      detectEmergencies: values.detectEmergencies,
      requestAppointments: values.requestAppointments,
      transferToHuman: values.transferToHuman,
      ...(values.persona ? { persona: values.persona } : {}),
      ...(values.transferToHuman && values.transferPhone
        ? { transferPhone: values.transferPhone }
        : {}),
    });
    await advanceFrom(OnboardingStep.AI);
  });

  if (config.isLoading) return <p className="text-sm text-gray-600">Loading…</p>;

  return (
    <div className="space-y-8">
      <StepHeading
        title="Your AI receptionist"
        blurb="How it introduces itself, and what it handles while you’re on a roof."
      />

      <form onSubmit={onSubmit} className="space-y-6 rounded border border-gray-200 bg-white p-6">
        <Field label="Receptionist name" htmlFor="assistantName" error={errors.assistantName}>
          <input
            id="assistantName"
            className={fieldClass}
            placeholder="Riley"
            {...register('assistantName')}
          />
        </Field>

        <Field label="Voice" htmlFor="voice" error={errors.voice}>
          <select id="voice" className={fieldClass} {...register('voice')}>
            {VOICES.map((voice) => (
              <option key={voice.value} value={voice.value}>
                {voice.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Greeting"
          htmlFor="greeting"
          error={errors.greeting}
          hint="The first thing every caller hears."
        >
          <textarea
            id="greeting"
            rows={2}
            className={fieldClass}
            placeholder="Thanks for calling Summit Roofing — this is Riley. How can I help?"
            {...register('greeting')}
          />
        </Field>

        <Field
          label="Tone"
          htmlFor="persona"
          error={errors.persona}
          hint="A short description of how it should come across."
        >
          <input id="persona" className={fieldClass} {...register('persona')} />
        </Field>

        <fieldset>
          <legend className={labelClass}>What it handles</legend>
          <div className="mt-2 space-y-3">
            {CAPABILITIES.map((capability) => (
              <label key={capability.name} className="flex gap-2.5 text-sm">
                <input type="checkbox" className="mt-1" {...register(capability.name)} />
                <span>
                  <span className="font-medium text-gray-900">{capability.label}</span>
                  <span className="block text-gray-600">{capability.blurb}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" {...register('transferToHuman')} />
            Transfer to a person on request
          </label>
          {transferToHuman && (
            <Field label="Transfer number" htmlFor="transferPhone" error={errors.transferPhone}>
              <input
                id="transferPhone"
                className={fieldClass}
                placeholder="+15125550100"
                {...register('transferPhone')}
              />
            </Field>
          )}
        </div>

        <StepError error={updateConfig.error} />
        <StepActions
          submitting={isSubmitting}
          onBack={() => navigate(stepPath(OnboardingStep.BUSINESS))}
        />
      </form>
    </div>
  );
}
