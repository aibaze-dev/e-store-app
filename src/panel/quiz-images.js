export function quizImages(quiz) {
  if (!quiz) return [];
  return [
    ...quiz.steps.filter(s => s.imagePrompt).map(s => ({ key: `step:${s.id}`, title: s.title, node: s })),
    ...quiz.results.flatMap(r => r.blocks.filter(b => b.imagePrompt).map(b => ({ key: `result:${r.id}:${b.id}`, title: r.title, node: b }))),
  ];
}

// Work on a clone: a partial failure never erases successful images or the
// original proposal. Retries request only missing images, with two in flight.
export async function generateQuizImages(proposal, generateImage, onProgress = () => {}) {
  const quiz = structuredClone(proposal);
  const pending = quizImages(quiz).filter(item => !item.node.imageUrl);
  let cursor = 0, completed = 0, failed = 0;
  const notify = () => onProgress({ quiz: structuredClone(quiz), completed, failed, total: pending.length });
  notify();
  const worker = async () => {
    while (cursor < pending.length) {
      const item = pending[cursor++];
      try {
        const result = await generateImage({ prompt: item.node.imagePrompt });
        if (!result?.imageUrl || new URL(result.imageUrl).protocol !== 'https:') throw new Error('Invalid image URL');
        item.node.imageUrl = result.imageUrl;
      } catch { failed++; }
      completed++;
      notify();
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, pending.length) }, worker));
  return { quiz, failed };
}
