import type {
  AddressSnapshot,
  Emirate,
  Order,
  OrderItem,
  OrderPayment,
  OrderShippingMethod,
  OrderStatus,
  OrderStatusHistoryEntry,
  PaymentMethod,
  PaymentStatus,
} from '@lulwah/contracts';

/**
 * Placeholder order data — this workstream has no `apps/api` to fetch from
 * yet (separate, parallel workstream), so the Orders table and order detail
 * screen render this instead. Every object is built against the real
 * `Order`/`OrderItem`/... types from `@lulwah/contracts` rather than a
 * looser local shape, so swapping `lib/queries.ts` over to `apiRequest`
 * later is a data-source change, not a type change. One order exists per
 * `OrderStatus` (plan.md §8.7.1's twelve states) so every status's detail
 * page — and its status dropdown — has something real to render.
 */

const ADMIN_USER_ID = '000000000000000000000009'; // 'Sara Ahmed' — order_ops, for statusHistory actors

function objId(seed: number): string {
  return seed.toString(16).padStart(24, '0');
}

function makeAddress(overrides: Partial<AddressSnapshot> = {}): AddressSnapshot {
  const base: AddressSnapshot = {
    label: 'home',
    firstName: 'Ayesha',
    lastName: 'Khan',
    phone: { countryCode: '+971', number: '501234567' },
    emirate: 'dubai',
    city: 'Dubai',
    area: 'Al Barsha',
    buildingName: 'Sama Tower',
    landmark: 'Near Mall of the Emirates',
    makani: null,
    poBox: null,
    country: 'AE',
    geo: null,
  };
  return { ...base, ...overrides };
}

function makePayment(method: PaymentMethod, overrides: Partial<OrderPayment> = {}): OrderPayment {
  const base: OrderPayment = {
    method,
    gateway: method === 'cod' ? null : 'stripe',
    intentId: null,
    transactionIds: [],
    last4: method === 'card' ? '4242' : null,
    brand: method === 'card' ? 'visa' : null,
    threeDSResult: null,
    codVerifiedAt: null,
  };
  return { ...base, ...overrides };
}

const STANDARD_SHIPPING: OrderShippingMethod = {
  id: objId(9001),
  name: 'Standard Delivery',
  carrier: 'Aramex',
  etaMinDays: 2,
  etaMaxDays: 4,
  priceFils: 1500,
};

let itemSeed = 1;

function makeItem(overrides: Partial<OrderItem> & Pick<OrderItem, 'titleSnapshot' | 'unitPriceFils'>): OrderItem {
  itemSeed += 1;
  const base: OrderItem = {
    id: objId(50000 + itemSeed),
    productId: objId(1000 + itemSeed),
    variantId: objId(2000 + itemSeed),
    sku: `LF-${String(itemSeed).padStart(4, '0')}-M`,
    titleSnapshot: overrides.titleSnapshot,
    brandSnapshot: 'Lulwah Atelier',
    imageSnapshot: '/placeholder/product.jpg',
    optionsSnapshot: { size: 'M', color: 'Ferozi', pieceCount: 3 },
    stitchingTypeSnapshot: 'unstitched',
    articleCodeSnapshot: `LF-${String(itemSeed).padStart(4, '0')}`,
    quantity: 1,
    unitPriceFils: overrides.unitPriceFils,
    lineDiscountFils: 0,
    lineTaxFils: 0,
    lineTotalFils: overrides.unitPriceFils,
    stitching: null,
    fulfilmentStatus: 'pending',
    returnedQty: 0,
    refundedFils: 0,
  };
  return { ...base, ...overrides };
}

/** Fills subtotal/tax/grandTotal/balance from the items + a paid fraction —
 *  keeps the money breakdown panel internally consistent without hand
 *  computing every field on every placeholder order. */
function withComputedMoney(order: Order, paidFraction: number): Order {
  const subtotalFils = order.items.reduce((sum, item) => sum + item.lineTotalFils, 0);
  const taxableFils = subtotalFils - order.discountTotalFils;
  const taxFils = Math.round(taxableFils * order.taxRate);
  const grandTotalFils = taxableFils + order.shippingFils + order.codFeeFils + taxFils;
  const paidFils = Math.round(grandTotalFils * paidFraction);
  const balanceDueFils = grandTotalFils - paidFils - order.refundedFils;
  return { ...order, subtotalFils, taxFils, grandTotalFils, paidFils, balanceDueFils };
}

let orderSeed = 0;

function historyEntry(
  from: OrderStatus | null,
  to: OrderStatus,
  daysAgo: number,
  note?: string,
): OrderStatusHistoryEntry {
  const at = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return { from, to, at, byUserId: from === null ? 'system' : ADMIN_USER_ID, note, notifiedCustomer: true };
}

interface DemoOrderSpec {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  customer: { firstName: string; lastName: string };
  emirate: Emirate;
  items: OrderItem[];
  tags: string[];
  history: OrderStatusHistoryEntry[];
  paidFraction: number;
  placedDaysAgo: number;
}

const DEMO_SPECS: DemoOrderSpec[] = [
  {
    status: 'pending_payment',
    paymentStatus: 'unpaid',
    paymentMethod: 'card',
    customer: { firstName: 'Hina', lastName: 'Raza' },
    emirate: 'dubai',
    items: [makeItem({ titleSnapshot: 'Digital Print Lawn 3-Piece', unitPriceFils: 18900, lineTotalFils: 18900 })],
    tags: ['card unverified'],
    history: [historyEntry(null, 'pending_payment', 0.02)],
    paidFraction: 0,
    placedDaysAgo: 0.02,
  },
  {
    status: 'confirmed',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    customer: { firstName: 'Mahnoor', lastName: 'Iqbal' },
    emirate: 'abu_dhabi',
    items: [makeItem({ titleSnapshot: 'Embroidered Chiffon 3-Piece', unitPriceFils: 32900, lineTotalFils: 32900 })],
    tags: [],
    history: [historyEntry(null, 'pending_payment', 0.5), historyEntry('pending_payment', 'confirmed', 0.4)],
    paidFraction: 1,
    placedDaysAgo: 0.5,
  },
  {
    status: 'processing',
    paymentStatus: 'paid',
    paymentMethod: 'cod',
    customer: { firstName: 'Zara', lastName: 'Sheikh' },
    emirate: 'sharjah',
    items: [
      makeItem({ titleSnapshot: 'Karandi Winter Suit', unitPriceFils: 21500, quantity: 2, lineTotalFils: 43000 }),
    ],
    tags: ['COD verified'],
    history: [
      historyEntry(null, 'pending_payment', 1.2),
      historyEntry('pending_payment', 'confirmed', 1.1),
      historyEntry('confirmed', 'processing', 0.6),
    ],
    paidFraction: 0,
    placedDaysAgo: 1.2,
  },
  {
    status: 'stitching',
    paymentStatus: 'paid',
    paymentMethod: 'tabby',
    customer: { firstName: 'Areeba', lastName: 'Farooq' },
    emirate: 'dubai',
    items: [
      makeItem({
        titleSnapshot: 'Custom-Stitched Raw Silk Bridal',
        unitPriceFils: 89000,
        lineTotalFils: 89000,
        stitchingTypeSnapshot: 'custom_stitchable',
      }),
    ],
    tags: ['stitching', 'bridal'],
    history: [
      historyEntry(null, 'pending_payment', 4),
      historyEntry('pending_payment', 'confirmed', 3.9),
      historyEntry('confirmed', 'processing', 3.5),
      historyEntry('processing', 'stitching', 3, 'Tailor: Imran — ETA 7 days'),
    ],
    paidFraction: 1,
    placedDaysAgo: 4,
  },
  {
    status: 'ready_to_ship',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    customer: { firstName: 'Sana', lastName: 'Malik' },
    emirate: 'ajman',
    items: [makeItem({ titleSnapshot: 'Cotton Net Unstitched 2-Piece', unitPriceFils: 15900, lineTotalFils: 15900 })],
    tags: [],
    history: [
      historyEntry(null, 'pending_payment', 2.4),
      historyEntry('pending_payment', 'confirmed', 2.3),
      historyEntry('confirmed', 'processing', 2),
      historyEntry('processing', 'ready_to_ship', 1, 'Packed, awaiting courier pickup'),
    ],
    paidFraction: 1,
    placedDaysAgo: 2.4,
  },
  {
    status: 'shipped',
    paymentStatus: 'paid',
    paymentMethod: 'apple_pay',
    customer: { firstName: 'Fatima', lastName: 'Noor' },
    emirate: 'ras_al_khaimah',
    items: [makeItem({ titleSnapshot: 'Organza Party Wear 3-Piece', unitPriceFils: 27500, lineTotalFils: 27500 })],
    tags: [],
    history: [
      historyEntry(null, 'pending_payment', 3),
      historyEntry('pending_payment', 'confirmed', 2.9),
      historyEntry('confirmed', 'processing', 2.5),
      historyEntry('processing', 'ready_to_ship', 1.5),
      historyEntry('ready_to_ship', 'shipped', 1, 'Aramex AWB 71234567890'),
    ],
    paidFraction: 1,
    placedDaysAgo: 3,
  },
  {
    status: 'out_for_delivery',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    customer: { firstName: 'Rabia', lastName: 'Hussain' },
    emirate: 'dubai',
    items: [makeItem({ titleSnapshot: 'Velvet Winter Shawl Set', unitPriceFils: 34900, lineTotalFils: 34900 })],
    tags: ['gift wrap'],
    history: [
      historyEntry(null, 'pending_payment', 5),
      historyEntry('pending_payment', 'confirmed', 4.9),
      historyEntry('confirmed', 'processing', 4.5),
      historyEntry('processing', 'ready_to_ship', 3.5),
      historyEntry('ready_to_ship', 'shipped', 3),
      historyEntry('shipped', 'out_for_delivery', 0.2),
    ],
    paidFraction: 1,
    placedDaysAgo: 5,
  },
  {
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'cod',
    customer: { firstName: 'Nimra', lastName: 'Aslam' },
    emirate: 'fujairah',
    items: [makeItem({ titleSnapshot: 'Lawn Everyday 3-Piece', unitPriceFils: 12900, lineTotalFils: 12900 })],
    tags: [],
    history: [
      historyEntry(null, 'pending_payment', 10),
      historyEntry('pending_payment', 'confirmed', 9.9),
      historyEntry('confirmed', 'processing', 9.5),
      historyEntry('processing', 'ready_to_ship', 8.5),
      historyEntry('ready_to_ship', 'shipped', 8),
      historyEntry('shipped', 'out_for_delivery', 7),
      historyEntry('out_for_delivery', 'delivered', 6.9, 'COD collected'),
    ],
    paidFraction: 1,
    placedDaysAgo: 10,
  },
  {
    status: 'cancelled',
    paymentStatus: 'refunded',
    paymentMethod: 'card',
    customer: { firstName: 'Iqra', lastName: 'Basit' },
    emirate: 'umm_al_quwain',
    items: [makeItem({ titleSnapshot: 'Jacquard Formal 3-Piece', unitPriceFils: 29900, lineTotalFils: 29900 })],
    tags: ['customer requested'],
    history: [
      historyEntry(null, 'pending_payment', 6),
      historyEntry('pending_payment', 'confirmed', 5.9),
      historyEntry('confirmed', 'cancelled', 5.5, 'Customer changed mind, within cancel window'),
    ],
    paidFraction: 1,
    placedDaysAgo: 6,
  },
  {
    status: 'returned',
    paymentStatus: 'paid',
    paymentMethod: 'tamara',
    customer: { firstName: 'Komal', lastName: 'Yousaf' },
    emirate: 'sharjah',
    items: [makeItem({ titleSnapshot: 'Net Embroidered Dupatta Set', unitPriceFils: 16900, lineTotalFils: 16900 })],
    tags: ['size_issue'],
    history: [
      historyEntry(null, 'pending_payment', 20),
      historyEntry('pending_payment', 'confirmed', 19.9),
      historyEntry('confirmed', 'processing', 19.5),
      historyEntry('processing', 'ready_to_ship', 18.5),
      historyEntry('ready_to_ship', 'shipped', 18),
      historyEntry('shipped', 'delivered', 16),
      historyEntry('delivered', 'returned', 5, 'Return reason: size_issue'),
    ],
    paidFraction: 1,
    placedDaysAgo: 20,
  },
  {
    status: 'refunded',
    paymentStatus: 'refunded',
    paymentMethod: 'card',
    customer: { firstName: 'Warda', lastName: 'Chaudhry' },
    emirate: 'dubai',
    items: [makeItem({ titleSnapshot: 'Silk Bridal Dupatta', unitPriceFils: 42000, lineTotalFils: 42000 })],
    tags: [],
    history: [
      historyEntry(null, 'pending_payment', 25),
      historyEntry('pending_payment', 'confirmed', 24.9),
      historyEntry('confirmed', 'processing', 24.5),
      historyEntry('processing', 'ready_to_ship', 23),
      historyEntry('ready_to_ship', 'shipped', 22),
      historyEntry('shipped', 'delivered', 20),
      historyEntry('delivered', 'returned', 8),
      historyEntry('returned', 'refunded', 6, 'Refunded to original payment method'),
    ],
    paidFraction: 1,
    placedDaysAgo: 25,
  },
  {
    status: 'failed',
    paymentStatus: 'failed',
    paymentMethod: 'card',
    customer: { firstName: 'Alishba', lastName: 'Tariq' },
    emirate: 'dubai',
    items: [makeItem({ titleSnapshot: 'Chiffon Party 3-Piece', unitPriceFils: 22900, lineTotalFils: 22900 })],
    tags: ['payment retry link sent'],
    history: [historyEntry(null, 'pending_payment', 0.3), historyEntry('pending_payment', 'failed', 0.25, '3DS declined')],
    paidFraction: 0,
    placedDaysAgo: 0.3,
  },
];

function orderNumberFor(daysAgo: number, index: number): string {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const yy = String(date.getUTCFullYear()).slice(2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `LF-${yy}${mm}${dd}-${String(index + 1).padStart(4, '0')}`;
}

function buildOrder(spec: DemoOrderSpec, index: number): Order {
  orderSeed += 1;
  const placedAt = new Date(Date.now() - spec.placedDaysAgo * 24 * 60 * 60 * 1000);
  const shippingAddress = makeAddress({
    firstName: spec.customer.firstName,
    lastName: spec.customer.lastName,
    emirate: spec.emirate,
    city: spec.emirate.replace(/_/g, ' '),
  });

  const base: Order = {
    id: objId(100000 + orderSeed),
    orderNumber: orderNumberFor(spec.placedDaysAgo, index),
    userId: objId(300000 + orderSeed),
    guestEmail: null,
    guestPhone: null,
    items: spec.items,
    currency: 'AED',
    subtotalFils: 0,
    discountTotalFils: 0,
    shippingFils: STANDARD_SHIPPING.priceFils,
    codFeeFils: spec.paymentMethod === 'cod' ? 1000 : 0,
    taxFils: 0,
    taxRate: 0.05,
    taxInclusive: false,
    grandTotalFils: 0,
    paidFils: 0,
    refundedFils: spec.status === 'refunded' ? spec.items.reduce((sum, i) => sum + i.lineTotalFils, 0) : 0,
    balanceDueFils: 0,
    discounts: [],
    status: spec.status,
    statusHistory: spec.history,
    paymentStatus: spec.paymentStatus,
    fulfilmentStatus:
      spec.status === 'delivered' || spec.status === 'returned' || spec.status === 'refunded'
        ? 'fulfilled'
        : spec.status === 'shipped' || spec.status === 'out_for_delivery'
          ? 'partially_fulfilled'
          : 'unfulfilled',
    shippingAddress,
    billingAddress: shippingAddress,
    shippingMethod: STANDARD_SHIPPING,
    shipments:
      spec.status === 'shipped' || spec.status === 'out_for_delivery' || spec.status === 'delivered'
        ? [
            {
              id: objId(400000 + orderSeed),
              carrier: 'Aramex',
              trackingNumber: `7123456${orderSeed}`,
              trackingUrl: `https://www.aramex.com/track/${orderSeed}`,
              items: spec.items.map((i) => ({ itemId: i.id, quantity: i.quantity })),
              shippedAt: placedAt,
              deliveredAt: spec.status === 'delivered' ? placedAt : null,
              events: [],
            },
          ]
        : [],
    payment: makePayment(spec.paymentMethod),
    tags: spec.tags,
    placedAt,
    confirmedAt: spec.status === 'pending_payment' || spec.status === 'failed' ? null : placedAt,
    shippedAt: spec.status === 'shipped' || spec.status === 'out_for_delivery' || spec.status === 'delivered' ? placedAt : null,
    deliveredAt: spec.status === 'delivered' || spec.status === 'returned' || spec.status === 'refunded' ? placedAt : null,
    cancelledAt: spec.status === 'cancelled' ? placedAt : null,
    cancelReason: spec.status === 'cancelled' ? 'Customer changed mind, within cancel window' : null,
  };

  return withComputedMoney(base, spec.paidFraction);
}

export const ADMIN_ORDERS: Order[] = DEMO_SPECS.map((spec, index) => buildOrder(spec, index));

export function findAdminOrderById(id: string): Order | undefined {
  return ADMIN_ORDERS.find((order) => order.id === id || order.orderNumber === id);
}
