'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
 * `?redirect=` is set by `api-client.ts#handleUnauthorized` (the admin's
 * 401 guard — see that function's own doc comment) so a session that
 * expired mid-visit returns the admin to the page they were on, not the
 * dashboard root. Only ever trust a same-origin relative path from it —
 * this value is attacker-controllable (anyone can craft
 * `/login?redirect=https://evil.example`), so anything that isn't a bare
 * `/`-rooted path (no scheme, no `//` — that second check is what stops
 * a protocol-relative URL like `//evil.example` from slipping through as
 * "starts with /") is rejected in favour of the safe default.
 */
function safeRedirectTarget(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

/**
 * `POST /auth/login` (plan.md §9.3) is real now — see
 * `docs/implemented-plan.md`'s note that `apps/api`'s catalog/inventory
 * modules (and the `identity` module it depends on) shipped in this phase.
 * On success the access token + user are handed to `lib/auth-session.ts` so
 * `api-client.ts` can attach `Authorization: Bearer <token>` to every
 * subsequent admin request — without this, the Products/Inventory screens
 * this task builds would 401 on every call.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      router.push(safeRedirectTarget(searchParams.get('redirect')));
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
