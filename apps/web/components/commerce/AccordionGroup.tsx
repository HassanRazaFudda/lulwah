import type { ReactNode } from 'react';

/**
 * plan.md §15.4 item 11: "Accordions: What's included · Fabric & care ·
 * Delivery & returns · About the brand." Built on native
 * `<details>`/`<summary>` rather than a Radix/JS accordion — free keyboard
 * support and screen-reader semantics, no client JS needed at all (§27's
 * "no data fetching inside presentational components" cousin: no
 * unnecessary client-side state either).
 */
export interface AccordionItemData {
  id: string;
  title: string;
  content: ReactNode;
}

export interface AccordionGroupProps {
  items: AccordionItemData[];
  defaultOpenId?: string;
}

export function AccordionGroup({ items, defaultOpenId }: AccordionGroupProps) {
  return (
    <div className="flex flex-col divide-y divide-line border-y border-line">
      {items.map((item) => (
        <details key={item.id} open={item.id === defaultOpenId} className="group py-16">
          <summary className="flex cursor-pointer list-none items-center justify-between font-body text-body font-medium text-ink [&::-webkit-details-marker]:hidden">
            {item.title}
            <span
              aria-hidden="true"
              className="font-body text-heading-2 leading-none text-mukaish transition-transform duration-base ease-out group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="pt-12 font-body text-body-sm text-ink-70">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
