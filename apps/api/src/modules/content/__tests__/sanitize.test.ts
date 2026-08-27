import { describe, expect, it } from 'vitest';
import { sanitizeRichText } from '../sanitize.js';

/** plan.md §19 (Security → Input): "HTML sanitised with isomorphic-dompurify
 *  on any rich-text field" — the first rich-text field in this codebase
 *  (`Page.bodyEn`/`bodyAr`), so this is the first place that control is
 *  actually exercised. */
describe('sanitizeRichText', () => {
  it('keeps plain formatting/structure tags', () => {
    const html = '<h2>Fabric guide</h2><p>Lawn is a <strong>fine cotton</strong> fabric.</p><ul><li>Breathable</li></ul>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('strips <script> tags entirely', () => {
    expect(sanitizeRichText('<p>Hello</p><script>alert(1)</script>')).toBe('<p>Hello</p>');
  });

  it('strips inline event-handler attributes', () => {
    const result = sanitizeRichText('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain('onerror');
  });

  it('strips a javascript: href', () => {
    const result = sanitizeRichText('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('strips an <iframe>', () => {
    expect(sanitizeRichText('<p>Body</p><iframe src="https://evil.example"></iframe>')).toBe('<p>Body</p>');
  });

  it('keeps a normal, safe link and image', () => {
    const html = '<p>See <a href="/collections/lawn">this</a></p><img src="https://cdn.example.com/a.jpg" alt="Lawn">';
    const result = sanitizeRichText(html);
    expect(result).toContain('href="/collections/lawn"');
    expect(result).toContain('src="https://cdn.example.com/a.jpg"');
  });
});
