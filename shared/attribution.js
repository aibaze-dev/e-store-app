// Campaign parameters of the ad link that brought a visitor. The Meta link template is:
// ?utm_source={{site_source_name}}&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}
// &utm_content={{ad.name}}&utm_term={{placement}}
// &campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}
// Stored field -> URL parameter. The same names are sent to Stripe as metadata.
export const ATTRIBUTION_PARAMS = {
  source: 'utm_source', medium: 'utm_medium', campaign: 'utm_campaign', content: 'utm_content', term: 'utm_term',
  campaignId: 'campaign_id', adsetId: 'adset_id', adId: 'ad_id',
};
export const ATTRIBUTION_FIELDS = Object.keys(ATTRIBUTION_PARAMS);
export const ATTRIBUTION_MAX_LENGTH = 150;
const ID_FIELDS = ['campaignId', 'adsetId', 'adId'];

function clean(field, value) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  // A link opened before Meta replaced its placeholders says nothing about the campaign.
  if (!text || text.includes('{{')) return '';
  if (ID_FIELDS.includes(field)) return /^[A-Za-z0-9_.-]{1,64}$/.test(text) ? text : '';
  // Cut by code point: names often carry emoji and half of one is not valid text.
  return Array.from(text).slice(0, ATTRIBUTION_MAX_LENGTH).join('').trim();
}

// Keeps only the known fields, trimmed and bounded. Runs in the browser and again on the
// server: what a browser sends is never stored as it arrives.
/** @returns {Record<string, string> | undefined} */
export function cleanAttribution(value) {
  if (!value || typeof value !== 'object') return undefined;
  /** @type {Record<string, string>} */
  const result = {};
  for (const field of ATTRIBUTION_FIELDS) {
    const text = clean(field, value[field]);
    if (text) result[field] = text;
  }
  return Object.keys(result).length ? result : undefined;
}

export function parseAttribution(search) {
  let params;
  try { params = new URLSearchParams(search); } catch { return undefined; }
  return cleanAttribution(Object.fromEntries(ATTRIBUTION_FIELDS.map(field => [field, params.get(ATTRIBUTION_PARAMS[field]) ?? undefined])));
}

// { utm_source: 'ig', campaign_id: '123', … } for Stripe metadata.
export function attributionMetadata(attribution) {
  const clean = cleanAttribution(attribution);
  return clean ? Object.fromEntries(Object.entries(clean).map(([field, value]) => [ATTRIBUTION_PARAMS[field], value])) : {};
}

// With this link template utm_medium carries the ad set name and utm_term the placement.
export const SOURCE_DIMENSIONS = {
  campaign: { label: 'Campaña', levels: ['campaign'] },
  adset: { label: 'Conjunto', levels: ['campaign', 'adset'] },
  ad: { label: 'Anuncio', levels: ['campaign', 'adset', 'ad'] },
  placement: { label: 'Ubicación', levels: ['placement'] },
  source: { label: 'Fuente', levels: ['source'] },
};
const LEVELS = {
  campaign: { id: 'campaignId', name: 'campaign' },
  adset: { id: 'adsetId', name: 'medium' },
  ad: { id: 'adId', name: 'content' },
  placement: { name: 'term' },
  source: { name: 'source' },
};
const levelKey = (attribution, level) => attribution?.[LEVELS[level].id] || attribution?.[LEVELS[level].name] || '';
const levelName = (attribution, level) => attribution?.[LEVELS[level].name] || attribution?.[LEVELS[level].id] || '';

// One row per distinct link (campaign, ad set, ad, placement and source). IDs identify a
// row when present, because names can repeat; the report shows the names.
export function sourceKey(attribution) {
  return attribution ? JSON.stringify(Object.keys(LEVELS).map(level => levelKey(attribution, level))) : '';
}

// recordView is public: made-up links must not grow a report without bound. Past this
// many distinct links, new ones are added up in a single row.
export const MAX_SOURCE_ROWS = 5000;
export const OTHER_SOURCES = Object.fromEntries(['source', 'medium', 'campaign', 'content', 'term'].map(field => [field, 'Otros enlaces']));

export function createSourceRow(attribution) {
  return { attribution: attribution ?? null, landingViews: 0, checkoutViews: 0, purchases: 0, revenue: {} };
}

// Adds up the rows of a report by one dimension. Rows without campaign data stay together
// in a single row with an empty name.
export function groupSources(rows, dimension) {
  const { levels } = SOURCE_DIMENSIONS[dimension];
  const groups = new Map();
  for (const row of rows) {
    const known = row.attribution && levels.some(level => levelKey(row.attribution, level));
    const key = known ? JSON.stringify(levels.map(level => levelKey(row.attribution, level))) : '';
    let group = groups.get(key);
    if (!group) {
      const names = known ? levels.map(level => levelName(row.attribution, level) || '—') : [];
      group = { key, name: names.at(-1) ?? '', parents: names.slice(0, -1), landingViews: 0, checkoutViews: 0, purchases: 0, revenue: {} };
      groups.set(key, group);
    }
    group.landingViews += row.landingViews;
    group.checkoutViews += row.checkoutViews;
    group.purchases += row.purchases;
    for (const [currency, amount] of Object.entries(row.revenue)) group.revenue[currency] = (group.revenue[currency] ?? 0) + amount;
  }
  const money = group => Object.values(group.revenue).reduce((sum, amount) => sum + amount, 0);
  return [...groups.values()].sort((a, b) => money(b) - money(a) || b.purchases - a.purchases || b.landingViews - a.landingViews
    // On a tie, visits without campaign go last.
    || (a.key === '') - (b.key === '') || a.name.localeCompare(b.name));
}
