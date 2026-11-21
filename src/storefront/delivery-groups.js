// Order of the thank-you page deliveries: the main product first, then the free bonuses,
// then everything the buyer added (upsells and post-purchase offers). Pure, for the tests.
const GROUP_OF_ROLE = { main: 'main', bonus: 'bonus', upsell: 'extras', post_purchase: 'extras' };
export const DELIVERY_GROUPS = ['main', 'bonus', 'extras'];

// Links without a role (orders saved before roles were sent) go to «extras», unless none
// has a role: then the list stays as it is, in one group without a heading.
export function groupDeliveries(deliveries = []) {
  if (!deliveries.some(link => link.role)) return deliveries.length ? [{ key: 'all', links: deliveries }] : [];
  return DELIVERY_GROUPS
    .map(key => ({ key, links: deliveries.filter(link => (GROUP_OF_ROLE[link.role] ?? 'extras') === key) }))
    .filter(group => group.links.length > 0);
}
