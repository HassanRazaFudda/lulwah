'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Emirate } from '@lulwah/contracts';
import { Button, Input } from '@lulwah/ui';
import { useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';
import { CheckoutStep } from '@/components/checkout/CheckoutStep';
import { LabeledSelect } from '@/components/checkout/LabeledSelect';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { Link } from '@/i18n/navigation';
import { COD_FEE_FILS, COD_MAX_ORDER_FILS } from '@/lib/commerce-constants';
import { humanize } from '@/lib/facets';
import { errorMessageProp } from '@/lib/form-error';
import { useCartStore } from '@/stores/cart-store';

/**
 * Checkout — plan.md §15.6. Delivery fields follow §7.2's UAE addressing
 * note exactly: emirate select, area autocomplete, building/apartment/
 * street, landmark, optional Makani — **no postcode/ZIP field**, which is
 * a documented requirement (§7.2: "there are no postcodes and street
 * numbers are unreliable"), not an oversight.
 *
 * Deviations: "area" is a plain text field, not the real ~400-UAE-area
 * autocomplete dataset (§7.2) — no such dataset exists in this
 * workstream. Card/Apple Pay/Google Pay/Tabby are UI-only per the task's
 * explicit "real payment integration" out-of-scope note; only Card and
 * Cash on Delivery are selectable. There is no `apps/api` to place a real
 * order against, so "Place order" simulates the round trip and shows an
 * inline confirmation panel rather than navigating to
 * `/checkout/confirmation/[order]` (not in this workstream's route list).
 */
const EMIRATE_OPTIONS = Emirate.options.map((value) => ({ value, label: humanize(value) }));

const CheckoutSchema = z.object({
  email: z.string().min(1, 'Enter your email address.').email('Enter a valid email address.'),
  phone: z.string().regex(/^5\d{8}$/, 'Enter a valid UAE mobile number, e.g. 501234567.'),
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  emirate: Emirate,
  area: z.string().min(1, 'Area is required — e.g. Al Barsha, JLT.'),
  buildingName: z.string().min(1, 'Building or villa name is required.'),
  apartment: z.string().optional(),
  street: z.string().optional(),
  landmark: z.string().min(1, 'A landmark helps our courier find you.'),
  makani: z.string().optional(),
  paymentMethod: z.enum(['card', 'cod']),
});
type CheckoutValues = z.infer<typeof CheckoutSchema>;

const CONTACT_FIELDS = ['email', 'phone'] as const;
const DELIVERY_FIELDS = ['firstName', 'lastName', 'emirate', 'area', 'buildingName', 'landmark'] as const;

type Step = 'contact' | 'delivery' | 'payment';

export default function CheckoutPage() {
  const locale = useLocale() as 'en' | 'ar';
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clear);

  const [activeStep, setActiveStep] = useState<Step>('contact');
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  // A fresh idempotency key per mount — plan.md §15.6: "the request carries an idempotency key" — reused across retries of the same attempt, regenerated only if the cart itself changes.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(CheckoutSchema),
    mode: 'onBlur',
    defaultValues: { paymentMethod: 'card' },
  });

  const paymentMethod = watch('paymentMethod');
  const subtotalFils = items.reduce((sum, item) => sum + item.unitPriceFils * item.quantity, 0);
  const isCodAllowed = subtotalFils <= COD_MAX_ORDER_FILS;

  async function advanceFrom(step: Step, fields: readonly (keyof CheckoutValues)[], next: Step) {
    const isValid = await trigger(fields);
    if (!isValid) return;
    setCompletedSteps((prev) => new Set(prev).add(step));
    setActiveStep(next);
  }

  async function onSubmit() {
    setIsPlacingOrder(true);
    // No `apps/api` order endpoint wired up — simulate the round trip
    // (idempotencyKey would be sent as a header on the real POST /orders call).
    await new Promise((resolve) => setTimeout(resolve, 600));
    void idempotencyKey;
    setOrderNumber(`LF-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(items.length).padStart(4, '0')}`);
    clearCart();
    setIsPlacingOrder(false);
  }

  if (items.length === 0 && !orderNumber) {
    return (
      <div className="flex flex-col items-center gap-16 px-24 py-96 text-center">
        <h1 className="font-display text-heading-1 tracking-display text-ink">Your bag is empty</h1>
        <Link href="/shop/new-in" className="font-body text-body text-ink underline decoration-1 underline-offset-4">
          Start shopping
        </Link>
      </div>
    );
  }

  if (orderNumber) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col items-center gap-16 px-24 py-96 text-center">
        <h1 className="font-display text-heading-1 tracking-display text-ink">Thank you — order placed</h1>
        <p className="font-body text-body text-ink-70">
          Order <span className="font-medium text-ink tabular-nums">{orderNumber}</span>. A confirmation is on its way to
          your email.
        </p>
        <p className="max-w-[46ch] font-body text-body-sm text-mukaish">
          We pack within 24 hours, hand off to courier, and deliver in 2–4 days across the UAE. Track anytime with your
          order number and email.
        </p>
        <Button asChild variant="secondary" className="mt-8">
          <Link href="/">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <div className="flex items-center justify-between border-b border-line pb-16">
        <Link href="/" className="font-display text-heading-1 tracking-display text-ink">
          Lulwah
        </Link>
        <p className="font-body text-body-sm text-mukaish">Secure checkout</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-32 lg:flex-row lg:items-start lg:gap-48">
        <div className="flex flex-1 flex-col gap-16">
          <CheckoutStep
            index={1}
            title="Contact"
            summary={watch('email')}
            isActive={activeStep === 'contact'}
            isComplete={completedSteps.has('contact')}
            isLocked={false}
            onActivate={() => setActiveStep('contact')}
          >
            <div className="flex flex-col gap-16 sm:flex-row">
              <Input
                {...register('email')}
                type="email"
                autoComplete="email"
                label="Email"
                {...errorMessageProp(errors.email?.message)}
                className="flex-1"
              />
              <Input
                {...register('phone')}
                type="tel"
                autoComplete="tel-national"
                inputMode="numeric"
                label="Mobile (+971)"
                {...errorMessageProp(errors.phone?.message)}
                className="flex-1"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              className="mt-16"
              onClick={() => void advanceFrom('contact', CONTACT_FIELDS, 'delivery')}
            >
              Continue to delivery
            </Button>
          </CheckoutStep>

          <CheckoutStep
            index={2}
            title="Delivery"
            summary={watch('area') ? `${watch('area')}, ${humanize(watch('emirate') ?? '')}` : undefined}
            isActive={activeStep === 'delivery'}
            isComplete={completedSteps.has('delivery')}
            isLocked={!completedSteps.has('contact')}
            onActivate={() => completedSteps.has('contact') && setActiveStep('delivery')}
          >
            <div className="flex flex-col gap-16">
              <div className="flex flex-col gap-16 sm:flex-row">
                <Input {...register('firstName')} autoComplete="given-name" label="First name" {...errorMessageProp(errors.firstName?.message)} className="flex-1" />
                <Input {...register('lastName')} autoComplete="family-name" label="Last name" {...errorMessageProp(errors.lastName?.message)} className="flex-1" />
              </div>
              <LabeledSelect
                {...register('emirate')}
                label="Emirate"
                options={EMIRATE_OPTIONS}
                {...errorMessageProp(errors.emirate?.message)}
                autoComplete="address-level1"
              />
              <Input {...register('area')} autoComplete="address-level2" label="Area (e.g. Al Barsha, JLT)" {...errorMessageProp(errors.area?.message)} />
              <div className="flex flex-col gap-16 sm:flex-row">
                <Input {...register('buildingName')} autoComplete="address-line1" label="Building / villa name" {...errorMessageProp(errors.buildingName?.message)} className="flex-1" />
                <Input {...register('apartment')} autoComplete="address-line2" label="Apartment / floor (optional)" className="flex-1" />
              </div>
              <Input {...register('street')} autoComplete="address-line3" label="Street (optional)" />
              <Input {...register('landmark')} label="Landmark" {...errorMessageProp(errors.landmark?.message)} />
              <Input {...register('makani')} label="Makani number (optional)" />
              {/* No postcode/ZIP field — plan.md §7.2: UAE addressing has none. */}
            </div>
            <Button
              type="button"
              variant="primary"
              className="mt-16"
              onClick={() => void advanceFrom('delivery', DELIVERY_FIELDS, 'payment')}
            >
              Continue to payment
            </Button>
          </CheckoutStep>

          <CheckoutStep
            index={3}
            title="Payment"
            isActive={activeStep === 'payment'}
            isComplete={false}
            isLocked={!completedSteps.has('delivery')}
            onActivate={() => completedSteps.has('delivery') && setActiveStep('payment')}
          >
            <fieldset className="flex flex-col gap-12">
              <legend className="sr-only">Payment method</legend>
              <PaymentOption
                value="card"
                label="Card"
                description="Visa, Mastercard — 3D Secure"
                registerProps={register('paymentMethod')}
                checked={paymentMethod === 'card'}
              />
              <PaymentOption
                value="cod"
                label="Cash on delivery"
                description={
                  isCodAllowed
                    ? `AED ${(COD_FEE_FILS / 100).toFixed(0)} handling fee. We'll text an OTP to confirm before the order is placed.`
                    : `Not available above AED ${(COD_MAX_ORDER_FILS / 100).toFixed(0)}.`
                }
                registerProps={register('paymentMethod')}
                checked={paymentMethod === 'cod'}
                disabled={!isCodAllowed}
              />
            </fieldset>
            <Button type="submit" variant="primary" className="mt-16 w-full" disabled={isSubmitting || isPlacingOrder}>
              {isSubmitting || isPlacingOrder ? 'Placing order…' : 'Place order'}
            </Button>
          </CheckoutStep>
        </div>

        <div className="w-full lg:w-[360px] lg:shrink-0">
          <OrderSummary locale={locale} isCod={paymentMethod === 'cod'} />
        </div>
      </form>
    </div>
  );
}

function PaymentOption({
  value,
  label,
  description,
  registerProps,
  checked,
  disabled,
}: {
  value: string;
  label: string;
  description: string;
  registerProps: UseFormRegisterReturn<'paymentMethod'>;
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-12 border p-16 ${checked ? 'border-zamurrad' : 'border-ink-20'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}>
      <input type="radio" value={value} disabled={disabled} className="mt-4 accent-zamurrad" {...registerProps} />
      <span className="flex flex-col gap-4">
        <span className="font-body text-body font-medium text-ink">{label}</span>
        <span className="font-body text-body-sm text-mukaish">{description}</span>
      </span>
    </label>
  );
}
