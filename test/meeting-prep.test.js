import { describe, expect, it } from 'vitest';
import { SCENARIOS, emptyForm, validateForm, buildCard, cardBlocks, cardText, rehearsalPrompt } from '../src/artifacts/meeting-prep/templates.js';
import { newTimer, startTimer, pauseTimer, tickTimer, remainingAt, timerLabel } from '../src/artifacts/meeting-prep/timer.js';

const valid = () => ({ ...emptyForm(), outcome: 'Agree on the next step.', point: 'We need a clear handoff.' });

describe('meeting card templates', () => {
  it.each(SCENARIOS)('builds a complete card for $id without mixing scenarios', scenario => {
    const form = { ...scenario.example, scenario: scenario.id };
    const card = buildCard(form);
    expect(validateForm(form)).toEqual({});
    expect(card.opening).toBe(scenario.opening);
    expect(card.closing).toBe(scenario.closing);
    expect(card.point).toBe(form.point);
    expect(card.facts).toEqual(form.facts);
    expect(card.ask).toBe(form.ask);
    expect(cardText(card)).toContain(scenario.label);
    expect(rehearsalPrompt(card)).toContain(form.outcome);
  });
  it('requires a real outcome and main point, including when whitespace is entered', () => {
    expect(Object.keys(validateForm(emptyForm()))).toEqual(['outcome', 'point']);
    expect(buildCard({ ...valid(), outcome: ' \n ' })).toBeNull();
    expect(buildCard({ ...valid(), point: '\t' })).toBeNull();
    expect(buildCard(valid())).not.toBeNull();
  });
  it('omits absent facts and audience and provides an honest default ask', () => {
    const card = buildCard(valid());
    expect(card.facts).toEqual([]);
    expect(card.ask).toBe('Can we agree on the next step?');
    expect(cardBlocks(card).map(([label]) => label)).not.toContain('My supporting facts');
    expect(cardText(card)).not.toContain('WHO I’M SPEAKING WITH');
    expect(cardText(card)).not.toContain('undefined');
  });
  it('preserves user wording, line breaks, numbers, and literal markup', () => {
    const form = { ...valid(), point: '  Our costs are $3,000.\nDo not change this.  ', facts: ['  2 / 5 handoffs were late. ', '', '<script>not executable</script>'], ask: '  Can we review this?  ' };
    const card = buildCard(form);
    expect(card.point).toBe(form.point);
    expect(card.ask).toBe(form.ask);
    expect(card.facts).toEqual([form.facts[0], form.facts[2]]);
    expect(cardText(card)).toContain(form.point);
  });
  it('includes at most three supplied facts and does not fill missing ones from examples', () => {
    const card = buildCard({ ...valid(), facts: ['First', ' ', 'Third', 'Fourth'] });
    expect(card.facts).toEqual(['First', 'Third']);
    expect(cardText(card)).not.toContain('Fourth');
    expect(cardText(card)).not.toContain('handoffs last month');
  });
  it('keeps the card independent of subsequent answer changes', () => {
    const form = { ...valid(), facts: ['Original fact'] };
    const card = buildCard(form);
    form.facts[0] = 'Changed'; form.point = 'Changed';
    expect(card.facts).toEqual(['Original fact']);
    expect(card.point).toBe('We need a clear handoff.');
  });
  it('uses current manual edits consistently for copying, display, and rehearsal', () => {
    const card = { ...buildCard(valid()), opening: 'My custom opening.', point: 'My edited point.', facts: ['', 'A new fact', ' '], ask: '' };
    expect(cardBlocks(card)).not.toContainEqual(['My ask', '']);
    for (const text of [cardText(card), rehearsalPrompt(card)]) {
      expect(text).toContain('My custom opening.');
      expect(text).toContain('My edited point.');
      expect(text).toContain('A new fact');
      expect(text).not.toContain('We need a clear handoff.');
    }
  });
  it('makes the rehearsal one question at a time and feedback conditional on ending', () => {
    const prompt = rehearsalPrompt(buildCard(valid()));
    expect(prompt).toContain('ask one realistic question at a time');
    expect(prompt).toContain('Wait for my response');
    expect(prompt).toContain('After three exchanges, or when I say "finish"');
    expect(prompt).toContain('ask who you should play');
    expect(prompt).toContain('do not claim to assess my voice');
  });
  it('is deterministic and does not mutate frozen answers', () => {
    const form = Object.freeze({ ...valid(), facts: Object.freeze(['A fact']) });
    expect(buildCard(form)).toEqual(buildCard(form));
    expect(emptyForm().facts).not.toBe(emptyForm().facts);
  });
});

describe('60-second practice timer', () => {
  it('starts idle and does not count down before the user starts', () => {
    const timer = newTimer();
    expect(timer.status).toBe('idle');
    expect(timerLabel(timer, 5_000_000)).toBe('1:00');
  });
  it('uses elapsed time rather than counting callbacks', () => {
    const timer = startTimer(newTimer(), 1000);
    expect(remainingAt(timer, 16_750)).toBe(44_250);
    expect(timerLabel(timer, 16_750)).toBe('0:45');
    expect(timerLabel(timer, 60_999)).toBe('0:01');
  });
  it('finishes after a background-tab delay and never goes negative', () => {
    const timer = startTimer(newTimer(), 1000);
    const finished = tickTimer(timer, 100_000);
    expect(finished).toEqual({ status: 'finished', remainingMs: 0, deadline: null });
    expect(timerLabel(finished, 200_000)).toBe('0:00');
  });
  it('pauses and resumes from the remaining duration, excluding paused time', () => {
    const running = startTimer(newTimer(), 10_000);
    const paused = pauseTimer(running, 25_000);
    expect(paused.remainingMs).toBe(45_000);
    expect(remainingAt(paused, 200_000)).toBe(45_000);
    const resumed = startTimer(paused, 200_000);
    expect(remainingAt(resumed, 220_000)).toBe(25_000);
    expect(tickTimer(resumed, 245_000).status).toBe('finished');
  });
  it('handles pause after expiry as finished and requires reset before restarting', () => {
    const timer = startTimer(newTimer(), 0);
    const finished = pauseTimer(timer, 60_000);
    expect(finished.status).toBe('finished');
    expect(startTimer(finished, 80_000)).toEqual(finished);
    expect(startTimer(newTimer(), 80_000).deadline).toBe(140_000);
  });
  it('does not extend a running timer on repeated start', () => {
    const timer = startTimer(newTimer(), 1000);
    expect(startTimer(timer, 20_000)).toBe(timer);
    expect(tickTimer(timer, 30_000)).toBe(timer);
  });
});
