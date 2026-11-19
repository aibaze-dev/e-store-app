export const PRESENCE_WINDOW_MS = 45_000;
export const PRESENCE_REFRESH_MS = 15_000;
export const DAY_MS = 86_400_000;

export function dateKey(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(timestamp);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function shiftDate(day, offset) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
}

// Locate the first instant of the business date, including DST transitions.
export function startOfDate(day, timeZone) {
  const utc = Date.parse(day + 'T00:00:00Z');
  let low = utc - DAY_MS;
  let high = utc + DAY_MS;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (dateKey(mid, timeZone) < day) low = mid + 1;
    else high = mid;
  }
  return high;
}

export function validRange(from, to) {
  const validDate = day => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T12:00:00Z`)) && shiftDate(day, 0) === day;
  return validDate(from) && validDate(to) && from <= to && (Date.parse(to) - Date.parse(from)) / DAY_MS < 366;
}

// Sets span the whole range. Daily uniques must never be added to get range uniques.
export function createReport(from, to) {
  const days = [];
  for (let day = from; day <= to; day = shiftDate(day, 1)) days.push(day);
  const report = createIntervalReport(days, row => row.day, row => row.day);
  return { ...report, finish() {
    const { buckets, ...rest } = report.finish();
    return { ...rest, days: buckets.map(({ key, ...counts }) => ({ day: key, ...counts })) };
  } };
}

export function createIntervalReport(keys, viewKey, paymentKey) {
  const bucket = () => ({ views: 0, landingViews: 0, checkoutViews: 0, unknownIpViews: 0, purchases: 0, checkoutPurchases: 0, revenue: {}, ips: new Set(), landingIps: new Set(), checkoutIps: new Set() });
  const total = bucket();
  const buckets = new Map(keys.map(key => [key, bucket()]));
  const recent = [];
  const addTo = (target, row) => {
    target.views++;
    target[`${row.page}Views`]++;
    if (row.ipHash) { target.ips.add(row.ipHash); target[`${row.page}Ips`].add(row.ipHash); }
    else target.unknownIpViews++;
  };
  /** @param {ReturnType<typeof bucket>} value */
  const serialize = ({ ips, landingIps, checkoutIps, ...counts }) => ({ ...counts, uniques: ips.size, landingUniques: landingIps.size, checkoutUniques: checkoutIps.size });
  return {
    add(rows) {
      for (const row of rows) {
        const interval = buckets.get(viewKey(row));
        if (!interval) continue;
        addTo(total, row); addTo(interval, row);
        recent.push({ id: row._id, at: row._creationTime, page: row.page, ipCode: row.ipHash?.slice(0, 12) ?? null });
      }
      recent.sort((a, b) => b.at - a.at);
      recent.splice(20);
    },
    addPurchases(rows) {
      for (const row of rows) {
        const interval = buckets.get(paymentKey(row));
        if (!interval) continue;
        for (const target of [interval, total]) {
          target.purchases++;
          if (!row.postPurchase) target.checkoutPurchases++;
          target.revenue[row.currency] = (target.revenue[row.currency] ?? 0) + row.amount;
        }
      }
    },
    finish() {
      return { total: serialize(total), buckets: [...buckets].map(([key, value]) => ({ key, ...serialize(value) })), recent };
    },
  };
}
