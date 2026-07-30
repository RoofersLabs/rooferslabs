import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { OnboardingStep } from '@rooferslabs/shared';
import { z } from 'zod';
import { stepPath } from '@/auth/stages';
import { useCompany, useSetBusinessHours, useUpdateCompany } from '@/hooks/queries';
import type { BusinessHour } from '@/types/api';
import { cn } from '@/lib/utils';
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
  // Watched only to mute a closed day's times; the values themselves are
  // untouched, so a day reopened later still has the hours it had before.
  const hours = useWatch({ control, name: 'hours' });

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
    <div className="space-y-8 sm:space-y-10">
      <StepHeading
        title="Business details"
        blurb="Where you work and when. Your AI receptionist uses this to answer questions and book jobs."
      />

      <StepCard onSubmit={onSubmit}>
        <Field label="Street address" htmlFor="addressLine1" error={errors.addressLine1}>
          <input
            id="addressLine1"
            className={fieldClass}
            autoComplete="address-line1"
            {...register('addressLine1')}
          />
        </Field>

        <div className="flex gap-4">
          <div className="w-24 shrink-0 sm:w-32">
            <Field label="ZIP" htmlFor="postalCode" error={errors.postalCode}>
              <input
                id="postalCode"
                className={fieldClass}
                autoComplete="postal-code"
                {...register('postalCode')}
              />
            </Field>
          </div>
          <div className="min-w-0 flex-1">
            <Field label="Timezone" htmlFor="timezone" error={errors.timezone}>
              <select id="timezone" className={selectClass} {...register('timezone')}>
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

        {/* Seven days drawn as seven bordered boxes read as seven separate
            questions. One bordered list divided by hairlines reads as one
            answer with seven lines, which is what it is. */}
        <FieldGroup
          label="Business hours"
          hint="Times are 24-hour, as HH:mm."
          error={
            errors.hours
              ? 'Check the opening and closing times — each must be HH:mm (24-hour).'
              : undefined
          }
        >
          <div className="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line">
            {DAYS.map((day, index) => {
              const closed = hours?.[index]?.closed ?? false;
              return (
                <div
                  key={day}
                  className={cn(
                    'grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-3 transition-colors duration-fast ease-standard sm:grid-cols-[6.5rem_1fr_auto]',
                    closed ? 'bg-surface-2' : 'hover:bg-surface-2',
                  )}
                >
                  <span
                    className={cn(
                      'col-start-1 row-start-1 text-body font-medium capitalize',
                      closed ? 'text-ink-faint' : 'text-ink',
                    )}
                  >
                    {day}
                  </span>

                  {/* Below `sm` the times drop to their own row rather than
                      wrapping mid-pair and orphaning the word "to". */}
                  <div className="col-span-2 col-start-1 row-start-2 flex items-center gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    <input
                      aria-label={`${day} opening time`}
                      className={cn(
                        fieldClass,
                        'font-num mt-0 w-24 px-2 text-center',
                        closed && 'text-ink-faint',
                      )}
                      {...register(`hours.${index}.open`)}
                    />
                    <span className="text-small text-ink-faint">to</span>
                    <input
                      aria-label={`${day} closing time`}
                      className={cn(
                        fieldClass,
                        'font-num mt-0 w-24 px-2 text-center',
                        closed && 'text-ink-faint',
                      )}
                      {...register(`hours.${index}.close`)}
                    />
                  </div>

                  {/* The negative margin buys the tick a 36px-tall hit area
                      without the row growing to match it. */}
                  <label className="col-start-2 row-start-1 -my-2 flex cursor-pointer items-center gap-2 justify-self-end py-2 text-small text-ink-muted sm:col-start-3">
                    <Checkbox {...register(`hours.${index}.closed`)} />
                    Closed
                  </label>

                  <input type="hidden" {...register(`hours.${index}.day`)} />
                </div>
              );
            })}
          </div>
        </FieldGroup>

        {/* Out-of-hours cover is a policy question, not another opening time. */}
        <div className="space-y-4 border-t border-line-subtle pt-6">
          <ToggleCard checked={Boolean(emergencyEnabled)} title="Offer 24/7 emergency service">
            <Checkbox {...register('emergencyServiceEnabled')} />
          </ToggleCard>
          {emergencyEnabled && (
            <RevealedField>
              <Field
                label="Emergency contact number"
                htmlFor="emergencyPhone"
                error={errors.emergencyPhone}
                hint="Where urgent calls are escalated outside business hours."
              >
                <input
                  id="emergencyPhone"
                  type="tel"
                  className={fieldClass}
                  placeholder="+15125550100"
                  {...register('emergencyPhone')}
                />
              </Field>
            </RevealedField>
          )}
        </div>

        <StepError error={updateCompany.error ?? setHours.error} />
        <StepActions
          submitting={isSubmitting}
          onBack={() => navigate(stepPath(OnboardingStep.COMPANY))}
        />
      </StepCard>
    </div>
  );
}
