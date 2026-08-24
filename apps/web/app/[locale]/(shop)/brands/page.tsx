import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { listBrands } from '@/lib/catalog-client';

export const metadata: Metadata = {
  title: 'Brands',
  description: "The Pakistani design houses Lulwah Fashion carries, from Khaadi's everyday lawn to Elan's formal wear.",
};

/** Not in plan.md §12.2's explicit table — treated the same as Home/PLP (ISR, 300s). */
export const revalidate = 300;

/** Brand index — plan.md §12.1 `/brands`, §7.3. Wired to `GET /brands`. */
export default async function BrandsPage() {
  const brands = await listBrands();

  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <h1 className="font-display text-heading-1 tracking-display text-ink">Brands</h1>
      {brands.length === 0 ? (
        <p className="font-body text-body text-mukaish">No brands to show right now.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-[1px] border border-line lg:grid-cols-3">
          {brands.map((brand) => (
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
      )}
    </div>
  );
}
