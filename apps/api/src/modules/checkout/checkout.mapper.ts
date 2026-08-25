import type { CheckoutSessionDoc, CheckoutSessionHydratedDoc } from './checkout.model.js';
import type { CheckoutSessionResponse } from './checkout.dto.js';

function toAddressView(a: CheckoutSessionDoc['shippingAddress']): CheckoutSessionResponse['shippingAddress'] {
  if (!a) return null;
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
    geo: a.geo ? { lat: a.geo.lat, lng: a.geo.lng } : null,
  };
}

export function toCheckoutSessionResponse(doc: CheckoutSessionDoc | CheckoutSessionHydratedDoc): CheckoutSessionResponse {
  return {
    sessionId: doc.sessionId,
    cartId: doc.cartId,
    items: doc.items.map((item) => ({
      productId: item.productId.toString(),
      variantId: item.variantId.toString(),
      quantity: item.quantity,
      unitPriceFils: item.unitPriceFils,
      compareAtPriceFils: item.compareAtPriceFils,
      titleSnapshot: item.titleSnapshot,
      brandSnapshot: item.brandSnapshot,
      imageSnapshot: item.imageSnapshot,
    })),
    totals: {
      subtotalFils: doc.subtotalFils,
      discountFils: doc.discountFils,
      shippingFils: doc.shippingFils,
      codFeeFils: doc.codFeeFils,
      taxFils: doc.taxFils,
      grandTotalFils: doc.grandTotalFils,
    },
    shippingAddress: toAddressView(doc.shippingAddress),
    billingAddress: toAddressView(doc.billingAddress),
    shippingMethod: doc.shippingMethod
      ? { id: doc.shippingMethod.id, name: doc.shippingMethod.name, carrier: doc.shippingMethod.carrier, etaMinDays: doc.shippingMethod.etaMinDays, etaMaxDays: doc.shippingMethod.etaMaxDays, priceFils: doc.shippingMethod.priceFils }
      : null,
    paymentMethod: doc.paymentMethod,
    status: doc.status,
    expiresAt: doc.expiresAt,
  };
}
