'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { User } from '@lulwah/contracts';
import { Button, Input } from '@lulwah/ui';
import { apiRequest } from '../../lib/api-client';
import { setSession } from '../../lib/auth-session';
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

const LoginResponse = z.object({ user: User, accessToken: z.string() });

/**
 * `POST /auth/login` (plan.md §9.3) is real now — see
 * `docs/implemented-plan.md`'s note that `apps/api`'s catalog/inventory
 * modules (and the `identity` module it depends on) shipped in this phase.
 * On success the access token + user are handed to `lib/auth-session.ts` so
 * `api-client.ts` can attach `Authorization: Bearer <token>` to every
 * subsequent admin request — without this, the Products/Inventory screens
 * this task builds would 401 on every call.
 */
export default function LoginPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginFormValues>({ resolver: zodResolver(AdminLoginFormValues) });

  const onSubmit = async (values: AdminLoginFormValues) => {
    setSubmitError(null);
    try {
      const result = await apiRequest('/auth/login', LoginResponse, {
        method: 'POST',
        body: { email: values.email, password: values.password },
      });
      setSession({
        accessToken: result.accessToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
      });
      router.push('/');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to sign in.');
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
