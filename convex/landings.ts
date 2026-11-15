import { PROMOTION_COPY, ACTIVITY_COPY, ACTIVITY_DEFAULTS } from '../shared/landing-copy.js';
import { postPurchaseContent, videoSource } from '../shared/post-purchase.js';
import { v } from 'convex/values';
import { mutation, query } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { buildLandingView, buildPostPurchaseView } from './lib/landing_view';
import { cleanSubdomain, cleanText, cleanUrl, fail } from './lib/validation';
import { landingContent } from './schema';

const TEMPLATES = ['classic'];

function cleanContent(content: typeof landingContent.type) {
  const section = (value: { enabled?: boolean; subtitle?: string } | undefined) => ({
    enabled: value?.enabled ?? true,
    subtitle: cleanText(value?.subtitle ?? '', 'Subtítulo de sección', 400),
  });
  const features = (items: Array<string | { title: string; description: string; icon: string }>, label: string, max = 12) => {
    if (items.length > max) fail(`${label}: usá hasta ${max} elementos.`);
    return items.map(item => {
      if (typeof item === 'string') return cleanText(item, label, 240);
      return {
        title: cleanText(item.title, `Título de ${label}`, 240, true),
        description: cleanText(item.description, `Descripción de ${label}`, 600),
        icon: cleanText(item.icon, 'Ícono', 32),
      };
    }).filter(Boolean);
  };
  if (content.faq.items.length > 20 || (content.socialProof?.items.length ?? 0) > 12) fail('Usá hasta 20 preguntas y 12 testimonios.');
  const accent = content.style.accentColor.trim();
  if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) fail('Color de acento: usá un color hexadecimal, por ejemplo #f59e0b.');
  const days = content.guarantee.days;
  if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 365)) fail('Garantía: ingresá entre 1 y 365 días.');
  const endsAt = content.promotion?.endsAt;
  if (content.promotion?.enabled && content.promotion.timerMode === 'date' && endsAt === undefined) fail('Promoción: completá la fecha de vencimiento.');
  if (endsAt !== undefined && (!Number.isSafeInteger(endsAt) || endsAt < 0 || endsAt > 8_640_000_000_000_000)) fail('Promoción: ingresá una fecha válida.');
  const number = (value: number | undefined, label: string, max: number, integer = true) => {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value)))) fail(`${label}: ingresá un número entre 0 y ${max}.`);
    return value;
  };
  const rating = number(content.socialProof?.rating, 'Calificación', 5, false);
  const customers = number(content.socialProof?.customers, 'Clientes', 100000000);
  const satisfaction = number(content.socialProof?.satisfaction, 'Satisfacción', 100);
  const remainingSpots = number(content.promotion?.remainingSpots, 'Cupos', 1000000);
  const post = postPurchaseContent(content);
  const videoUrl = cleanUrl(post.postPurchaseVideo.url, 'Video post-compra');
  if (videoUrl && !videoSource(videoUrl)) fail('Video post-compra: usá una URL HTTPS de YouTube, Vimeo o un archivo MP4, WebM u OGV.');
  if (post.postPurchaseVideo.enabled && !videoUrl) fail('Video post-compra: agregá una URL para activar el VSL.');
  return {
    postPurchase: {
      eyebrow: cleanText(post.postPurchase.eyebrow, 'Antetítulo post-compra', 120),
      title: cleanText(post.postPurchase.title, 'Título post-compra', 160),
      subtitle: cleanText(post.postPurchase.subtitle, 'Subtítulo post-compra', 400),
      description: cleanText(post.postPurchase.description, 'Descripción post-compra', 1200),
      ctaText: cleanText(post.postPurchase.ctaText, 'Botón post-compra', 60),
      declineText: cleanText(post.postPurchase.declineText, 'Botón para continuar', 60),
      downsellTitle: cleanText(post.postPurchase.downsellTitle, 'Título del downsell post-compra', 160),
      downsellText: cleanText(post.postPurchase.downsellText, 'Texto del downsell post-compra', 1200),
      downsellCtaText: cleanText(post.postPurchase.downsellCtaText, 'Botón del downsell post-compra', 60),
    },
    postPurchaseBenefits: {
      ...section(content.postPurchaseBenefits),
      title: cleanText(post.postPurchaseBenefits.title, 'Título de beneficios post-compra', 120),
      items: features(post.postPurchaseBenefits.items, 'Beneficios post-compra', 6) as Array<{ title: string; description: string; icon: string }>,
    },
    postPurchaseVideo: { enabled: post.postPurchaseVideo.enabled, title: cleanText(post.postPurchaseVideo.title, 'Título del video', 120), url: videoUrl },
    hero: {
      title: cleanText(content.hero.title, 'Título', 160),
      subtitle: cleanText(content.hero.subtitle, 'Subtítulo', 400),
      imageUrl: cleanUrl(content.hero.imageUrl, 'Imagen principal'),
      ctaText: cleanText(content.hero.ctaText, 'Texto del botón', 60),
    },
    benefits: { ...section(content.benefits), title: cleanText(content.benefits.title, 'Título de beneficios', 120), items: features(content.benefits.items, 'Beneficios') },
    painPoints: { closingText: cleanText(content.painPoints?.closingText ?? 'Si respondiste “sí” a alguna de estas… tenemos la solución.', 'Cierre de problemas', 240), ...section(content.painPoints), title: cleanText(content.painPoints?.title ?? '', 'Título de problemas', 120), items: features(content.painPoints?.items ?? [], 'Problemas') },
    socialProof: {
      ...section(content.socialProof),
      eyebrow: cleanText(content.socialProof?.eyebrow ?? 'Testimonios de lectores', 'Antetítulo de testimonios', 120),
      ...(rating !== undefined ? { rating } : {}), ...(customers !== undefined ? { customers } : {}), ...(satisfaction !== undefined ? { satisfaction } : {}),
      title: cleanText(content.socialProof?.title ?? '', 'Título de testimonios', 120),
      items: (content.socialProof?.items ?? []).map(item => {
        const name = cleanText(item.name, 'Nombre del testimonio', 120, true);
        const quote = cleanText(item.quote, 'Testimonio', 1200);
        const imageUrl = cleanUrl(item.imageUrl ?? '', 'Captura del testimonio');
        if (item.format === 'chat' && !quote) fail('Agregá el mensaje del lector en cada conversación.');
        if (!quote && !imageUrl) fail('Agregá el texto o una captura de cada testimonio.');
        return { name, quote, ...(imageUrl ? { imageUrl } : {}), format: item.format ?? 'quote',
          openingMessage: cleanText(item.openingMessage ?? '', 'Mensaje inicial', 1200),
          closingMessage: cleanText(item.closingMessage ?? '', 'Mensaje de cierre', 1200),
        };
      }),
    },
    bonuses: { ...section(content.bonuses), title: cleanText(content.bonuses.title, 'Título de bonos', 120) },
    faq: {
      ...section(content.faq), title: cleanText(content.faq.title, 'Título de preguntas', 120),
      items: content.faq.items.map(item => ({
        question: cleanText(item.question, 'Pregunta', 240, true),
        answer: cleanText(item.answer, 'Respuesta', 1200, true),
      })),
    },
    guarantee: { ...section(content.guarantee), title: cleanText(content.guarantee.title, 'Título de garantía', 120), text: cleanText(content.guarantee.text, 'Garantía', 1200), ...(days !== undefined ? { days } : {}) },
    style: { accentColor: accent },
    promotion: {
      timerLabel: cleanText(content.promotion?.timerLabel ?? PROMOTION_COPY.timerLabel, 'Texto del contador', 120),
      spotsText: cleanText(content.promotion?.spotsText ?? PROMOTION_COPY.spotsText, 'Texto de cupos', 240),
      enabled: content.promotion?.enabled ?? true,
      timerMode: content.promotion?.timerMode ?? 'session',
      ...(remainingSpots !== undefined ? { remainingSpots } : {}),
      message: cleanText(content.promotion?.message ?? 'Oferta limitada', 'Mensaje de promoción', 120),
      ...(endsAt !== undefined ? { endsAt } : {}),
    },
    steps: {
      ...section(content.steps), title: cleanText(content.steps?.title ?? 'Así lo aplicás', 'Título de pasos', 120),
      items: features(content.steps?.items ?? [], 'Pasos', 6) as Array<{ title: string; description: string; icon: string }>,
    },
    summary: { ...section(content.summary), title: cleanText(content.summary?.title ?? 'Todo lo que incluye tu compra', 'Título del resumen', 120) },
    closing: {
      enabled: content.closing?.enabled ?? true,
      title: cleanText(content.closing?.title ?? '', 'Título de cierre', 160),
      ctaText: cleanText(content.closing?.ctaText ?? '', 'Botón de cierre', 60),
      stickyEnabled: content.closing?.stickyEnabled ?? true,
    },
    footer: {
      brandName: cleanText(content.footer?.brandName ?? '', 'Marca', 120),
      termsUrl: cleanUrl(content.footer?.termsUrl ?? '', 'Términos y condiciones'),
      privacyUrl: cleanUrl(content.footer?.privacyUrl ?? '', 'Política de privacidad'),
    },
    activity: {
      viewersText: cleanText(content.activity?.viewersText ?? ACTIVITY_COPY.viewersText, 'Texto de espectadores', 240),
      salesText: cleanText(content.activity?.salesText ?? ACTIVITY_COPY.salesText, 'Texto de ventas', 240),
      purchaseText: cleanText(content.activity?.purchaseText ?? ACTIVITY_COPY.purchaseText, 'Texto de aviso de compra', 240),
      purchaseLocationText: cleanText(content.activity?.purchaseLocationText ?? ACTIVITY_COPY.purchaseLocationText, 'Texto de ubicación del aviso', 240),
      viewers: content.activity?.viewers ?? ACTIVITY_DEFAULTS.viewers,
      notifications: content.activity?.notifications ?? ACTIVITY_DEFAULTS.notifications,
      salesCount: content.activity?.salesCount ?? ACTIVITY_DEFAULTS.salesCount },
  };
}

export const getForStore = query({
  args: { storeId: v.id('stores') },
  handler: async (ctx, { storeId }) => {
    await requireAdmin(ctx);
    return await ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', storeId)).unique();
  },
});

// Draft preview for the panel; the public site only ever reads `published`.
export const preview = query({
  args: { storeId: v.id('stores') },
  handler: async (ctx, { storeId }) => {
    await requireAdmin(ctx);
    const store = await ctx.db.get(storeId);
    const landing = await ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', storeId)).unique();
    if (!store || !landing) return null;
    const view = await buildLandingView(ctx, store, landing, landing.draft);
    return view && { ...view, postPurchaseOffer: await buildPostPurchaseView(ctx, store, landing.draft) };
  },
});

export const saveDraft = mutation({
  args: { storeId: v.id('stores'), subdomain: v.string(), template: v.string(), draft: landingContent },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(args.storeId))) fail('La tienda ya no existe.');
    if (!TEMPLATES.includes(args.template)) fail('Plantilla: elegí una plantilla disponible.');
    const subdomain = cleanSubdomain(args.subdomain);
    const draft = cleanContent(args.draft);
    const existing = await ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', args.storeId)).unique();
    const taken = await ctx.db.query('landings').withIndex('by_subdomain', q => q.eq('subdomain', subdomain)).first();
    if (taken && taken._id !== existing?._id) fail('Subdominio: ya lo usa otra tienda. Elegí otro.');
    if (existing) {
      await ctx.db.patch(existing._id, { subdomain, template: args.template, draft });
      return existing._id;
    }
    return await ctx.db.insert('landings', { storeId: args.storeId, subdomain, template: args.template, draft });
  },
});

export const publish = mutation({
  args: { storeId: v.id('stores') },
  handler: async (ctx, { storeId }) => {
    await requireAdmin(ctx);
    const landing = await ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', storeId)).unique();
    if (!landing) fail('Guardá el borrador antes de publicar.');
    if (!landing.draft.hero.title) fail('Para publicar, completá el título principal.');
    await ctx.db.patch(landing._id, { published: landing.draft, publishedAt: Date.now() });
    return landing._id;
  },
});
