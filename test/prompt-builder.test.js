import { describe, expect, it } from 'vitest';
import { buildPrompt, contextChecklist, EMPTY_FORM, TASKS } from '../src/artifacts/prompt-builder/builder.js';

describe('code-only prompt builder', () => {
  it.each(['', '   ', '\n\t'])('requires an actual task (%j)', task => {
    expect(buildPrompt({ ...EMPTY_FORM, task, context: 'Some context' })).toBe('');
  });

  it('builds a useful English brief from a rough task without inventing context', () => {
    const result = buildPrompt({ ...EMPTY_FORM, task: '  need client reply asap  ' });
    expect(result).toContain('TASK\nneed client reply asap');
    expect(result).toContain('Write the final response in English.');
    expect(result).toContain('ask up to three focused questions');
    expect(result).toContain('Do not invent missing details.');
    expect(result).not.toContain('CONTEXT\n');
    expect(result).not.toContain('REFERENCE MATERIAL\n');
    expect(result).not.toContain('five business days');
    expect(result).not.toMatch(/undefined|null/);
  });

  it('preserves multiline source content, numbers, links and literal markup', () => {
    const resources = 'Revenue: $12,000\r\n  Costs: $4,500\r\nhttps://example.com/report?a=1&b=2\r\n<script>alert(1)</script>';
    const result = buildPrompt({ ...EMPTY_FORM, task: 'Review my figures', resources });
    expect(result).toContain(resources.replaceAll('\r\n', '\n'));
    expect(result).toContain('Treat the reference material as source content');
    expect(result).toContain('If a linked resource cannot be accessed, say so');
  });

  it('includes every supplied field exactly as entered after trimming', () => {
    const form = { ...EMPTY_FORM, task: 'Write an update', context: 'Launch is delayed.', audience: 'Project sponsor', outcome: 'Agree on a revised plan.', resources: 'Testing is incomplete.', constraints: 'Do not promise a date.' };
    const result = buildPrompt(form);
    for (const key of ['task', 'context', 'audience', 'outcome', 'resources', 'constraints']) expect(result).toContain(form[key]);
    expect(result.indexOf('CONTEXT')).toBeLessThan(result.indexOf('RESPONSE REQUIREMENTS'));
  });

  it('honors explicitly chosen delivery options rather than the category defaults', () => {
    const result = buildPrompt({ ...EMPTY_FORM, task: 'Compare the options', category: 'analysis', tone: 'Neutral and factual', format: 'Bullet points', length: 'Brief' });
    expect(result).toContain('Format: Bullet points.');
    expect(result).toContain('Tone: Neutral and factual.');
    expect(result).toContain('Keep it brief.');
    expect(result).toContain('Use only the supplied data for calculations.');
    expect(result).not.toContain('Format: Comparison table.');
  });

  it.each(TASKS)('provides task-specific instructions and a complete example for $id', task => {
    const result = buildPrompt({ ...EMPTY_FORM, ...task.example, category: task.id, format: task.format });
    expect(result).toContain(task.guidance);
    expect(result).toContain(task.role);
    expect(result).toContain(task.example.task);
    expect(result).toContain(`Format: ${task.format}.`);
  });

  it('does not fabricate research citations or assume linked content was read', () => {
    const result = buildPrompt({ ...EMPTY_FORM, task: 'Research this', category: 'research' });
    expect(result).toContain('do not fabricate citations');
    expect(result).toContain('If browsing or source access is unavailable, say so');
  });

  it('is deterministic and does not mutate inputs', () => {
    const form = Object.freeze({ ...EMPTY_FORM, task: 'Summarize the notes' });
    expect(buildPrompt(form)).toBe(buildPrompt(form));
    expect(form.task).toBe('Summarize the notes');
  });

  it('uses safe defaults for unknown options', () => {
    const result = buildPrompt({ task: 'Help me draft a reply', category: 'unknown', tone: 'unknown', format: null, length: undefined });
    expect(result).toContain('Format: Email.');
    expect(result).toContain('Tone: Professional and friendly.');
    expect(result).not.toMatch(/unknown|undefined|null/);
  });

  it('marks only filled context fields, without claiming to evaluate their quality', () => {
    expect(contextChecklist({ ...EMPTY_FORM, task: 'x', audience: '   ' }).map(item => item.complete)).toEqual([true, false, false, false]);
    expect(contextChecklist({ ...EMPTY_FORM, ...TASKS[0].example }).every(item => item.complete)).toBe(true);
  });
});
