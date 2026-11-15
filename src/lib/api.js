import { makeFunctionReference as ref } from 'convex/server';

// Function references by name, so the build does not depend on generated bindings.
export const api = {
  analytics: { recordView: ref('analytics:recordView'), report: ref('analytics:report') },
  auth: { getCurrentUser: ref('auth:getCurrentUser') },
  products: { list: ref('products:list'), get: ref('products:get'), create: ref('products:create'), update: ref('products:update') },
  stores: { list: ref('stores:list'), get: ref('stores:get'), create: ref('stores:create'), update: ref('stores:update'), updateCheckout: ref('stores:updateCheckout') },
  landings: { getForStore: ref('landings:getForStore'), preview: ref('landings:preview'), saveDraft: ref('landings:saveDraft'), publish: ref('landings:publish') },
  landingWizard: { generate: ref('landing_wizard:generate') },
  orders: { list: ref('orders:list') },
  storefront: { getLanding: ref('storefront:getLanding'), getDelivery: ref('storefront:getDelivery'), heartbeat: ref('storefront:heartbeat'), checkoutVisitors: ref('storefront:checkoutVisitors') },
  checkout: { start: ref('checkout:start'), startPostPurchase: ref('checkout:startPostPurchase') },
};
