import type { Order } from '@lulwah/contracts';
import type { OrderDoc, OrderHydratedDoc } from './order.model.js';

/** `invoiceNumber`/`checkoutSessionId`/`idempotencyKey`/`internalNotes`
 *  never cross into the public `Order` DTO — see `order.model.ts`'s doc
 *  comment. */
export function toOrderDto(doc: OrderDoc | OrderHydratedDoc): Order {
  return {
    id: doc._id.toString(),
    orderNumber: doc.orderNumber,
    userId: doc.userId ? doc.userId.toString() : null,
    guestEmail: doc.guestEmail,
    guestPhone: doc.guestPhone,

    items: doc.items.map((item) => ({
      id: item._id.toString(),
      productId: item.productId.toString(),
      variantId: item.variantId.toString(),
      sku: item.sku,
      titleSnapshot: item.titleSnapshot,
      brandSnapshot: item.brandSnapshot,
      imageSnapshot: item.imageSnapshot,
      optionsSnapshot: {
        ...(item.optionsSnapshot.size ? { size: item.optionsSnapshot.size } : {}),
        ...(item.optionsSnapshot.color ? { color: item.optionsSnapshot.color } : {}),
        ...(item.optionsSnapshot.pieceCount ? { pieceCount: item.optionsSnapshot.pieceCount } : {}),
      },
      stitchingTypeSnapshot: item.stitchingTypeSnapshot,
      articleCodeSnapshot: item.articleCodeSnapshot,
      quantity: item.quantity,
      unitPriceFils: item.unitPriceFils,
      lineDiscountFils: item.lineDiscountFils,
      lineTaxFils: item.lineTaxFils,
      lineTotalFils: item.lineTotalFils,
      stitching: item.stitching
        ? { enabled: item.stitching.enabled, measurementSnapshot: item.stitching.measurementSnapshot, priceFils: item.stitching.priceFils, status: item.stitching.status }
        : null,
      fulfilmentStatus: item.fulfilmentStatus,
      returnedQty: item.returnedQty,
      refundedFils: item.refundedFils,
    })),

    currency: doc.currency,
    subtotalFils: doc.subtotalFils,
    discountTotalFils: doc.discountTotalFils,
    shippingFils: doc.shippingFils,
    codFeeFils: doc.codFeeFils,
    taxFils: doc.taxFils,
    taxRate: doc.taxRate,
    taxInclusive: doc.taxInclusive,
    grandTotalFils: doc.grandTotalFils,
    paidFils: doc.paidFils,
    refundedFils: doc.refundedFils,
    balanceDueFils: doc.balanceDueFils,

    discounts: doc.discounts.map((d) => ({
      discountId: d.discountId.toString(),
      code: d.code,
      type: d.type,
      amountFils: d.amountFils,
      appliedTo: d.appliedTo,
      ...(d.itemId ? { itemId: d.itemId.toString() } : {}),
    })),

    status: doc.status,
    statusHistory: doc.statusHistory.map((h) => ({
      from: h.from,
      to: h.to,
      at: h.at,
      byUserId: h.byUserId,
      ...(h.note !== undefined ? { note: h.note } : {}),
      notifiedCustomer: h.notifiedCustomer,
    })),
    paymentStatus: doc.paymentStatus,
    fulfilmentStatus: doc.fulfilmentStatus,

    shippingAddress: toAddressSnapshotDto(doc.shippingAddress),
    billingAddress: toAddressSnapshotDto(doc.billingAddress),
    shippingMethod: { id: doc.shippingMethod.id, name: doc.shippingMethod.name, carrier: doc.shippingMethod.carrier, etaMinDays: doc.shippingMethod.etaMinDays, etaMaxDays: doc.shippingMethod.etaMaxDays, priceFils: doc.shippingMethod.priceFils },
    shipments: doc.shipments.map((s) => ({
      id: s._id.toString(),
      carrier: s.carrier,
      trackingNumber: s.trackingNumber,
      ...(s.trackingUrl !== undefined ? { trackingUrl: s.trackingUrl } : {}),
      ...(s.awb !== undefined ? { awb: s.awb } : {}),
      items: s.items.map((i) => ({ itemId: i.itemId.toString(), quantity: i.quantity })),
      shippedAt: s.shippedAt,
      deliveredAt: s.deliveredAt,
      events: s.events.map((e) => ({ code: e.code, description: e.description, at: e.at, ...(e.location !== undefined ? { location: e.location } : {}) })),
    })),

    payment: {
      method: doc.payment.method,
      gateway: doc.payment.gateway,
      intentId: doc.payment.intentId,
      transactionIds: doc.payment.transactionIds,
      last4: doc.payment.last4,
      brand: doc.payment.brand,
      threeDSResult: doc.payment.threeDSResult,
      codVerifiedAt: doc.payment.codVerifiedAt,
    },

    ...(doc.customerNote !== undefined ? { customerNote: doc.customerNote } : {}),
    tags: doc.tags,

    placedAt: doc.placedAt,
    confirmedAt: doc.confirmedAt,
    shippedAt: doc.shippedAt,
    deliveredAt: doc.deliveredAt,
    cancelledAt: doc.cancelledAt,
    cancelReason: doc.cancelReason,
  };
}

function toAddressSnapshotDto(a: OrderDoc['shippingAddress']): Order['shippingAddress'] {
  return {
    label: a.label,
    firstName: a.firstName,
    lastName: a.lastName,
    phone: { countryCode: a.phone.countryCode, number: a.phone.number },
    emirate: a.emirate,
    city: a.city,
    area: a.area,
    buildingName: a.buildingName,
    ...(a.apartment ? { apartment: a.apartment } : {}),
    ...(a.street ? { street: a.street } : {}),
    landmark: a.landmark,
    makani: a.makani,
    poBox: a.poBox,
    country: a.country,
    geo: a.geo ? { lat: a.geo.lat, lng: a.geo.lng } : null,
  };
}

/**
 * `GET /orders/track` (plan.md §8.7.5) — a reduced view for an
 * unauthenticated guest who has already proven they know the order number
 * plus the email/phone on file (see `order.service.ts#trackOrder`). Strips
 * everything an anonymous holder of those two facts shouldn't see: the
 * full financial breakdown, payment details, internal status-change notes,
 * and the `byUserId` actor on each history entry — only what a delivery-
 * tracking page needs.
 */
export interface PublicOrderTrackingView {
  orderNumber: string;
  status: Order['status'];
  statusHistory: { to: Order['status']; at: Date }[];
  shippingMethod: Order['shippingMethod'];
  shipments: Order['shipments'];
  placedAt: Date;
  deliveredAt: Date | null;
}

export function toPublicTrackingView(doc: OrderDoc | OrderHydratedDoc): PublicOrderTrackingView {
  return {
    orderNumber: doc.orderNumber,
    status: doc.status,
    statusHistory: doc.statusHistory.map((h) => ({ to: h.to, at: h.at })),
    shippingMethod: { id: doc.shippingMethod.id, name: doc.shippingMethod.name, carrier: doc.shippingMethod.carrier, etaMinDays: doc.shippingMethod.etaMinDays, etaMaxDays: doc.shippingMethod.etaMaxDays, priceFils: doc.shippingMethod.priceFils },
    shipments: doc.shipments.map((s) => ({
      id: s._id.toString(),
      carrier: s.carrier,
      trackingNumber: s.trackingNumber,
      ...(s.trackingUrl !== undefined ? { trackingUrl: s.trackingUrl } : {}),
      ...(s.awb !== undefined ? { awb: s.awb } : {}),
      items: s.items.map((i) => ({ itemId: i.itemId.toString(), quantity: i.quantity })),
      shippedAt: s.shippedAt,
      deliveredAt: s.deliveredAt,
      events: s.events.map((e) => ({ code: e.code, description: e.description, at: e.at, ...(e.location !== undefined ? { location: e.location } : {}) })),
    })),
    placedAt: doc.placedAt,
    deliveredAt: doc.deliveredAt,
  };
}
