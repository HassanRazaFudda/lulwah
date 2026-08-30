'use client';

import { useState } from 'react';
import { Button } from '@lulwah/ui';
import type { DiscountDraft } from '../../lib/discount-draft';
import { buildCodesCsv, generateSequentialCodes } from '../../lib/discount-codes';
import type { BulkCodeResult } from '../../lib/discount-codes';
import { useBulkGenerateCodesMutation } from '../../lib/queries/discounts';
import { labelClassName } from '../product-editor/field-styles';

const MAX_CODES = 2000;

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * plan.md §11.1: "Bulk generate unique codes (e.g. 500 codes for an
 * influencer campaign) with CSV export." No bulk-create endpoint exists on
 * the API — this fires N real, individual `POST /admin/discounts` calls
 * (see `lib/queries/discounts.ts#useBulkGenerateCodesMutation`'s doc
 * comment for exactly how and why), using every field on the current
 * builder draft as the shared template and only the generated `code`
 * varying per call. Only shown when `draft.mode === 'code'` (an automatic
 * discount has no code to vary).
 */
export function BulkCodeGenerator({ draft }: { draft: DiscountDraft }) {
  const [prefix, setPrefix] = useState('CAMPAIGN');
  const [count, setCount] = useState(100);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [results, setResults] = useState<BulkCodeResult[] | null>(null);
  const bulkGenerate = useBulkGenerateCodesMutation();

  const codes = generateSequentialCodes(prefix, count);
  const countError = count < 1 ? 'Enter at least 1 code.' : count > MAX_CODES ? `Maximum ${MAX_CODES} codes per batch.` : null;
  const prefixError = prefix.trim() === '' ? 'A prefix is required.' : null;

  const handleGenerate = () => {
    if (countError || prefixError) return;
    setResults(null);
    setProgress({ completed: 0, total: codes.length });
    bulkGenerate.mutate(
      { draft, codes, onProgress: (completed, total) => setProgress({ completed, total }) },
      { onSuccess: (r) => setResults(r) },
    );
  };

  const succeeded = results?.filter((r) => r.status === 'created').length ?? 0;
  const failed = results?.filter((r) => r.status === 'failed').length ?? 0;

  return (
    <div className="flex flex-col gap-16">
      <p className="text-body-sm text-ink-70">
        Generates <strong>{codes.length || 0}</strong> real, independent code-mode discounts. Each one is a genuine document created
        by its own <code>POST /admin/discounts</code> call, sharing every field on this builder except the code itself. Not a
        bulk endpoint (the API has none); this is N real requests fired from your browser.
      </p>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
        <div className="flex flex-col gap-4">
          <label htmlFor="bulk-prefix" className={labelClassName}>
            Code prefix
          </label>
          <input
            id="bulk-prefix"
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            className="h-[40px] w-full border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
          />
          {prefixError ? <p className="text-body-sm text-danger">{prefixError}</p> : null}
        </div>
        <div className="flex flex-col gap-4">
          <label htmlFor="bulk-count" className={labelClassName}>
            How many codes
          </label>
          <input
            id="bulk-count"
            type="number"
            min={1}
            max={MAX_CODES}
            step={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 0)}
            className="h-[40px] w-full border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
          />
          {countError ? <p className="text-body-sm text-danger">{countError}</p> : null}
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Example codes</span>
          <p className="text-body-sm text-ink-70">
            {codes.slice(0, 2).join(', ')}
            {codes.length > 2 ? `, … ${codes[codes.length - 1]}` : ''}
          </p>
        </div>
      </div>

      <div>
        <Button type="button" onClick={handleGenerate} disabled={Boolean(countError) || Boolean(prefixError) || bulkGenerate.isPending}>
          {bulkGenerate.isPending ? 'Generating…' : `Generate ${codes.length} codes`}
        </Button>
      </div>

      {progress ? (
        <p className="text-body-sm text-ink-70">
          {progress.completed} / {progress.total} requests completed
          {bulkGenerate.isPending ? '…' : '.'}
        </p>
      ) : null}

      {results ? (
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-ink">
              <span className="font-semibold text-success">{succeeded} created</span>
              {failed > 0 ? <span className="ml-8 font-semibold text-danger">{failed} failed</span> : null}
            </p>
            <Button type="button" variant="secondary" onClick={() => downloadCsv(`${prefix.trim().toUpperCase()}-codes.csv`, buildCodesCsv(results))}>
              Download CSV
            </Button>
          </div>
          <div className="max-h-[240px] overflow-y-auto border border-line">
            <table className="w-full border-collapse text-body-sm">
              <thead className="sticky top-0 bg-nacre">
                <tr>
                  <th className="px-16 py-8 text-left text-label uppercase tracking-label text-ink-70">Code</th>
                  <th className="px-16 py-8 text-left text-label uppercase tracking-label text-ink-70">Status</th>
                  <th className="px-16 py-8 text-left text-label uppercase tracking-label text-ink-70">Detail</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.code} className="border-b border-line">
                    <td className="px-16 py-8">{r.code}</td>
                    <td className={r.status === 'created' ? 'px-16 py-8 text-success' : 'px-16 py-8 text-danger'}>{r.status}</td>
                    <td className="px-16 py-8 text-ink-70">{r.error ?? r.discountId ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
