import type { User } from '@lulwah/contracts';
import type { UserDoc, UserHydratedDoc } from './identity.model.js';

/**
 * Entity ↔ DTO. This is the one place that decides which private fields
 * — `passwordHash`, `googleId`, `notesInternal`, `lastLoginIp`,
 * `failedLoginCount`, `lockedUntil` — never make it into a response.
 * `@lulwah/contracts`' `User` schema deliberately omits them (see that
 * file's own comment); this mapper is what enforces the omission at
 * runtime so a future `res.json(userDoc)` typo can't leak one.
 */
export function toPublicUser(doc: UserDoc | UserHydratedDoc): User {
  return {
    id: doc._id.toString(),
    email: doc.email,
    emailVerifiedAt: doc.emailVerifiedAt,
    phone: doc.phone ? { countryCode: doc.phone.countryCode, number: doc.phone.number } : null,
    phoneVerifiedAt: doc.phoneVerifiedAt,
    provider: doc.provider,
    firstName: doc.firstName,
    lastName: doc.lastName,
    role: doc.role,
    permissions: doc.permissions,
    status: doc.status,
    locale: doc.locale,
    currency: doc.currency,
    defaultAddressId: doc.defaultAddressId ? doc.defaultAddressId.toString() : null,
    marketing: {
      email: doc.marketing.email,
      sms: doc.marketing.sms,
      whatsapp: doc.marketing.whatsapp,
      consentAt: doc.marketing.consentAt,
      consentIp: doc.marketing.consentIp ?? '',
    },
    stats: {
      orderCount: doc.stats.orderCount,
      totalSpentFils: doc.stats.totalSpentFils,
      avgOrderValueFils: doc.stats.avgOrderValueFils,
      lastOrderAt: doc.stats.lastOrderAt,
    },
    tags: doc.tags,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
