import { assertQuiz } from '../../shared/quiz.js';

// Image briefs belong to the proposal, so failed images can be retried without
// regenerating its questions. Existing uploaded images always take precedence.
export function withImagePlan(value: any, copy: any, insertedIds: string[], audience: string) {
  const quiz = assertQuiz(value, true);
  const style = typeof copy.visualStyle === 'string' ? copy.visualStyle.slice(0, 700) : 'Ilustración editorial contemporánea, simple y cálida.';
  const brief = (item: any) => ({
    imagePrompt: JSON.stringify({
      scene: typeof item.imagePrompt === 'string' && item.imagePrompt.trim() ? item.imagePrompt.slice(0, 1800) : `${item.title}. ${item.description || ''}`.slice(0, 1800),
      style, audience: audience.slice(0, 1500),
      palette: { accent: quiz.identity.color, background: quiz.identity.background },
    }),
    imageAlt: typeof item.imageAlt === 'string' && item.imageAlt.trim() ? item.imageAlt.slice(0, 300) : `Ilustración sobre ${item.title}`.slice(0, 300),
  });
  for (const step of quiz.steps) {
    const index = insertedIds.indexOf(step.id);
    if (!step.imageUrl && (step.type === 'intro' || index >= 0)) Object.assign(step, brief(index >= 0 ? copy.steps[index] : copy), { imageLayout: 'top' });
  }
  for (const result of quiz.results) {
    // Final-page pictures planned by the wizard (`imageScene`) get the same shared brief.
    let planned = false;
    for (const block of result.blocks) for (const node of [block.now, block.after, ...(block.mockups || [])]) {
      if (!node || typeof node !== 'object' || typeof node.imageScene !== 'string') continue;
      if (!node.imageUrl) { Object.assign(node, brief({ imagePrompt: node.imageScene, title: node.imageAlt || node.label || '', imageAlt: node.imageAlt })); planned = true; }
      delete node.imageScene;
    }
    const generated = copy.results.find((r: any) => r.id === result.id);
    if (planned || !generated || result.blocks.some((b: any) => b.type === 'image') || result.blocks.length >= 40) continue;
    let id = 'ai_result_image';
    while (result.blocks.some((b: any) => b.id === id)) id += '_';
    const image = brief(generated);
    result.blocks.unshift({ id, type: 'image', ...image, alt: image.imageAlt });
  }
  return assertQuiz(quiz, true);
}
