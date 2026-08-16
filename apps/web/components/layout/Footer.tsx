import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { NewsletterForm } from '@/components/sections/NewsletterForm';
import { LocaleSwitcher } from './LocaleSwitcher';

/**
 * plan.md §15.1: "full-bleed emerald. Four columns (Shop / Help / About /
 * Contact), newsletter with an explicit consent checkbox (PDPL), payment
 * method marks, social, TRN and legal line, language switcher, the
 * filigree ornament from the logo as a single centred rule. WhatsApp float
 * button on mobile."
 */
const WHATSAPP_NUMBER = '971500000000';
const WHATSAPP_MESSAGE = encodeURIComponent("Hi Lulwah Fashion, I'd like some help with an order.");

export function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');

  const shopLinks = [
    { href: '/shop/unstitched', label: tNav('unstitched') },
    { href: '/shop/pret', label: tNav('readyToWear') },
    { href: '/shop/formal-wedding', label: tNav('formalWedding') },
    { href: '/brands', label: tNav('brands') },
    { href: '/collections', label: t('collections') },
  ];
  const helpLinks = [
    { href: '/faq', label: t('faq') },
    { href: '/account/orders', label: t('trackOrder') },
    { href: '/cart', label: t('shippingReturns') },
  ];
  const aboutLinks = [{ href: '/about', label: t('ourStory') }];

  return (
    <footer className="bg-zamurrad text-paper">
      <div className="mx-auto max-w-[1600px] px-24 py-64 lg:px-[clamp(24px,5vw,88px)] lg:py-96">
        <div className="grid grid-cols-2 gap-32 lg:grid-cols-5">
          <FooterColumn title={t('shop')} links={shopLinks} />
          <FooterColumn title={t('help')} links={helpLinks} />
          <FooterColumn title={t('about')} links={aboutLinks} />
          <div className="col-span-2 flex flex-col gap-16 lg:col-span-2">
            <h3 className="font-body text-label font-semibold tracking-label text-gold uppercase">
              {t('newsletterTitle')}
            </h3>
            <p className="font-body text-body-sm text-paper/80">{t('newsletterSubtitle')}</p>
            <NewsletterForm variant="panel" />
          </div>
        </div>

        {/* The filigree ornament — a single gold hairline, centred, standing in for the logo's flourish (§13.6/§13.3: "gold ... used only as a hairline, rule, or 1px border"). */}
        <div className="my-48 flex items-center justify-center gap-16" role="presentation">
          <span className="h-px w-full max-w-[120px] bg-gold-dark/45" />
          <span className="size-6 rounded-full bg-gold" />
          <span className="h-px w-full max-w-[120px] bg-gold-dark/45" />
        </div>

        <div className="flex flex-col gap-24 border-t border-paper/15 pt-24 lg:flex-row lg:items-center lg:justify-between">
          <p className="font-body text-body-sm text-paper/70">{t('legalLine', { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-24">
            <p className="font-body text-body-sm text-paper/70">{t('paymentMethods')}</p>
            <LocaleSwitcher />
          </div>
        </div>
      </div>

      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('whatsapp')}
        className="fixed bottom-24 end-24 z-30 inline-flex size-48 items-center justify-center bg-zamurrad text-paper lg:hidden"
      >
        <MessageCircle size={22} strokeWidth={1.5} aria-hidden="true" />
      </a>
    </footer>
  );
}

interface FooterColumnLink {
  href: string;
  label: string;
}

function FooterColumn({ title, links }: { title: string; links: FooterColumnLink[] }) {
  return (
    <div className="flex flex-col gap-16">
      <h3 className="font-body text-label font-semibold tracking-label text-gold uppercase">{title}</h3>
      <ul className="flex flex-col gap-12">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="font-body text-body-sm text-paper/80 hover:text-paper">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
