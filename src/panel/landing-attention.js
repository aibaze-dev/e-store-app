// What each section of the classic landing still needs from the seller.
// `needs`: the section will not show (or cannot be published) as it is.
// `extras`: optional data the assistant never writes, such as photos and figures.
// Each entry has a short `label` for the section header and a full `text` for inside it.
export function landingAttention(content, { bonuses = 0, upsells = 0, hasCover = false } = {}) {
  const result = {};
  const add = (id, kind, label, text) => { (result[id] ??= { needs: [], extras: [] })[kind].push({ label, text }); };
  const on = key => content[key].enabled;
  const empty = (key, what) => { if (on(key) && content[key].items.length === 0) add(key, 'needs', `Sin ${what}`, `No tiene ${what} cargados: la sección no se muestra.`); };
  const proof = content.socialProof;

  if (!content.hero.title.trim()) add('hero', 'needs', 'Falta el título', 'Falta el título principal: sin él no se puede publicar.');
  if (!content.hero.imageUrl && !hasCover) add('cover', 'needs', 'Falta la foto principal', 'Falta la foto principal y el producto no tiene portada.');
  if (!content.hero.secondaryImageUrl) add('cover', 'extras', 'Segunda foto', 'Segunda foto sin subir: se muestra solo la principal.');
  if (!(proof.rating > 0)) add('cover', 'extras', 'Calificación', 'Calificación con estrellas sin cargar: no se muestran las estrellas.');
  if (!content.hero.ratingText) add('cover', 'extras', 'Texto de calificación', 'Texto junto a las estrellas vacío.');
  if (content.promotion.enabled && !(content.promotion.remainingSpots > 0)) add('promotion', 'extras', 'Cupos', 'Cupos sin cantidad: no se muestran.');
  if (on('introduction') && !content.introduction.title && !content.introduction.text) add('introduction', 'needs', 'Sin texto', 'No tiene título ni texto: la sección no se muestra.');
  if (on('transformation') && !content.transformation.imageUrl) add('transformation', 'needs', 'Falta la foto', 'Falta la foto: la sección no se publica hasta que la subas.');
  empty('painPoints', 'problemas');
  empty('highlights', 'tarjetas');
  if (on('bonusCards') && bonuses === 0) add('bonusCards', 'needs', 'Sin bonos en la tienda', 'La tienda no tiene bonos cargados: la sección no se muestra.');
  if (on('riskFree') && !content.riskFree.title && !content.riskFree.text && !content.riskFree.imageUrl) add('riskFree', 'needs', 'Sin contenido', 'No tiene sello, título ni texto: la sección no se muestra.');
  else if (on('riskFree') && !content.riskFree.imageUrl) add('riskFree', 'extras', 'Sello', 'Sello sin subir: se muestra un escudo con tu color.');
  if (on('bonuses') && bonuses === 0) add('offer', 'needs', 'Sin bonos en la tienda', 'La tienda no tiene bonos cargados: la sección no se muestra.');
  empty('steps', 'pasos');
  if (on('about') && !content.about.text) add('about', 'needs', 'Sin texto', 'No tiene texto: la sección no se muestra.');
  else if (on('about') && !content.about.imageUrl) add('about', 'extras', 'Foto del equipo', 'Foto del equipo sin subir.');
  if (on('showcase') && !content.showcase.imageUrl && !content.showcase.videoUrl) add('showcase', 'needs', 'Falta la foto o el video', 'Falta la foto o el video: la sección no se publica hasta que subas uno.');
  empty('benefits', 'elementos');
  if (on('benefits') && content.benefits.items.length > 0 && !content.benefits.imageUrl && !content.benefits.videoUrl) add('benefits', 'extras', 'Foto o video', 'Foto o video del kit sin cargar.');
  if (on('socialProof')) {
    const examples = proof.items.filter(item => item.isExample).length;
    if (examples > 0) add('socialProof', 'needs', 'Testimonios de ejemplo', `${examples === 1 ? 'Hay 1 testimonio de ejemplo escrito' : `Hay ${examples} testimonios de ejemplo escritos`} por la IA: reemplazalos por opiniones reales.`);
    if (proof.items.length === 0 && !(proof.rating > 0) && !(proof.customers > 0) && !(proof.satisfaction > 0)) add('socialProof', 'needs', 'Sin testimonios', 'No tiene testimonios ni métricas: la sección no se muestra.');
    if (!(proof.customers > 0) || !(proof.satisfaction > 0)) add('socialProof', 'extras', 'Métricas', 'Métricas de clientes y satisfacción sin cargar.');
  }
  empty('comparison', 'columnas');
  if (on('comparison') && content.comparison.items.length > 0 && !content.comparison.items.some(item => item.highlighted)) add('comparison', 'needs', 'Sin columna destacada', 'Ninguna columna está marcada como tu producto.');
  if (on('guarantee') && !content.guarantee.text) add('guarantee', 'needs', 'Sin condiciones', 'Sin condiciones escritas: la garantía no se muestra.');
  empty('faq', 'preguntas');
  if (on('combo') && upsells === 0) add('combo', 'needs', 'Sin extras en la tienda', 'La tienda no tiene extras: el bloque no se muestra y los botones van directo al checkout.');
  if (!content.footer.termsUrl && !content.footer.privacyUrl) add('identity', 'extras', 'Enlaces legales', 'Términos y política de privacidad sin cargar.');
  return result;
}
