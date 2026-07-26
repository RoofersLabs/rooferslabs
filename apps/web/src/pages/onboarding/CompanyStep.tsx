import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { OnboardingStep } from '@rooferslabs/shared';
import { z } from 'zod';
import { useAccess } from '@/auth/AccessProvider';
import { useCompany, useCreateCompany, useUpdateCompany } from '@/hooks/queries';
import { Field, StepActions, StepError, StepHeading, fieldClass } from './fields';
import { useOnboarding } from './useOnboarding';

/** Mirrors CreateCompanyDto / the matching subset of UpdateCompanyDto. */
const schema = z.object({
  name: z.string().min(2, 'Enter your business name.').max(120),
  email: z.union([z.string().email('Enter a valid email address.'), z.literal('')]),
  phone: z.string().max(32).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(64).optional(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Step 1 — the organization itself.
 *
 * This is the one step that can run before a tenant exists, so it creates the
 * company on first submit and patches it on any later visit. Without that, a
 * user stepping back to fix a typo would hit the API's "already belongs to a
 * company" conflict.
 */
export function CompanyStep() {
  const { onboardingStep } = useAccess();
  const hasCompany = onboardingStep !== null;
  const { advanceFrom } = useOnboarding();

  // Only load the company when one exists; the endpoint is tenant-scoped.
  const company = useCompany(hasCompany);
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // Re-initialise once the existing company arrives, so a revisit is prefilled.
    values: {
      name: company.data?.name ?? '',
      email: company.data?.email ?? '',
      phone: company.data?.phone ?? '',
      city: company.data?.city ?? '',
      state: company.data?.state ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    // The API rejects empty strings on optional fields, so send only what is filled in.
    const body = {
      name: values.name,
      ...(values.email ? { email: values.email } : {}),
      ...(values.phone ? { phone: values.phone } : {}),
      ...(values.city ? { city: values.city } : {}),
      ...(values.state ? { state: values.state } : {}),
    };

    if (hasCompany) {
      await updateCompany.mutateAsync(body);
    } else {
      await createCompany.mutateAsync(body);
    }
    await advanceFrom(OnboardingStep.COMPANY);
  });

  if (hasCompany && company.isLoading) {
    return <p className="text-sm text-gray-600">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <StepHeading
        title="Create your organization"
        blurb="Tell us about your business. This takes about two minutes."
      />

      <form onSubmit={onSubmit} className="space-y-4 rounded border border-gray-200 bg-white p-6">
        <Field label="Business name" htmlFor="name" error={errors.name}>
          <input id="name" className={fieldClass} {...register('name')} />
        </Field>

        <Field label="Business email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" className={fieldClass} {...register('email')} />
        </Field>

        <Field
          label="Business phone"
          htmlFor="phone"
          error={errors.phone}
          hint="The number customers already call. You keep it — calls forward to your AI."
        >
          <input
            id="phone"
            className={fieldClass}
            placeholder="+15125550100"
            {...register('phone')}
          />
        </Field>

        <div className="flex gap-4">
          <div className="flex-1">
            <Field label="City" htmlFor="city" error={errors.city}>
              <input id="city" className={fieldClass} {...register('city')} />
            </Field>
          </div>
          <div className="w-24">
            <Field label="State" htmlFor="state" error={errors.state}>
              <input id="state" className={fieldClass} {...register('state')} />
            </Field>
          </div>
        </div>

        <StepError error={createCompany.error ?? updateCompany.error} />
        <StepActions submitting={isSubmitting} />
      </form>
    </div>
  );
}
