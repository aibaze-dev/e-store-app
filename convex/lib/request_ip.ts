// Native transport metadata (mutations, actions and HTTP actions); queries have none.
// Never an IP or forwarded header supplied by the client. Kept alone so tests can replace it:
// convex-test does not implement getRequestMetadata.
export async function clientIp(ctx: any): Promise<string | null> {
  if (typeof ctx?.meta?.getRequestMetadata !== 'function') return null;
  return (await ctx.meta.getRequestMetadata()).ip;
}
