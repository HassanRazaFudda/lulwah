import type { Metadata } from 'next';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';

export const metadata: Metadata = {
  title: 'Collections',
  description: "Named seasonal drops from Pakistan's leading designer houses, curated for the UAE.",
};

/**
 * Collections index — plan.md §7.9 / §12.1 `/collections`. A structural
 * stub: real collections are first-class CMS objects with scheduled
 * launches (§2.6), which needs the content/collection module from
 * `apps/api` this workstream doesn't wire up. Cards link into the PLP's
 * catch-all route (`/shop/...`) rather than `/collections/[slug]`, since
 * no per-collection layout (`grid`/`editorial`/`lookbook`/`split`, §7.9)
 * exists yet either.
 */
const COLLECTIONS = [
  {
    slug: 'new-in',
    name: "Lawn '26, Vol 1",
    subtitle: '42 designs, in stock in Dubai',
    image: '/campaigns/lulwah-hero-lawn.jpg',
  },
  {
    slug: 'eid',
    name: 'Eid Edit',
    subtitle: 'Festive weight, festive work',
    image: '/campaigns/lulwah-editorial-eid.jpg',
  },
  {
    slug: 'formal-wedding',
    name: "Wedding Festive '26",
    subtitle: 'Barat, walima, nikkah: three worlds, one edit',
    image: '/campaigns/lulwah-tile-formal.jpg',
  },
] as const;

export default function CollectionsPage() {
  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <h1 className="font-display text-heading-1 tracking-display text-ink">Collections</h1>
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-3 lg:gap-24">
        {COLLECTIONS.map((collection) => (
          <Link key={collection.slug} href={`/shop/${collection.slug}`} className="group relative aspect-[3/4] overflow-hidden bg-pearl">
            <Image
              src={collection.image}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover transition-transform duration-slow ease-cloth group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-ink/35" />
            <div className="absolute inset-x-0 bottom-16 flex flex-col gap-4 px-16">
              <h2 className="font-display text-heading-1 tracking-display text-paper">{collection.name}</h2>
              <p className="font-body text-body-sm text-paper/85">{collection.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
