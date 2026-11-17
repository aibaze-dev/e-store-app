export const DAY_MS = 86_400_000;

export function dateKey(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(timestamp);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function shiftDate(day, offset) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
}

export function validRange(from, to) {
  const validDate = day => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T12:00:00Z`)) && shiftDate(day, 0) === day;
  return validDate(from) && validDate(to) && from <= to && (Date.parse(to) - Date.parse(from)) / DAY_MS < 366;
}

// Sets span the whole range. Daily uniques must never be added to get range uniques.
export function createReport(from, to) {
  const bucket = () => ({ views: 0, landingViews: 0, checkoutViews: 0, unknownIpViews: 0, purchases: 0, ips: new Set(), landingIps: new Set(), checkoutIps: new Set() });
  const total = bucket();
  const days = new Map();
  for (let day = from; day <= to; day = shiftDate(day, 1)) days.set(day, bucket());
  const recent = [];
  const addTo = (target, row) => {
    target.views++;
    target[`${row.page}Views`]++;
    if (row.ipHash) { target.ips.add(row.ipHash); target[`${row.page}Ips`].add(row.ipHash); }
    else target.unknownIpViews++;
  };
  const serialize = ({ ips, landingIps, checkoutIps, ...counts }) => ({ ...counts, uniques: ips.size, landingUniques: landingIps.size, checkoutUniques: checkoutIps.size });
  return {
    add(rows) {
      for (const row of rows) {
        const day = days.get(row.day);
        if (!day) continue;
        addTo(total, row); addTo(day, row);
        recent.push({ id: row._id, at: row._creationTime, page: row.page, ipCode: row.ipHash?.slice(0, 12) ?? null });
      }
      recent.sort((a, b) => b.at - a.at);
      recent.splice(20);
    },
    addPurchases(rows) {
      for (const row of rows) {
        const day = days.get(row.day);
        if (!day) continue;
        day.purchases++;
        total.purchases++;
      }
    },
    finish() {
      return { total: serialize(total), days: [...days].map(([day, value]) => ({ day, ...serialize(value) })), recent };
    },
  };
}
