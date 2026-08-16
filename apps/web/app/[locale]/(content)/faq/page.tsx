import type { Metadata } from 'next';
import { AccordionGroup, type AccordionItemData } from '@/components/commerce/AccordionGroup';

export const metadata: Metadata = {
  title: 'FAQ',
};

/** plan.md §15.9 "FAQ (accordion, searchable, schema.org FAQPage)". Search and structured data are follow-ups; the accordion content itself is real. */
const FAQ_ITEMS: AccordionItemData[] = [
  {
    id: 'unstitched',
    title: 'What does "unstitched" mean?',
    content: (
      <p>
        The suit ships as fabric pieces — shirt, trouser, and usually a dupatta — rather than a finished, sewn
        garment. You take it to your own tailor, or use our custom-stitching service at checkout.
      </p>
    ),
  },
  {
    id: 'sizing',
    title: 'How do brand sizes compare?',
    content: (
      <p>
        Every Pakistani house sizes differently — Khaadi runs closer to a UK 8 at Small, Sana Safinaz closer to a UK
        10. Check the size chart on each product page before ordering pret pieces.
      </p>
    ),
  },
  {
    id: 'delivery',
    title: 'How long does delivery take?',
    content: <p>2–4 days across the UAE. Free over AED 300; AED 20 flat otherwise.</p>,
  },
  {
    id: 'cod',
    title: 'Can I pay cash on delivery?',
    content: (
      <p>
        Yes, up to AED 2,000 per order, with a AED 10 handling fee. We text a one-time code to confirm before the
        order is placed.
      </p>
    ),
  },
  {
    id: 'returns',
    title: 'What is the returns policy?',
    content: (
      <p>
        14 days from delivery. Unstitched fabric is returnable only if the seal is intact; custom-stitched pieces are
        made to your measurements and are non-returnable.
      </p>
    ),
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-24 px-24 py-64 lg:py-96">
      <h1 className="font-display text-display-2 tracking-display text-ink">FAQ</h1>
      <AccordionGroup items={FAQ_ITEMS} />
    </div>
  );
}
