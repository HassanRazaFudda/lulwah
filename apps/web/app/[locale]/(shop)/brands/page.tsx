import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { BRANDS } from '@/lib/placeholder-data';

export const metadata: Metadata = {
  title: 'Brands',
  description: "The Pakistani design houses Lulwah Fashion carries, from Khaadi's everyday lawn to Elan's formal wear.",
};

/** Brand index — plan.md §12.1 `/brands`, §7.3. Structural stub over the placeholder brand list. */
export default function BrandsPage() {
  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <h1 className="font-display text-heading-1 tracking-display text-ink">Brands</h1>
      <ul className="grid grid-cols-2 gap-[1px] border border-line lg:grid-cols-3">
        {BRANDS.map((brand) => (
          <li key={brand.slug} className="border border-line">
            <Link
              href={`/brands/${brand.slug}`}
              className="flex h-[160px] items-center justify-center px-16 text-center font-display text-heading-1 tracking-display text-ink transition-colors duration-base ease-out hover:text-zamurrad"
            >
              {brand.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
