import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, type Id, type MutationCtx } from './lib/functions';
import { money } from './emails';

// Sale alert for the team's Discord channel. Optional: without DISCORD_SALE_BOT_URL nothing is sent.
// Called inside the webhook mutation, so it is queued once and only if the payment commits.
export async function queueSaleAlert(ctx: MutationCtx, transactionId: Id<'transactions'>) {
  if (!process.env.DISCORD_SALE_BOT_URL) return;
  await ctx.scheduler.runAfter(0, internal.discord.notifySale, { transactionId });
}

type Sale = { currency: string; total: number };

// Only the amount: no product, store or buyer text reaches the channel.
export function saleMessage(sale: Sale) {
  return { content: `🔥 NUEVA VENTA 🔥 - ${money(sale.total, sale.currency)}`, allowed_mentions: { parse: [] as string[] } };
}

// Best effort: a failed alert is logged and never affects the payment or the delivery email.
export const notifySale = internalAction({
  args: { transactionId: v.id('transactions') },
  handler: async (ctx, { transactionId }) => {
    const url = process.env.DISCORD_SALE_BOT_URL;
    const sale: (Sale & { status: string }) | null = await ctx.runQuery(internal.emails.context, { transactionId });
    if (!url || !sale || sale.status !== 'paid') return;
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saleMessage(sale)) });
      if (!response.ok) console.error('Discord sale alert failed', response.status);
    } catch {
      console.error('Discord sale alert failed', 'network');
    }
  },
});
