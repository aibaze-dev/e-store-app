import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const deliverable = v.object({ title: v.string(), url: v.string() });

// Every section may carry its own label, button text and note under the button.
const sectionFields = { enabled: v.optional(v.boolean()), subtitle: v.optional(v.string()), eyebrow: v.optional(v.string()), ctaText: v.optional(v.string()), note: v.optional(v.string()) };
const feature = v.object({ title: v.string(), description: v.string(), icon: v.string() });
const storyFields = { ...sectionFields, eyebrow: v.optional(v.string()), title: v.string() };
const storyImage = { imageUrl: v.optional(v.string()), imageAlt: v.optional(v.string()) };

export const landingContent = v.object({
  postPurchase: v.optional(v.object({
    eyebrow: v.string(), title: v.string(), subtitle: v.string(), description: v.string(),
    ctaText: v.string(), declineText: v.string(), downsellTitle: v.string(), downsellText: v.string(), downsellCtaText: v.string(),
  })),
  postPurchaseBenefits: v.optional(v.object({ ...sectionFields, title: v.string(), items: v.array(feature) })),
  postPurchaseVideo: v.optional(v.object({ enabled: v.boolean(), title: v.string(), url: v.string() })),
  hero: v.object({ title: v.string(), titleAccent: v.optional(v.string()), subtitle: v.string(), imageUrl: v.string(), ctaText: v.string(), eyebrow: v.optional(v.string()), secondaryImageUrl: v.optional(v.string()), note: v.optional(v.string()), headerCtaText: v.optional(v.string()), ratingText: v.optional(v.string()), trustText: v.optional(v.string()), noteTitle: v.optional(v.string()), footnote: v.optional(v.string()) }),
  introduction: v.optional(v.object({ ...storyFields, text: v.string(), badge: v.optional(v.string()) })),
  transformation: v.optional(v.object({ ...storyFields, ...storyImage })),
  about: v.optional(v.object({ ...storyFields, ...storyImage, text: v.string(), signature: v.optional(v.string()) })),
  showcase: v.optional(v.object({ ...storyFields, ...storyImage })),
  comparison: v.optional(v.object({ ...storyFields, badge: v.optional(v.string()), items: v.array(v.object({ title: v.string(), description: v.string(), highlighted: v.boolean() })) })),
  combo: v.optional(v.object({ ...storyFields, upsellText: v.string(), allText: v.string() })),
  benefits: v.object({ ...sectionFields, ...storyImage, videoUrl: v.optional(v.string()), title: v.string(), items: v.array(v.union(v.string(), feature)) }),
  painPoints: v.optional(v.object({ closingText: v.optional(v.string()), ...sectionFields, title: v.string(), items: v.array(v.union(v.string(), feature)) })),
  socialProof: v.optional(v.object({ eyebrow: v.optional(v.string()), rating: v.optional(v.number()), customers: v.optional(v.number()), satisfaction: v.optional(v.number()), ...sectionFields, title: v.string(), items: v.array(v.object({ name: v.string(), quote: v.string(), imageUrl: v.optional(v.string()), photoUrl: v.optional(v.string()), verified: v.optional(v.boolean()), format: v.optional(v.union(v.literal('quote'), v.literal('chat'))), openingMessage: v.optional(v.string()), closingMessage: v.optional(v.string()), isExample: v.optional(v.boolean()) })) })),
  bonuses: v.object({ ...sectionFields, title: v.string(), chips: v.optional(v.array(v.string())) }),
  faq: v.object({ ...sectionFields, title: v.string(), items: v.array(v.object({ question: v.string(), answer: v.string() })) }),
  guarantee: v.object({ ...sectionFields, title: v.string(), text: v.string(), days: v.optional(v.number()) }),
  style: v.object({ accentColor: v.string() }),
  promotion: v.optional(v.object({ title: v.optional(v.string()), timerLabel: v.optional(v.string()), spotsText: v.optional(v.string()), enabled: v.boolean(), message: v.string(), timerMode: v.optional(v.union(v.literal('session'), v.literal('date'))), remainingSpots: v.optional(v.number()), endsAt: v.optional(v.number()) })),
  steps: v.optional(v.object({ ...sectionFields, title: v.string(), items: v.array(feature) })),
  summary: v.optional(v.object({ ...sectionFields, title: v.string() })),
  closing: v.optional(v.object({ enabled: v.boolean(), title: v.string(), ctaText: v.string(), stickyEnabled: v.boolean(), text: v.optional(v.string()), note: v.optional(v.string()) })),
  footer: v.optional(v.object({ brandName: v.string(), termsUrl: v.string(), privacyUrl: v.string() })),
  // Sales counts come from paid orders; labels are editable presentation text.
  activity: v.optional(v.object({ viewersText: v.optional(v.string()), salesText: v.optional(v.string()), purchaseText: v.optional(v.string()), purchaseLocationText: v.optional(v.string()), viewers: v.optional(v.boolean()), notifications: v.boolean(), salesCount: v.boolean() })),
});

export const storeOffer = v.object({
  mainProductId: v.id('products'),
  // Prices are integers in the currency's minor unit (cents for USD).
  price: v.number(),
  compareAtPrice: v.optional(v.number()),
  bonuses: v.array(v.object({ productId: v.id('products'), referenceValue: v.optional(v.number()) })),
  upsells: v.array(v.object({ productId: v.id('products'), price: v.number(), displayOrder: v.number() })),
});

export const storePostPurchase = v.object({
  enabled: v.boolean(),
  productId: v.optional(v.id('products')),
  price: v.number(),
  // Discount offered when the buyer declines this offer. Absent or 0: no downsell.
  downsellPercent: v.optional(v.number()),
});

// The main product with its bonuses and without extras, at a discount, offered when the
// visitor tries to go back. Texts are the popup and the offer page.
export const storeDownsell = v.object({
  enabled: v.boolean(),
  percent: v.number(),
  modalTitle: v.string(),
  modalSubtitle: v.string(),
  acceptText: v.string(),
  declineText: v.string(),
  pageTitle: v.string(),
  pageSubtitle: v.string(),
});

// Presentation of the public checkout. Reference prices are informative and never charged.
export const storeCheckout = v.object({
  notifications: v.boolean(),
  // Live count of visitors on the checkout page, from their own heartbeats.
  liveVisitors: v.optional(v.boolean()),
  upsellTitle: v.string(),
  upsellReferences: v.array(v.object({ productId: v.id('products'), value: v.number() })),
});

// failed: a delayed payment method (ACH, SEPA…) was declined after checkout.
// needs_review: Stripe charged an amount or currency that differs from the order.
export const paymentStatus = v.union(
  v.literal('pending'), v.literal('paid'), v.literal('expired'), v.literal('refunded'),
  v.literal('failed'), v.literal('needs_review'),
);

export const emailStatus = v.union(v.literal('pending'), v.literal('sent'), v.literal('failed'), v.literal('skipped'));

export const itemRole = v.union(
  v.literal('main'), v.literal('bonus'), v.literal('upsell'), v.literal('post_purchase'),
);

export default defineSchema({
  // Minimal view history. _creationTime is the server timestamp; no raw IP or UA.
  pageViews: defineTable({
    storeId: v.id('stores'),
    page: v.union(v.literal('landing'), v.literal('checkout')),
    origin: v.optional(v.union(v.literal('classic'),v.literal('quiz'),v.literal('direct'))),
    day: v.string(),
    ipHash: v.optional(v.string()),
    eventId: v.string(),
  }).index('by_store_day', ['storeId', 'day'])
    .index('by_store_event', ['storeId', 'eventId'])
    .index('by_store_ip', ['storeId', 'ipHash']),

  // Shared catalogue: the same resource can be a main product, a bonus or an upsell.
  products: defineTable({
    // Optional for existing records; product mutations always persist this value.
    type: v.optional(v.literal('e-book')),
    name: v.string(),
    description: v.string(),
    coverUrl: v.string(),
    status: v.union(v.literal('active'), v.literal('archived')),
    deliverables: v.array(deliverable),
  }),

  // A store is one campaign selling one main ebook; the commercial offer lives here.
  stores: defineTable({
    name: v.string(),
    status: v.union(v.literal('draft'), v.literal('active')),
    currency: v.string(),
    offer: storeOffer,
    postPurchase: storePostPurchase,
    downsell: v.optional(storeDownsell),
    tracking: v.object({ metaPixelId: v.string() }),
    checkout: v.optional(storeCheckout),
    subdomain: v.optional(v.string()),
    purchaseDraft: v.optional(landingContent),
    purchasePublished: v.optional(landingContent),
  }).index('by_subdomain', ['subdomain']),

  landings: defineTable({
    storeId: v.id('stores'),
    subdomain: v.string(),
    template: v.string(),
    draft: landingContent,
    published: v.optional(landingContent),
    publishedAt: v.optional(v.number()),
    quizDraft: v.optional(v.any()),
    publicationId: v.optional(v.id('quizPublications')),
  }).index('by_store', ['storeId']).index('by_subdomain', ['subdomain']),

  // Items are a copy of what was sold; never rebuild a purchase from the current store.
  orders: defineTable({
    storeId: v.id('stores'),
    landingId: v.id('landings'),
    parentOrderId: v.optional(v.id('orders')),
    attemptId: v.string(),
    origin: v.optional(v.union(v.literal('classic'), v.literal('quiz'), v.literal('direct'))),
    quizSessionId: v.optional(v.id('quizSessions')),
    // Sold at the store's downsell discount; the items hold the price actually charged.
    downsell: v.optional(v.boolean()),
    buyer: v.optional(v.object({ email: v.string(), name: v.string() })),
    status: paymentStatus,
    currency: v.string(),
    total: v.number(),
    items: v.array(v.object({ productId: v.id('products'), name: v.string(), role: itemRole, price: v.number() })),
  }).index('by_attempt', ['attemptId']).index('by_parent', ['parentOrderId']).index('by_store', ['storeId']).index('by_quiz', ['quizSessionId']),

  // Shown in the panel as "Cobros y entregas". Deliveries are only exposed once paid.
  transactions: defineTable({
    orderId: v.id('orders'),
    status: paymentStatus,
    amount: v.number(),
    currency: v.string(),
    stripeCheckoutSessionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    // What Stripe actually charged when it did not match the order (status needs_review).
    charged: v.optional(v.object({ amount: v.number(), currency: v.string() })),
    // Why the charge is held: wrong amount, a second purchase of the same post-purchase
    // offer, or a payment reported for an order that had already expired or failed.
    reviewReason: v.optional(v.union(v.literal('amount'), v.literal('duplicate'), v.literal('late'))),
    // Bumped when a retry needs a new Stripe idempotency key (Stripe caches failures too).
    sessionAttempt: v.optional(v.number()),
    // Delivery email to the buyer, or the review alert to the admins, sent through Resend.
    email: v.optional(v.object({ status: emailStatus, attempts: v.number(), updatedAt: v.number(), error: v.optional(v.string()) })),
    deliveries: v.array(v.object({ productName: v.string(), title: v.string(), url: v.string() })),
  }).index('by_order', ['orderId'])
    .index('by_session', ['stripeCheckoutSessionId'])
    .index('by_payment_intent', ['stripePaymentIntentId']),

  // One row per open checkout tab, refreshed while the tab is visible. Holds no personal data.
  checkoutPresence: defineTable({ storeId: v.id('stores'), sessionId: v.string(), seenAt: v.number() })
    .index('by_store_session', ['storeId', 'sessionId'])
    .index('by_store_seen', ['storeId', 'seenAt']),

  quizPublications: defineTable({ storeId: v.id('stores'), landingId: v.id('landings'), content: v.any() }).index('by_store', ['storeId']),
  quizSessions: defineTable({
    storeId: v.id('stores'), landingId: v.id('landings'), publicationId: v.id('quizPublications'),
    ipHash:v.optional(v.string()), tokenHash: v.string(), revision: v.number(), lastCommand: v.string(), currentStep: v.union(v.string(), v.null()),
    stepEvents: v.optional(v.array(v.object({stepId:v.string(),at:v.number()}))), firstCompletedAt:v.optional(v.number()), contactCapturedAt:v.optional(v.number()),
    history: v.array(v.string()), answers: v.any(), calculations: v.any(), resultId: v.optional(v.string()),
    contact: v.optional(v.any()), consent: v.optional(v.any()), completedAt: v.optional(v.number()), checkoutAt: v.optional(v.number()), updatedAt: v.number(),
  }).index('by_token', ['tokenHash']).index('by_store', ['storeId']).index('by_store_ip',['storeId','ipHash']),
  webhookEvents: defineTable({
    stripeEventId: v.string(),
    type: v.string(),
    // deferred: a refund that arrived before its payment; it is applied when the payment does.
    status: v.union(v.literal('processed'), v.literal('ignored'), v.literal('rejected'), v.literal('deferred')),
    paymentIntentId: v.optional(v.string()),
  }).index('by_event', ['stripeEventId']).index('by_payment_intent', ['paymentIntentId']),
});
