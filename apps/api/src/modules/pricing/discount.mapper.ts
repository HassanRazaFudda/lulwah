import type { Discount } from '@lulwah/contracts';
import type { DiscountDoc, DiscountHydratedDoc } from './discount.model.js';

export function toDiscountDto(doc: DiscountDoc | DiscountHydratedDoc): Discount {
  return {
    id: doc._id.toString(),
    name: doc.name,
    internalDescription: doc.internalDescription,
    mode: doc.mode,
    code: doc.code,
    type: doc.type,
    value: doc.value,
    tiers: doc.tiers ? doc.tiers.map((t) => ({ minSubtotalFils: t.minSubtotalFils, value: t.value })) : null,
    buyXGetY: doc.buyXGetY
      ? {
          buyQty: doc.buyXGetY.buyQty,
          getQty: doc.buyXGetY.getQty,
          appliesToCollectionId: doc.buyXGetY.appliesToCollectionId ? doc.buyXGetY.appliesToCollectionId.toString() : null,
          discountPercent: doc.buyXGetY.discountPercent,
        }
      : null,

    appliesTo: doc.appliesTo,
    targetIds: doc.targetIds.map((id) => id.toString()),
    excludeIds: doc.excludeIds.map((id) => id.toString()),

    conditions: {
      minSubtotalFils: doc.conditions.minSubtotalFils,
      minQuantity: doc.conditions.minQuantity,
      firstOrderOnly: doc.conditions.firstOrderOnly,
      customerTags: doc.conditions.customerTags,
      emirates: doc.conditions.emirates,
      paymentMethods: doc.conditions.paymentMethods,
      startsAt: doc.conditions.startsAt,
      endsAt: doc.conditions.endsAt,
    },
    usage: {
      limitTotal: doc.usage.limitTotal,
      limitPerCustomer: doc.usage.limitPerCustomer,
      usedCount: doc.usage.usedCount,
    },
    stackable: doc.stackable,
    priority: doc.priority,
    status: doc.status,
    showOnProductCard: doc.showOnProductCard,
    bannerTextEn: doc.bannerTextEn,
    bannerTextAr: doc.bannerTextAr,

    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
