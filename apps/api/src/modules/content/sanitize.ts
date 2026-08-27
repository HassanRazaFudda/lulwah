import DOMPurify from 'isomorphic-dompurify';

/**
 * plan.md §19 (Security → Input): "HTML sanitised with `isomorphic-dompurify`
 * on any rich-text field." `Page.bodyEn`/`bodyAr` are the first rich-text
 * fields to actually land in this codebase — `catalog`'s `Product` schema
 * deliberately trimmed a `descriptionEn`/`descriptionAr` field out of scope
 * (see `packages/contracts/src/product.ts`'s own doc comment), so there is
 * no existing precedent to follow here; this establishes it instead.
 *
 * An admin/editorial allowlist — enough for real page content (headings,
 * paragraphs, lists, links, basic emphasis, images) without opening up
 * `<script>`/`<iframe>`/inline event handlers/`javascript:` hrefs. Run on
 * every admin write (`page.service.ts`), never trusted as already-clean on
 * the way back out — matches §19's "Output" row: React/JSON serialization
 * already escapes by default, this is specifically about what gets stored
 * and later rendered via `dangerouslySetInnerHTML` on the storefront.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img',
  'blockquote', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height', 'class'];

export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
