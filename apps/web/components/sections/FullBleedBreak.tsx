import Image from 'next/image';

/** plan.md §15.2 item 7: "a single fabric macro image, no text, pure rhythm." */
export function FullBleedBreak() {
  return (
    <section className="relative h-[50vh] min-h-[320px] w-full lg:h-[70vh]" aria-hidden="true">
      <Image src="/campaigns/fabric-macro-jamawar.jpg" alt="" fill sizes="100vw" className="object-cover" />
    </section>
  );
}
