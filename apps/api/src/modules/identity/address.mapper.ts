import type { Address } from '@lulwah/contracts';
import type { AddressDoc, AddressHydratedDoc } from './address.model.js';

export function toAddressDto(doc: AddressDoc | AddressHydratedDoc): Address {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    label: doc.label,
    firstName: doc.firstName,
    lastName: doc.lastName,
    phone: { countryCode: doc.phone.countryCode, number: doc.phone.number },
    emirate: doc.emirate,
    city: doc.city,
    area: doc.area,
    buildingName: doc.buildingName,
    ...(doc.apartment ? { apartment: doc.apartment } : {}),
    ...(doc.street ? { street: doc.street } : {}),
    landmark: doc.landmark,
    makani: doc.makani,
    poBox: doc.poBox,
    country: doc.country,
    isDefaultShipping: doc.isDefaultShipping,
    isDefaultBilling: doc.isDefaultBilling,
    geo: doc.geo ? { lat: doc.geo.lat, lng: doc.geo.lng } : null,
  };
}
