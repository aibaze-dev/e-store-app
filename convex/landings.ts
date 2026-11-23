import { POST_LABEL_FIELDS, LANDING_EXIT_FIELDS, BACK_POPUP_FIELDS, POST_OPTIONAL_FIELDS, BACK_POPUP_OPTIONAL_FIELDS, LANDING_EXIT_OPTIONAL_FIELDS } from '../shared/purchase-copy.js';
import { CHECKOUT_FIELDS, CHECKOUT_OPTIONAL_FIELDS } from '../shared/checkout-copy.js';
import { saveQuizDraft, publishQuiz } from './lib/quiz_records';
import { forStore, resolveAddress } from './lib/landing_records';
import { PROMOTION_COPY, ACTIVITY_COPY, ACTIVITY_DEFAULTS, LANDING_LABEL_FIELDS } from '../shared/landing-copy.js';
import { postPurchaseContent, videoSource } from '../shared/post-purchase.js';
import { v } from 'convex/values';
import { mutation, query } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { buildLandingView, buildPostPurchaseView } from './lib/landing_view';
import { cleanSubdomain, cleanText, cleanUrl, fail } from './lib/validation';
import { landingContent } from './schema';
import { CLASSIC_STORY } from '../shared/classic-design.js';

const TEMPLATES = ['classic'];
const landingKind = v.optional(v.union(v.literal('classic'), v.literal('quiz')));

export function cleanContent(content: typeof landingContent.type) {
  const section = (value: { enabled?: boolean; subtitle?: string } | undefined) => ({
    enabled: value?.enabled ?? true,
    subtitle: cleanText(value?.subtitle ?? '', 'Subtítulo de sección', 400),
  });
  // Optional label, button and note of a section; an empty button falls back to the main one.
  const copy = (value: { eyebrow?: string; ctaText?: string; note?: string } | undefined, eyebrow = '') => ({
    eyebrow: cleanText(value?.eyebrow ?? eyebrow, 'Antetítulo de sección', 120),
    ctaText: cleanText(value?.ctaText ?? '', 'Texto del botón', 60),
    note: cleanText(value?.note ?? '', 'Nota de sección', 240),
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
  if (videoUrl && !videoSource(videoUrl)) fail('Video post-compra: subí un archivo MP4, WebM u OGV.');
  if (post.postPurchaseVideo.enabled && !videoUrl) fail('Video post-compra: subí un archivo para activar el VSL.');
  const storyHeading = (key: keyof typeof CLASSIC_STORY) => {
    const value = { ...CLASSIC_STORY[key], ...content[key] };
    return { ...section(value), eyebrow: cleanText(value.eyebrow, 'Antetítulo', 120), title: cleanText(value.title, 'Título de sección', 120) };
  };
  const storyImage = (key: 'transformation' | 'about' | 'showcase' | 'benefits') => ({
    imageUrl: cleanUrl(content[key]?.imageUrl ?? '', 'Imagen de sección'),
    imageAlt: cleanText(content[key]?.imageAlt ?? '', 'Descripción de imagen', 240),
  });
  if ((content.comparison?.items.length ?? 0) > 3) fail('Comparación: usá hasta 3 opciones.');
  if ((content.comparison?.items.filter(item => item.highlighted).length ?? 0) > 1) fail('Comparación: destacá una sola opción.');
  const chips = content.bonuses.chips ?? [];
  if (chips.length > 4) fail('Bonos: usá hasta 4 etiquetas.');
  // The kit and the showcase take the same optional video; the photo becomes its poster.
  const sectionVideo = (url: string | undefined, label: string) => {
    const clean = cleanUrl(url ?? '', label);
    if (clean && !videoSource(clean)) fail(`${label}: subí un archivo MP4, WebM u OGV.`);
    return clean;
  };
  const kitVideo = sectionVideo(content.benefits.videoUrl, 'Video del kit');
  const showcaseVideo = sectionVideo(content.showcase?.videoUrl, 'Video de qué viene adentro');
  const combo = { ...CLASSIC_STORY.combo, ...content.combo };
  // Errors name the screen: the landing and checkout exit popups share their field labels.
  const cleanLabels = (key: 'postLabels' | 'landingExit' | 'backPopup', fields: Record<string, { label: string }>, screen: string, optional: string[]) => Object.fromEntries(Object.entries(fields).filter(([name]) => content[key]?.[name] !== undefined).map(([name, field]) => [name, cleanText(content[key][name], `${screen} · ${field.label}`, 1200, !optional.includes(name))]));
  return {
    postLabels: cleanLabels('postLabels', POST_LABEL_FIELDS, 'Post-compra', POST_OPTIONAL_FIELDS), postOptions: content.postOptions ?? {},
    landingExit: cleanLabels('landingExit', LANDING_EXIT_FIELDS, 'Salida de la landing', LANDING_EXIT_OPTIONAL_FIELDS), backPopup: cleanLabels('backPopup', BACK_POPUP_FIELDS, 'Volver atrás', BACK_POPUP_OPTIONAL_FIELDS), popupOptions: content.popupOptions ?? {},
    checkout: { ...content.checkout, ...Object.fromEntries(Object.entries(CHECKOUT_FIELDS).filter(([key]) => content.checkout?.[key] !== undefined).map(([key, field]) => [key, cleanText(content.checkout[key], `${field.group === 'exit' ? 'Salida del checkout' : 'Checkout'} · ${field.label}`, 600, !CHECKOUT_OPTIONAL_FIELDS.includes(key))])) },
    labels: Object.fromEntries(Object.entries(LANDING_LABEL_FIELDS).map(([key, field]) => [key, cleanText(content.labels?.[key] ?? field.value, field.label, 240)])),
    introduction: { ...storyHeading('introduction'), text: cleanText(content.introduction?.text ?? '', 'Introducción', 2400), badge: cleanText(content.introduction?.badge ?? '', 'Frase destacada', 120) },
    transformation: { ...storyHeading('transformation'), ...storyImage('transformation') },
    about: { ...storyHeading('about'), ...storyImage('about'), text: cleanText(content.about?.text ?? '', 'Quiénes somos', 2400), signature: cleanText(content.about?.signature ?? '', 'Firma del equipo', 120) },
    showcase: { ...storyHeading('showcase'), ...storyImage('showcase'), videoUrl: showcaseVideo },
    comparison: { ...storyHeading('comparison'), badge: cleanText(content.comparison?.badge ?? '', 'Etiqueta de la opción destacada', 60), ctaText: cleanText(content.comparison?.ctaText ?? '', 'Texto del botón', 60), items: (content.comparison?.items ?? []).map(item => ({ title: cleanText(item.title, 'Opción de comparación', 120, true), description: cleanText(item.description, 'Detalle de comparación', 600, true), highlighted: item.highlighted })) },
    combo: { ...storyHeading('combo'), ...copy(combo, combo.eyebrow), upsellText: cleanText(combo.upsellText, 'Texto de extras', 120), allText: cleanText(combo.allText, 'Botón para sumar todo', 60) },
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
      finalTitle: cleanText(post.postPurchase.finalTitle, 'Título de la última oportunidad', 160),
      finalText: cleanText(post.postPurchase.finalText, 'Texto de la última oportunidad', 1200),
      finalCtaText: cleanText(post.postPurchase.finalCtaText, 'Botón de la última oportunidad', 60),
    },
    postPurchaseBenefits: {
      ...section(content.postPurchaseBenefits),
      title: cleanText(post.postPurchaseBenefits.title, 'Título de beneficios post-compra', 120),
      items: features(post.postPurchaseBenefits.items, 'Beneficios post-compra', 6) as Array<{ title: string; description: string; icon: string }>,
    },
    postPurchaseVideo: {
      enabled: post.postPurchaseVideo.enabled, title: cleanText(post.postPurchaseVideo.title, 'Título del video', 120), url: videoUrl,
      ...(content.postPurchaseVideo?.format && { format: content.postPurchaseVideo.format }),
    },
    hero: {
      eyebrow: cleanText(content.hero.eyebrow ?? '', 'Antetítulo principal', 120),
      secondaryImageUrl: cleanUrl(content.hero.secondaryImageUrl ?? '', 'Segunda imagen principal'),
      note: cleanText(content.hero.note ?? '', 'Nota de presentación', 240),
      noteTitle: cleanText(content.hero.noteTitle ?? '', 'Título de la nota', 120),
      headerCtaText: cleanText(content.hero.headerCtaText ?? '', 'Botón del encabezado', 60),
      ratingText: cleanText(content.hero.ratingText ?? '', 'Texto de calificación', 120),
      trustText: cleanText(content.hero.trustText ?? '', 'Línea de confianza', 160),
      footnote: cleanText(content.hero.footnote ?? '', 'Aclaración de formato', 160),
      title: cleanText(content.hero.title, 'Título', 160),
      ...(content.hero.titleAccent !== undefined ? { titleAccent: cleanText(content.hero.titleAccent, 'Título principal accent', 160) } : {}),
      subtitle: cleanText(content.hero.subtitle, 'Subtítulo', 400),
      imageUrl: cleanUrl(content.hero.imageUrl, 'Imagen principal'),
      ctaText: cleanText(content.hero.ctaText, 'Texto del botón', 60),
    },
    benefits: { ...section(content.benefits), ...copy(content.benefits, 'Your complete kit'), ...storyImage('benefits'), videoUrl: kitVideo, title: cleanText(content.benefits.title, 'Título de beneficios', 120), items: features(content.benefits.items, 'Beneficios') },
    painPoints: { closingText: cleanText(content.painPoints?.closingText ?? 'If this sounds familiar, here’s how we can help.', 'Cierre de problemas', 240), ...section(content.painPoints), ...copy(content.painPoints, 'Who this is for'), title: cleanText(content.painPoints?.title ?? '', 'Título de problemas', 120), items: features(content.painPoints?.items ?? [], 'Problemas') },
    socialProof: {
      ...section(content.socialProof), ...copy(content.socialProof),
      eyebrow: cleanText(content.socialProof?.eyebrow ?? 'Reader testimonials', 'Antetítulo de testimonios', 120),
      ...(rating !== undefined ? { rating } : {}), ...(customers !== undefined ? { customers } : {}), ...(satisfaction !== undefined ? { satisfaction } : {}),
      title: cleanText(content.socialProof?.title ?? '', 'Título de testimonios', 120),
      items: (content.socialProof?.items ?? []).map(item => {
        const name = cleanText(item.name, 'Nombre del testimonio', 120, true);
        const quote = cleanText(item.quote, 'Testimonio', 1200);
        const imageUrl = cleanUrl(item.imageUrl ?? '', 'Captura del testimonio');
        const photoUrl = cleanUrl(item.photoUrl ?? '', 'Foto del testimonio');
        if (item.format === 'chat' && !quote) fail('Agregá el mensaje del lector en cada conversación.');
        if (!quote && !imageUrl) fail('Agregá el texto o una captura de cada testimonio.');
        return {
          name, quote, ...(imageUrl ? { imageUrl } : {}), ...(photoUrl ? { photoUrl } : {}), ...(item.verified ? { verified: true } : {}), format: item.format ?? 'quote',
          ...(item.isExample ? { isExample: true } : {}),
          openingMessage: cleanText(item.openingMessage ?? '', 'Mensaje inicial', 1200),
          closingMessage: cleanText(item.closingMessage ?? '', 'Mensaje de cierre', 1200),
        };
      }),
    },
    bonuses: { ...section(content.bonuses), ...copy(content.bonuses, 'Free bonus'), title: cleanText(content.bonuses.title, 'Título de bonos', 120), chips: chips.map(chip => cleanText(chip, 'Etiqueta de bonos', 40)).filter(Boolean) },
    faq: {
      ...section(content.faq), title: cleanText(content.faq.title, 'Título de preguntas', 120),
      items: content.faq.items.map(item => ({
        question: cleanText(item.question, 'Pregunta', 240, true),
        answer: cleanText(item.answer, 'Respuesta', 1200, true),
      })),
    },
    guarantee: { ...section(content.guarantee), ...copy(content.guarantee), title: cleanText(content.guarantee.title, 'Título de garantía', 120), text: cleanText(content.guarantee.text, 'Garantía', 1200), ...(days !== undefined ? { days } : {}) },
    style: { accentColor: accent },
    promotion: {
      title: cleanText(content.promotion?.title ?? '', 'Título de la barra superior', 160),
      timerLabel: cleanText(content.promotion?.timerLabel ?? PROMOTION_COPY.timerLabel, 'Texto del contador', 120),
      spotsText: cleanText(content.promotion?.spotsText ?? PROMOTION_COPY.spotsText, 'Texto de cupos', 240),
      enabled: content.promotion?.enabled ?? true,
      timerMode: content.promotion?.timerMode ?? 'session',
      ...(remainingSpots !== undefined ? { remainingSpots } : {}),
      message: cleanText(content.promotion?.message ?? 'Limited-time offer', 'Mensaje de promoción', 120),
      ...(endsAt !== undefined ? { endsAt } : {}),
    },
    steps: {
      ...section(content.steps), ...copy(content.steps, 'The method, step by step'), title: cleanText(content.steps?.title ?? 'How to put it into practice', 'Título de pasos', 120),
      items: features(content.steps?.items ?? [], 'Pasos', 7) as Array<{ title: string; description: string; icon: string }>,
    },
    summary: { ...section(content.summary), ...copy(content.summary), title: cleanText(content.summary?.title ?? 'What your order includes', 'Título del resumen', 120) },
    closing: {
      enabled: content.closing?.enabled ?? true,
      title: cleanText(content.closing?.title ?? '', 'Título de cierre', 160),
      ctaText: cleanText(content.closing?.ctaText ?? '', 'Botón de cierre', 60),
      stickyEnabled: content.closing?.stickyEnabled ?? true,
      text: cleanText(content.closing?.text ?? '', 'Texto de cierre', 600),
      note: cleanText(content.closing?.note ?? '', 'Nota de cierre', 240),
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
      salesCount: content.activity?.salesCount ?? ACTIVITY_DEFAULTS.salesCount
    },
  };
}

export const getForStore = query({
  args: { storeId: v.id('stores'), type: landingKind },
  handler: async (ctx, { storeId, type = 'classic' }) => {
    await requireAdmin(ctx);
    return await forStore(ctx, storeId, type);
  },
});

// Draft preview for the panel; the public site only ever reads `published`.
export const preview = query({
  args: { storeId: v.id('stores'), type: landingKind },
  handler: async (ctx, { storeId, type = 'classic' }) => {
    await requireAdmin(ctx);
    const store = await ctx.db.get(storeId);
    const landing = await forStore(ctx, storeId, type);
    if (!store || !landing) return null;
    if (type === 'quiz') return { quiz: landing.quizDraft, view: await buildLandingView(ctx, store, landing, landing.draft) };
    const view = await buildLandingView(ctx, store, landing, landing.draft);
    return view && { ...view, postPurchaseOffer: await buildPostPurchaseView(ctx, store, landing.draft) };
  },
});

export const saveDraft = mutation({
  args: { storeId: v.id('stores'), subdomain: v.optional(v.string()), type: landingKind, template: v.optional(v.string()), draft: v.optional(landingContent), quiz: v.optional(v.any()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.type === 'quiz') return saveQuizDraft(ctx, args.storeId, args.subdomain, args.quiz);
    if (!args.draft) fail('Falta el contenido clásico.');
    const template = args.template ?? 'classic';
    if (!(await ctx.db.get(args.storeId))) fail('La tienda ya no existe.');
    if (!TEMPLATES.includes(template)) fail('Plantilla: elegí una plantilla disponible.');
    const subdomain = await resolveAddress(ctx, args.storeId, args.subdomain);
    const draft = cleanContent(args.draft);
    const existing = await forStore(ctx, args.storeId);
    await ctx.db.patch(args.storeId, { purchaseDraft: draft });
    if (existing) {
      await ctx.db.patch(existing._id, { subdomain, template, draft });
      return existing._id;
    }
    return await ctx.db.insert('landings', { storeId: args.storeId, subdomain, template, draft });
  },
});

export const publish = mutation({
  args: { storeId: v.id('stores'), type: landingKind },
  handler: async (ctx, { storeId, type = 'classic' }) => {
    await requireAdmin(ctx);
    if (type === 'quiz') return publishQuiz(ctx, storeId);
    const landing = await forStore(ctx, storeId, type);
    if (!landing) fail('Guardá el borrador antes de publicar.');
    if (!landing.draft.hero.title) fail('Para publicar, completá el título principal.');
    await ctx.db.patch(storeId, { purchasePublished: landing.draft });
    await ctx.db.patch(landing._id, { published: landing.draft, publishedAt: Date.now() });
    return landing._id;
  },
});

export const list = query({
  args: { storeId: v.id('stores') }, handler: async (ctx, { storeId }) => {
    await requireAdmin(ctx); return ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', storeId)).collect();
  }
});
export const unpublish = mutation({
  args: { storeId: v.id('stores'), type: v.union(v.literal('classic'), v.literal('quiz')) }, handler: async (ctx, { storeId, type }) => {
    await requireAdmin(ctx); const row = await forStore(ctx, storeId, type);
    if (row) await ctx.db.patch(row._id, { published: undefined, publicationId: undefined, publishedAt: undefined });
  }
});
// Run repeatedly in batches; existing IDs, content and order references remain intact.
export const migrate = mutation({
  args: { cursor: v.union(v.string(), v.null()) }, handler: async (ctx, { cursor }) => {
    await requireAdmin(ctx);
    const page = await ctx.db.query('stores').paginate({ cursor, numItems: 50 });
    for (const store of page.page) {
      const classic = await forStore(ctx, store._id);
      if (classic) await ctx.db.patch(store._id, { subdomain: store.subdomain ?? classic.subdomain, purchaseDraft: store.purchaseDraft ?? classic.draft, ...((store.purchasePublished ?? classic.published) ? { purchasePublished: store.purchasePublished ?? classic.published } : {}) });
    }
    return { cursor: page.continueCursor, done: page.isDone };
  }
});
