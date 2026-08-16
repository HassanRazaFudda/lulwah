'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Input } from '@lulwah/ui';
import { apiRequest } from '../../lib/api-client';
import { AdminLoginFormValues } from '../../lib/login-schema';

/** `Input.errorMessage` is `string` (optional key, no `| undefined` in its
 *  own type — plan.md §27.1's `exactOptionalPropertyTypes` rejects
 *  explicitly assigning `undefined` to it), but `react-hook-form`'s
 *  `errors.field?.message` is `string | undefined`. Spreading this instead
 *  of passing the prop directly omits the key entirely when there's no
 *  error, rather than setting it to `undefined`. */
function errorMessageProp(message: string | undefined): { errorMessage: string } | Record<string, never> {
  return message === undefined ? {} : { errorMessage: message };
}

/**
 * plan.md §10.1: "Admin accounts: mandatory TOTP 2FA... separate cookie
 * domain (admin.lulwah.ae)." Email + password + the 6-digit authenticator
 * code are collected in one form (not a second screen) and validated
 * client-side with the same Zod shape `react-hook-form`'s resolver uses
 * (plan.md §4.1: "Same Zod schemas shared with the API via
 * packages/contracts"). `POST /auth/login` doesn't exist as a real
 * endpoint yet — `apps/api` is a separate, in-progress workstream — so
 * submit calls the placeholder `NEXT_PUBLIC_API_URL` and surfaces whatever
 * comes back (a network error, today) as a form-level banner rather than
 * faking success.
 */
export default function LoginPage() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginFormValues>({ resolver: zodResolver(AdminLoginFormValues) });

  const onSubmit = async (values: AdminLoginFormValues) => {
    setSubmitError(null);
    try {
      await apiRequest('/auth/login', z.object({ sessionId: z.string() }), {
        method: 'POST',
        body: { email: values.email, password: values.password, totpCode: values.totpCode },
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? `${error.message} (expected until apps/api ships — this form's validation and wiring are real)`
          : 'Unable to sign in.',
      );
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-nacre px-24">
      <form
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex w-full max-w-[380px] flex-col gap-16 border border-line bg-paper p-32"
        noValidate
      >
        <div>
          <p className="text-label font-semibold uppercase tracking-label text-zamurrad">Lulwah Admin</p>
          <h1 className="mt-4 text-heading-2 font-semibold text-ink">Sign in</h1>
        </div>

        <Input label="Email" type="email" autoComplete="email" {...errorMessageProp(errors.email?.message)} {...register('email')} />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          {...errorMessageProp(errors.password?.message)}
          {...register('password')}
        />
        <Input
          label="Authenticator code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          {...errorMessageProp(errors.totpCode?.message)}
          {...register('totpCode')}
        />

        {submitError ? (
          <p role="alert" className="text-body-sm text-danger">
            {submitError}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
