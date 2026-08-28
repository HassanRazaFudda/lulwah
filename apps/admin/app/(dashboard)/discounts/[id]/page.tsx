'use client';

import { useParams } from 'next/navigation';
import { DiscountBuilder } from '../../../../components/discount-builder/DiscountBuilder';

export default function DiscountDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? (params.id[0] ?? '') : (params.id ?? '');
  return <DiscountBuilder discountId={id} />;
}
