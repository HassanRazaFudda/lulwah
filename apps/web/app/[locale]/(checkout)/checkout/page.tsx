'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Emirate } from '@lulwah/contracts';
import { Button, Input } from '@lulwah/ui';
import { useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CheckoutStep } from '@/components/checkout/CheckoutStep';
import { LabeledSelect } from '@/components/checkout/LabeledSelect';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { CART_QUERY_KEY, useCart } from '@/hooks/use-cart';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api-client';
import { clearCartCookie } from '@/lib/cart-client';
import * as checkoutClient from '@/lib/checkout-client';
import type { InlineAddressInput } from '@/lib/checkout-client';
import type { CheckoutSessionResponse } from '@/lib/checkout-schemas';
import { humanize } from '@/lib/facets';
import { errorMessageProp } from '@/lib/form-error';

/**
 * Checkout — plan.md §15.6. Now wired to the real `checkout` module
 * (`apps/api/src/modules/checkout/checkout.routes.ts`) instead of a
 * simulated round trip: session creation on leaving Contact (a guest email
 * is required at session creation and can't be changed afterwards — see
 * `checkout.service.ts#createSession`), address + shipping on leaving
 * Delivery, payment-intent/OTP/place on Payment. Every render of the order
 * summary is `session.totals` — the API's own numbers, never recomputed
 * here (plan.md §8.5).
 *
 * Deviations from the original placeholder UI, both forced by the real
 * API surface:
 * - No separate "City" field — `InlineAddressInput.city` is required but
 *   UAE storefronts don't distinguish it from the emirate in practice
 *   (§7.2's own field list — emirate/area/building/landmark — has no city
 *   either); it's derived from the selected emirate's label.
 * - Card is real-UI but honestly gated: `payment-intent {method:"card"}`
 *   cleanly `503`s in this environment (no Stripe account configured, see
 *   `docs/implemented-plan.md` §4.6.4/§4.6.5) — selecting it shows that
 *   real unavailable state and nudges to Cash on Delivery, rather than a
 *   Stripe Elements form that could never actually charge anything here.
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
});
type CheckoutValues = z.infer<typeof CheckoutSchema>;

const CONTACT_FIELDS = ['email', 'phone'] as const;
const DELIVERY_FIELDS = ['firstName', 'lastName', 'emirate', 'area', 'buildingName', 'landmark'] as const;

type Step = 'contact' | 'delivery' | 'payment';
type PaymentChoice = 'cod' | 'card';

export default function CheckoutPage() {
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: cart, isPending: isCartPending } = useCart();

  const [activeStep, setActiveStep] = useState<Step>('contact');
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [session, setSession] = useState<CheckoutSessionResponse | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice>('cod');
  const [otpCode, setOtpCode] = useState('');
  const [codOtpVerified, setCodOtpVerified] = useState(false);

  // A fresh idempotency key per mount (plan.md §9.5) — reused across
  // retries of the same `place` attempt, regenerated only by a full page
  // reload (a genuinely new checkout attempt).
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    watch,
    formState: { errors },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(CheckoutSchema),
    mode: 'onBlur',
  });

  const createSessionMutation = useMutation({
    mutationFn: (input: { cartId: string; guestEmail: string }) => checkoutClient.createCheckoutSession(input),
  });

  const deliveryMutation = useMutation({
    mutationFn: async ({ sessionId, inline }: { sessionId: string; inline: InlineAddressInput }) => {
      const withAddress = await checkoutClient.setCheckoutAddress(sessionId, inline);
      return checkoutClient.setCheckoutShipping(withAddress.sessionId);
    },
  });

  const intentMutation = useMutation({
    mutationFn: ({ sessionId, method }: { sessionId: string; method: PaymentChoice }) => checkoutClient.createPaymentIntent(sessionId, method),
    onSuccess: () => setCodOtpVerified(false),
  });

  const otpMutation = useMutation({
    mutationFn: ({ sessionId, code }: { sessionId: string; code: string }) => checkoutClient.verifyCodOtp(sessionId, code),
    onSuccess: (updatedSession) => {
      setSession(updatedSession);
      setCodOtpVerified(true);
    },
  });

  const placeMutation = useMutation({
    mutationFn: (sessionId: string) => checkoutClient.placeOrder(sessionId, idempotencyKey),
    onSuccess: ({ order }) => {
      queryClient.setQueryData(['order', order.orderNumber], order);
      clearCartCookie();
      queryClient.removeQueries({ queryKey: CART_QUERY_KEY });
      router.push(`/checkout/confirmation/${order.orderNumber}`);
    },
  });

  async function handleContinueFromContact() {
    const isValid = await trigger(CONTACT_FIELDS);
    if (!isValid || !cart) return;
    const created = await createSessionMutation.mutateAsync({ cartId: cart.cartId, guestEmail: getValues('email') });
    setSession(created);
    setCompletedSteps((prev) => new Set(prev).add('contact'));
    setActiveStep('delivery');
  }

  async function handleContinueFromDelivery() {
    const isValid = await trigger(DELIVERY_FIELDS);
    const currentSession = session;
    if (!isValid || !currentSession) return;
    const values = getValues();
    const inline: InlineAddressInput = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: { countryCode: '+971', number: values.phone },
      emirate: values.emirate,
      city: humanize(values.emirate),
      area: values.area,
      buildingName: values.buildingName,
      ...(values.apartment ? { apartment: values.apartment } : {}),
      ...(values.street ? { street: values.street } : {}),
      landmark: values.landmark,
      makani: values.makani || null,
    };
    const updated = await deliveryMutation.mutateAsync({ sessionId: currentSession.sessionId, inline });
    setSession(updated);
    setCompletedSteps((prev) => new Set(prev).add('delivery'));
    setActiveStep('payment');
    // `paymentMethod` already defaults to 'cod', but a pre-checked radio
    // never fires its own `onChange` — kick off the intent request for the
    // default method explicitly rather than waiting on a click that may
    // never come (the user only *changes* the radio if they want card).
    handleChoosePaymentMethod(paymentMethod, updated.sessionId);
  }

  function handleChoosePaymentMethod(method: PaymentChoice, sessionIdOverride?: string) {
    const sessionId = sessionIdOverride ?? session?.sessionId;
    if (!sessionId) return;
    setPaymentMethod(method);
    setOtpCode('');
    setCodOtpVerified(false);
    intentMutation.reset();
    otpMutation.reset();
    intentMutation.mutate({ sessionId, method });
  }

  const canPlaceOrder = paymentMethod === 'cod' && codOtpVerified;

  if (isCartPending) {
    return (
      <div className="flex flex-col items-center gap-16 px-24 py-96 text-center">
        <p className="font-body text-body text-ink-70">Loading…</p>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-16 px-24 py-96 text-center">
        <h1 className="font-display text-heading-1 tracking-display text-ink">Your bag is empty</h1>
        <Link href="/shop/new-in" className="font-body text-body text-ink underline decoration-1 underline-offset-4">
          Start shopping
        </Link>
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

      <form
        onSubmit={handleSubmit(() => {
          if (!session) return;
          placeMutation.mutate(session.sessionId);
        })}
        noValidate
        className="flex flex-col gap-32 lg:flex-row lg:items-start lg:gap-48"
      >
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
            {createSessionMutation.isError ? (
              <p role="alert" className="mt-8 font-body text-body-sm text-danger">
                {createSessionMutation.error instanceof ApiError
                  ? createSessionMutation.error.message
                  : 'Could not start checkout. Please try again.'}
              </p>
            ) : null}
            <Button
              type="button"
              variant="primary"
              className="mt-16"
              disabled={createSessionMutation.isPending}
              onClick={() => void handleContinueFromContact()}
            >
              {createSessionMutation.isPending ? 'Starting checkout…' : 'Continue to delivery'}
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
            {deliveryMutation.isError ? (
              <p role="alert" className="mt-8 font-body text-body-sm text-danger">
                {deliveryMutation.error instanceof ApiError ? deliveryMutation.error.message : 'Could not save your address. Please try again.'}
              </p>
            ) : null}
            <Button
              type="button"
              variant="primary"
              className="mt-16"
              disabled={deliveryMutation.isPending}
              onClick={() => void handleContinueFromDelivery()}
            >
              {deliveryMutation.isPending ? 'Saving…' : 'Continue to payment'}
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
                value="cod"
                label="Cash on delivery"
                description="We'll text an OTP to confirm before the order is placed."
                checked={paymentMethod === 'cod'}
                onSelect={() => handleChoosePaymentMethod('cod')}
              />
              <PaymentOption
                value="card"
                label="Card"
                description="Visa, Mastercard — 3D Secure"
                checked={paymentMethod === 'card'}
                onSelect={() => handleChoosePaymentMethod('card')}
              />
            </fieldset>

            {intentMutation.isPending ? (
              <p className="mt-16 font-body text-body-sm text-mukaish">
                {paymentMethod === 'cod' ? 'Sending your verification code…' : 'Contacting the card processor…'}
              </p>
            ) : null}

            {intentMutation.isError && paymentMethod === 'card' ? (
              <div className="mt-16 flex flex-col gap-8 border border-garnet/40 bg-garnet/5 p-16">
                <p className="font-body text-body-sm font-medium text-ink">Card payments are temporarily unavailable</p>
                <p className="font-body text-body-sm text-mukaish">
                  {intentMutation.error instanceof ApiError
                    ? intentMutation.error.message
                    : 'Card payments are not available right now.'}{' '}
                  Please use Cash on Delivery instead.
                </p>
                <Button type="button" variant="secondary" onClick={() => handleChoosePaymentMethod('cod')}>
                  Switch to Cash on Delivery
                </Button>
              </div>
            ) : null}

            {intentMutation.isError && paymentMethod === 'cod' ? (
              <p role="alert" className="mt-16 font-body text-body-sm text-danger">
                {intentMutation.error instanceof ApiError ? intentMutation.error.message : 'Could not start cash on delivery. Please try again.'}
              </p>
            ) : null}

            {paymentMethod === 'cod' && intentMutation.data?.otpRequired && !codOtpVerified ? (
              <div className="mt-16 flex flex-col gap-8">
                <label htmlFor="cod-otp" className="font-body text-label font-semibold tracking-label text-ink-70 uppercase">
                  Enter the 6-digit code sent to your phone
                </label>
                <div className="flex gap-8">
                  <input
                    id="cod-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="h-[52px] w-[160px] border-0 border-b border-ink-20 bg-nacre px-16 font-body text-body tabular-nums text-ink outline-none focus:border-b-2 focus:border-zamurrad"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={otpCode.length !== 6 || otpMutation.isPending}
                    onClick={() => session && otpMutation.mutate({ sessionId: session.sessionId, code: otpCode })}
                  >
                    {otpMutation.isPending ? 'Verifying…' : 'Verify'}
                  </Button>
                </div>
                {otpMutation.isError ? (
                  <p role="alert" className="font-body text-body-sm text-danger">
                    {otpMutation.error instanceof ApiError ? otpMutation.error.message : 'Incorrect code. Please try again.'}
                  </p>
                ) : null}
              </div>
            ) : null}

            {paymentMethod === 'cod' && codOtpVerified ? (
              <p className="mt-16 font-body text-body-sm text-success">Phone verified — ready to place your order.</p>
            ) : null}

            {placeMutation.isError ? (
              <p role="alert" className="mt-16 font-body text-body-sm text-danger">
                {placeMutation.error instanceof ApiError ? placeMutation.error.message : 'Could not place your order. Please try again.'}
              </p>
            ) : null}

            <Button type="submit" variant="primary" className="mt-16 w-full" disabled={!canPlaceOrder || placeMutation.isPending}>
              {placeMutation.isPending ? 'Placing order…' : 'Place order'}
            </Button>
          </CheckoutStep>
        </div>

        <div className="w-full lg:w-[360px] lg:shrink-0">
          <OrderSummary locale={locale} session={session} />
        </div>
      </form>
    </div>
  );
}

function PaymentOption({
  value,
  label,
  description,
  checked,
  onSelect,
}: {
  value: string;
  label: string;
  description: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-12 border p-16 ${checked ? 'border-zamurrad' : 'border-ink-20'}`}>
      <input type="radio" name="paymentMethod" value={value} checked={checked} onChange={onSelect} className="mt-4 accent-zamurrad" />
      <span className="flex flex-col gap-4">
        <span className="font-body text-body font-medium text-ink">{label}</span>
        <span className="font-body text-body-sm text-mukaish">{description}</span>
      </span>
    </label>
  );
}
