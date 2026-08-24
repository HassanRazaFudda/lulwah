'use client';

import { useParams } from 'next/navigation';
import { ProductEditor } from '../../../../components/product-editor/ProductEditor';

export default function ProductDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? (params.id[0] ?? '') : (params.id ?? '');
  return <ProductEditor productId={id} />;
}
