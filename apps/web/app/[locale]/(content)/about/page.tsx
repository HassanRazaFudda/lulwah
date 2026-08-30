import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description: 'Lulwah Fashion is a UAE-registered multi-brand retailer of Pakistani designer women’s wear.',
};

/** plan.md §15.9 "About". Content stub — real copy is a client-provided deliverable, not written here. */
export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-24 px-24 py-64 lg:py-96">
      <h1 className="font-display text-display-2 tracking-display text-ink">About Lulwah</h1>
      <p className="font-body text-body-lg text-ink-70">
        Lulwah Fashion brings Pakistani designer women&apos;s wear (Khaadi, Asim Jofa, Sana Safinaz and more) to
        customers across the UAE. Every piece ships from Pakistan; every size chart is the brand&apos;s own.
      </p>
      <p className="font-body text-body text-ink-70">
        Lulwah means pearl. We built this store the way a jeweller builds a vitrine: one piece, well lit, at a time,
        not a marketplace of everything at once.
      </p>
    </div>
  );
}
