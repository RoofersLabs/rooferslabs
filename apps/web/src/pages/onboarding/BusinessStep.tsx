import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { OnboardingStep } from '@rooferslabs/shared';
import { z } from 'zod';
import { stepPath } from '@/auth/stages';
import { useCompany, useSetBusinessHours, useUpdateCompany } from '@/hooks/queries';
import type { BusinessHour } from '@/types/api';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/input';
import {
  Field,
  StepActions,
  StepError,
  StepHeading,
  StepLoading,
  fieldClass,
  labelClass,
  textareaClass,
} from './fields';
import { useOnboarding } from './useOnboarding';

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Mirrors the subset of UpdateCompanyDto this step owns, plus business hours. */
const schema = z.object({
  addressLine1: z.string().max(200).optional(),
  postalCode: z.string().max(16).optional(),
  timezone: z.string().min(1, 'Choose a timezone.').max(64),
  serviceAreas: z.string().max(2000).optional(),
  roofingServices: z.string().max(2000).optional(),
  emergencyServiceEnabled: z.boolean(),
  emergencyPhone: z.string().max(32).optional(),
  hours: z
    .array(
      z.object({
        day: z.enum(DAYS),
        open: z.string().regex(TIME, 'Use HH:mm (24-hour).'),
        close: z.string().regex(TIME, 'Use HH:mm (24-hour).'),
        closed: z.boolean(),
      }),
    )
    .length(7),
});

type FormValues = z.infer<typeof schema>;

/** Weekdays open, weekend closed — the shape most roofing companies start from. */
const DEFAULT_HOURS: BusinessHour[] = DAYS.map((day) => ({
  day,
  open: '07:00',
  close: '18:00',
  closed: day === 'saturday' || day === 'sunday',
}));

/** Comma/newline separated free text → the string[] the API expects. */
const toList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

/**
 * Step 2 — where the company works and when. These answers drive how the AI
 * answers calls, so they are collected before the receptionist is configured.
 */
export function BusinessStep() {
  const navigate = useNavigate();
  const { advanceFrom } = useOnboarding();
  const company = useCompany();
  const updateCompany = useUpdateCompany();
  const setHours = useSetBusinessHours();

  const existingHours = company.data?.businessHours;
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      addressLine1: company.data?.addressLine1 ?? '',
      postalCode: company.data?.postalCode ?? '',
      timezone: company.data?.timezone ?? 'America/Chicago',
      serviceAreas: (company.data?.serviceAreas ?? []).join(', '),
      roofingServices: (company.data?.roofingServices ?? []).join(', '),
      emergencyServiceEnabled: company.data?.emergencyServiceEnabled ?? false,
      emergencyPhone: company.data?.emergencyPhone ?? '',
      hours:
        existingHours && existingHours.length === 7
          ? existingHours.map((hour) => ({
              day: hour.day as (typeof DAYS)[number],
              open: hour.open,
              close: hour.close,
              closed: hour.closed,
            }))
          : DEFAULT_HOURS.map((hour) => ({ ...hour, day: hour.day as (typeof DAYS)[number] })),
    },
  });

  const emergencyEnabled = useWatch({ control, name: 'emergencyServiceEnabled' });

  const onSubmit = handleSubmit(async (values) => {
    await updateCompany.mutateAsync({
      timezone: values.timezone,
      serviceAreas: toList(values.serviceAreas),
      roofingServices: toList(values.roofingServices),
      emergencyServiceEnabled: values.emergencyServiceEnabled,
      ...(values.addressLine1 ? { addressLine1: values.addressLine1 } : {}),
      ...(values.postalCode ? { postalCode: values.postalCode } : {}),
      ...(values.emergencyServiceEnabled && values.emergencyPhone
        ? { emergencyPhone: values.emergencyPhone }
        : {}),
    });
    await setHours.mutateAsync(values.hours);
    await advanceFrom(OnboardingStep.BUSINESS);
  });

  if (company.isLoading) return <StepLoading />;

  return (
    <div className="space-y-8">
      <StepHeading
        title="Business details"
        blurb="Where you work and when. Your AI receptionist uses this to answer questions and book jobs."
      />

      <Card as="form" onSubmit={onSubmit} className="gap-6 px-6 py-6">
        <Field label="Street address" htmlFor="addressLine1" error={errors.addressLine1}>
          <input id="addressLine1" className={fieldClass} {...register('addressLine1')} />
        </Field>

        <div className="flex gap-4">
          <div className="w-32">
            <Field label="ZIP" htmlFor="postalCode" error={errors.postalCode}>
              <input id="postalCode" className={fieldClass} {...register('postalCode')} />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Timezone" htmlFor="timezone" error={errors.timezone}>
              <select
                id="timezone"
                className={cn(fieldClass, 'cursor-pointer pr-8')}
                {...register('timezone')}
              >
                <option value="America/New_York">Eastern</option>
                <option value="America/Chicago">Central</option>
                <option value="America/Denver">Mountain</option>
                <option value="America/Phoenix">Arizona</option>
                <option value="America/Los_Angeles">Pacific</option>
              </select>
            </Field>
          </div>
        </div>

        <Field
          label="Service areas"
          htmlFor="serviceAreas"
          error={errors.serviceAreas}
          hint="Cities or ZIP codes you cover, separated by commas."
        >
          <textarea
            id="serviceAreas"
            rows={2}
            className={textareaClass}
            placeholder="Austin TX, Round Rock TX, 78701"
            {...register('serviceAreas')}
          />
        </Field>

        <Field
          label="Services offered"
          htmlFor="roofingServices"
          error={errors.roofingServices}
          hint="Separated by commas."
        >
          <textarea
            id="roofingServices"
            rows={2}
            className={textareaClass}
            placeholder="Roof replacement, Roof repair, Storm damage, Inspections"
            {...register('roofingServices')}
          />
        </Field>

        <fieldset>
          <legend className={labelClass}>Business hours</legend>
          <div className="mt-2 space-y-2">
            {DAYS.map((day, index) => (
              <div
                key={day}
                className="flex flex-wrap items-center gap-3 rounded-md border border-line-subtle px-4 py-2.5 transition-colors duration-fast hover:border-line-strong"
              >
                <span className="w-24 shrink-0 text-body font-medium capitalize text-ink">
                  {day}
                </span>
                <input
                  aria-label={`${day} opening time`}
                  className={cn(fieldClass, 'mt-0 w-28')}
                  {...register(`hours.${index}.open`)}
                />
                <span className="text-small text-ink-faint">to</span>
                <input
                  aria-label={`${day} closing time`}
                  className={cn(fieldClass, 'mt-0 w-28')}
                  {...register(`hours.${index}.close`)}
                />
                <label className="ml-auto flex cursor-pointer items-center gap-2 text-small text-ink-muted">
                  <Checkbox {...register(`hours.${index}.closed`)} />
                  Closed
                </label>
                <input type="hidden" {...register(`hours.${index}.day`)} />
              </div>
            ))}
          </div>
          {errors.hours && (
            <p className="mt-1.5 text-small text-emergency" role="alert">
              Check the opening and closing times — each must be HH:mm (24-hour).
            </p>
          )}
        </fieldset>

        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3 text-body font-medium text-ink">
            <Checkbox {...register('emergencyServiceEnabled')} />
            Offer 24/7 emergency service
          </label>
          {emergencyEnabled && (
            <Field
              label="Emergency contact number"
              htmlFor="emergencyPhone"
              error={errors.emergencyPhone}
              hint="Where urgent calls are escalated outside business hours."
            >
              <input
                id="emergencyPhone"
                className={fieldClass}
                placeholder="+15125550100"
                {...register('emergencyPhone')}
              />
            </Field>
          )}
        </div>

        <StepError error={updateCompany.error ?? setHours.error} />
        <StepActions
          submitting={isSubmitting}
          onBack={() => navigate(stepPath(OnboardingStep.COMPANY))}
        />
      </Card>
    </div>
  );
}
