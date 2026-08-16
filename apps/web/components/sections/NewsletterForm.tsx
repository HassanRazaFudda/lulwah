'use client';

import { useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Input, cx } from '@lulwah/ui';
import { useTranslations } from 'next-intl';
import { errorMessageProp } from '@/lib/form-error';

/**
 * Newsletter sign-up — plan.md §15.1 (footer) and §15.2 item 11 (the home
 * page's dedicated emerald panel). One shared component, styled two ways
 * via `variant`, so the validation rule and submit behaviour exist in
 * exactly one place. No real subscription endpoint is wired yet (§25 —
 * this ships alongside the rest of the API integration); submit just
 * simulates the round trip so the success/error states are real.
 */
const NewsletterSchema = z.object({
  email: z.string().min(1, 'Enter your email address.').email('Enter a valid email address.'),
  // PDPL consent — plan.md §15.1: "newsletter with an explicit consent
  // checkbox (PDPL)". A bare `z.boolean()` would accept `false`; `.refine`
  // is what actually makes the checkbox required.
  consent: z.boolean().refine((value) => value === true, {
    message: 'Please agree to receive marketing emails to subscribe.',
  }),
});
type NewsletterValues = z.infer<typeof NewsletterSchema>;

export interface NewsletterFormProps {
  variant?: 'panel' | 'footer';
  className?: string;
}

export function NewsletterForm({ variant = 'panel', className }: NewsletterFormProps) {
  const t = useTranslations('newsletter');
  const consentId = useId();
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const isPanel = variant === 'panel';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterValues>({
    resolver: zodResolver(NewsletterSchema),
    defaultValues: { email: '', consent: false },
  });

  async function onSubmit() {
    // No `apps/api` wiring in this workstream — the form is fully
    // validated and interactive, it just doesn't have a live endpoint yet.
    await new Promise((resolve) => setTimeout(resolve, 300));
    setStatus('success');
    reset();
  }

  if (status === 'success') {
    return (
      <p className={cx('font-body text-body', isPanel ? 'text-paper' : 'text-paper', className)}>{t('success')}</p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={cx('flex flex-col gap-16', className)} noValidate>
      <div className="flex flex-col gap-12 sm:flex-row sm:items-start">
        <Input
          {...register('email')}
          type="email"
          label={t('emailLabel')}
          {...errorMessageProp(errors.email?.message)}
          className="grow"
        />
        <Button type="submit" variant={isPanel ? 'secondary' : 'primary'} disabled={isSubmitting} className="shrink-0">
          {t('cta')}
        </Button>
      </div>
      <div className="flex items-start gap-8">
        <input
          id={consentId}
          type="checkbox"
          {...register('consent')}
          className="mt-2 size-16 shrink-0 border border-current bg-transparent accent-gold"
        />
        <label htmlFor={consentId} className={cx('font-body text-body-sm', isPanel ? 'text-paper/80' : 'text-ink-70')}>
          {t('consent')}
        </label>
      </div>
      {errors.consent ? <p className="font-body text-body-sm text-danger">{errors.consent.message}</p> : null}
    </form>
  );
}
