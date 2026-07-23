import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useCreateCompany } from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';

/** Mirrors CreateCompanyDto on the backend. */
const schema = z.object({
  name: z.string().min(2, 'Enter your business name.').max(120),
  email: z.union([z.string().email('Enter a valid email address.'), z.literal('')]),
  phone: z.string().max(32).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(64).optional(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Organization creation — step 3 of the flow (account → auth → organization →
 * payment). Creating the company is free; the payment wall comes next.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const createCompany = useCreateCompany();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', city: '', state: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    // The API rejects unknown and empty-string fields, so only send what is filled in.
    await createCompany.mutateAsync({
      name: values.name,
      ...(values.email ? { email: values.email } : {}),
      ...(values.phone ? { phone: values.phone } : {}),
      ...(values.city ? { city: values.city } : {}),
      ...(values.state ? { state: values.state } : {}),
    });
    navigate('/payment', { replace: true });
  });

  const field = 'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm';
  const label = 'block text-sm font-medium text-gray-700';

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-bold">Create your organization</h1>
      <p className="mt-2 text-sm text-gray-600">
        Tell us about your business. You will choose a plan on the next step.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-4 rounded border border-gray-200 bg-white p-6"
      >
        <div>
          <label className={label} htmlFor="name">
            Business name
          </label>
          <input id="name" className={field} {...register('name')} />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>

        <div>
          <label className={label} htmlFor="email">
            Business email
          </label>
          <input id="email" type="email" className={field} {...register('email')} />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label className={label} htmlFor="phone">
            Business phone
          </label>
          <input id="phone" className={field} placeholder="+15125550100" {...register('phone')} />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className={label} htmlFor="city">
              City
            </label>
            <input id="city" className={field} {...register('city')} />
          </div>
          <div className="w-24">
            <label className={label} htmlFor="state">
              State
            </label>
            <input id="state" className={field} {...register('state')} />
          </div>
        </div>

        {createCompany.isError && (
          <p className="text-sm text-red-600">
            {(createCompany.error as ApiError).message || 'Could not create the organization.'}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Creating…' : 'Continue to payment'}
        </button>
      </form>
    </main>
  );
}
