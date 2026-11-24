import { makeFunctionReference as ref } from 'convex/server';

// Function references by name, so the build does not depend on generated bindings.
export const api = {
  projectBrief: { open: ref('project_brief:open'), submit: ref('project_brief:submit') },
  media: { uploadUrl: ref('media:uploadUrl'), finalize: ref('media:finalize') },
  quizzes: Object.fromEntries(['get','save','publish','publicConfig','start','recover','saveAnswer','sessions','detail','remove','funnel','checkoutArrival','checkoutContact','imageUploadUrl','imageUrl','cloneSources','cloneProposal'].map(name=>[name,ref(`quizzes:${name}`)])),
  quizWizard: {generate:ref('quiz_wizard:generate')},
  translations: { landing: ref('translations:landing'), quiz: ref('translations:quiz') },
  quizImages: {generate:ref('quiz_images:generate')},
  analytics: { rollingActivity: ref('analytics:rollingActivity'), liveSessions: ref('analytics:liveSessions'), recordView: ref('analytics:recordView'), report: ref('analytics:report') },
  auth: { getCurrentUser: ref('auth:getCurrentUser') },
  access: { check: ref('access:check') },
  products: { artifactTitle: ref('products:artifactTitle'), getByArtifactSlug: ref('products:getByArtifactSlug'), saveArtifact: ref('products:saveArtifact'), list: ref('products:list'), storeUsage: ref('products:storeUsage'), get: ref('products:get'), create: ref('products:create'), update: ref('products:update'), removeEbook: ref('products:removeEbook') },
  stores: { list: ref('stores:list'), get: ref('stores:get'), create: ref('stores:create'), update: ref('stores:update'), updateCheckout: ref('stores:updateCheckout'), setSubdomain: ref('stores:setSubdomain') },
  landings: {list:ref('landings:list'),cloneSources:ref('landings:cloneSources'),cloneFrom:ref('landings:cloneFrom'),unpublish:ref('landings:unpublish'), getForStore: ref('landings:getForStore'), preview: ref('landings:preview'), saveDraft: ref('landings:saveDraft'), publish: ref('landings:publish') },
  landingWizard: { generate: ref('landing_wizard:generate'), importPrompt: ref('landing_wizard:importPrompt'), importJson: ref('landing_wizard:importJson') },
  orders: { list: ref('orders:list') },
  storefront: {getCheckout:ref('storefront:getCheckout'), getLanding: ref('storefront:getLanding'), getDelivery: ref('storefront:getDelivery'), heartbeat: ref('storefront:heartbeat'), checkoutVisitors: ref('storefront:checkoutVisitors') },
  checkout: { start: ref('checkout:start'), startPostPurchase: ref('checkout:startPostPurchase'), sessionStatus: ref('checkout:sessionStatus'), saveBuyerDraft: ref('checkout:saveBuyerDraft') },
  contactRequests: { page: ref('contact_requests:page'), create: ref('contact_requests:create'), list: ref('contact_requests:list'), counts: ref('contact_requests:counts'), setStatus: ref('contact_requests:setStatus') },
};
