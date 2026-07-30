import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AiVoice, OnboardingStep } from '@rooferslabs/shared';
import { z } from 'zod';
import { stepPath } from '@/auth/stages';
import { useAiConfig, useUpdateAiConfig } from '@/hooks/queries';
import { Checkbox } from '@/components/ui/input';
import {
  Field,
  FieldGroup,
  RevealedField,
  StepActions,
  StepCard,
  StepError,
  StepHeading,
  StepLoading,
  ToggleCard,
  fieldClass,
  selectClass,
  textareaClass,
} from './fields';
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

const VOICES: { value: AiVoice; name: string; character: string }[] = [
  { value: AiVoice.ALLOY, name: 'Alloy', character: 'neutral, even' },
  { value: AiVoice.ASH, name: 'Ash', character: 'warm, grounded' },
  { value: AiVoice.CORAL, name: 'Coral', character: 'bright, friendly' },
  { value: AiVoice.ECHO, name: 'Echo', character: 'calm, measured' },
  { value: AiVoice.SAGE, name: 'Sage', character: 'steady, reassuring' },
  { value: AiVoice.SHIMMER, name: 'Shimmer', character: 'light, upbeat' },
  { value: AiVoice.VERSE, name: 'Verse', character: 'expressive' },
];

/**
 * The display name for a stored voice id, so the review step can show "Sage"
 * where the record holds `sage`. Derived from the list above rather than
 * written twice, which is what stops the two drifting.
 */
export const VOICE_NAMES: Record<string, string> = Object.fromEntries(
  VOICES.map((voice) => [voice.value, voice.name]),
);

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
  const capabilities = useWatch({
    control,
    name: ['captureLeads', 'detectEmergencies', 'requestAppointments'],
  });

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

  if (config.isLoading) return <StepLoading />;

  return (
    <div className="space-y-8 sm:space-y-10">
      <StepHeading
        title="Your AI receptionist"
        blurb="How it introduces itself, and what it handles while you’re on a roof."
      />

      <StepCard onSubmit={onSubmit}>
        <Field label="Receptionist name" htmlFor="assistantName" error={errors.assistantName}>
          <input
            id="assistantName"
            className={fieldClass}
            placeholder="Riley"
            autoComplete="off"
            {...register('assistantName')}
          />
        </Field>

        <Field label="Voice" htmlFor="voice" error={errors.voice}>
          <select id="voice" className={selectClass} {...register('voice')}>
            {VOICES.map((voice) => (
              <option key={voice.value} value={voice.value}>
                {voice.name} — {voice.character}
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
            className={textareaClass}
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

        <FieldGroup label="What it handles">
          <div className="space-y-2.5">
            {CAPABILITIES.map((capability, index) => (
              <ToggleCard
                key={capability.name}
                checked={Boolean(capabilities[index])}
                title={capability.label}
                blurb={capability.blurb}
              >
                <Checkbox {...register(capability.name)} />
              </ToggleCard>
            ))}
          </div>
        </FieldGroup>

        {/* Escalation is a different question from what the receptionist can do
            on its own, so it gets a rule rather than another panel in the stack. */}
        <div className="space-y-4 border-t border-line-subtle pt-6">
          <ToggleCard checked={Boolean(transferToHuman)} title="Transfer to a person on request">
            <Checkbox {...register('transferToHuman')} />
          </ToggleCard>
          {transferToHuman && (
            <RevealedField>
              <Field label="Transfer number" htmlFor="transferPhone" error={errors.transferPhone}>
                <input
                  id="transferPhone"
                  type="tel"
                  className={fieldClass}
                  placeholder="+15125550100"
                  {...register('transferPhone')}
                />
              </Field>
            </RevealedField>
          )}
        </div>

        <StepError error={updateConfig.error} />
        <StepActions
          submitting={isSubmitting}
          onBack={() => navigate(stepPath(OnboardingStep.BUSINESS))}
        />
      </StepCard>
    </div>
  );
}
