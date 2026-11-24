// Public metadata only. Keep component imports in components.js so the panel
// can list artifacts without importing their implementation.
// Entry: { slug, name, names, description, coverUrl? }
export const artifacts = [
  {
    slug: 'project-brief',
    names: { es: '¡Tu propia app a medida!', pt: 'Seu próprio app sob medida!' },
    name: 'Your Own Custom App!',
    description: 'Share the details for your purchased landing page or custom system and see when it will be ready.',
  },
  {
    slug: 'ai-knowledge',
    names: { es: 'Pon a prueba lo que sabes de IA', pt: 'Teste seus conhecimentos de IA' },
    name: 'Test Your AI Knowledge',
    description: 'Test what you learned in Master Claude in 5 Days. Choose a day or a fresh global test, get your score, and find the exact ebook pages to revisit.',
  },
  {
    slug: 'prompt-builder',
    names: { es: 'Constructor de prompts', pt: 'Construtor de prompts' },
    name: 'Prompt Builder',
    description: 'Turn a rough idea into a clear, structured prompt. Choose a task, add context, and copy your instructions. No AI required.',
  },
  {
    slug: 'meeting-prep',
    names: { es: 'Prepara tu reunión', pt: 'Prepare sua reunião' },
    name: 'Meeting Prep',
    description: 'Prepare what to say, build your own meeting card, and rehearse for 60 seconds. A clearer point. A calmer start.',
  },
];

export function artifactNameFor(artifact, language) {
  return artifact?.names?.[language] || artifact?.name;
}

// The product's own name is its base title (it starts as the English catalog name). Another
// language shows the title written for it, or else the catalog translation.
export function storeProductName(product, language) {
  if (product?.type !== 'artifact' || !language) return product?.name;
  const artifact = artifacts.find(entry => entry.slug === product.artifactSlug);
  return product.artifactTitles?.[language] || artifact?.names?.[language] || product.name;
}
