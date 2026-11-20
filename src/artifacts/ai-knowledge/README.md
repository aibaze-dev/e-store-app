# Test Your AI Knowledge

Public English-language artifact: `/a/ai-knowledge`. Local React state and a curated question bank; no AI calls, accounts, backend writes, or new dependencies. Registered in the shared artifact metadata and the separate lazy component map.

## Source and editorial map

Based on **Master Claude in 5 Days**, November 2026 edition, supplied by the user:
https://capable-gnu-944.convex.cloud/api/storage/9ca0b6b6-b885-4843-b0fd-40308765ea53

The PDF has 161 pages. Physical page indices (one-based) match printed page numbers. Its contents on page 5 define the day groups; page 111 describes the separate practice tool. The PDF is linked, not bundled or downloaded by the artifact.

| Scope | Chapters | Pages |
| --- | --- | --- |
| Foundations (included in global) | 1 | 7–15 |
| Day 1 · Set up | 2–3 | 16–38 |
| Day 2 · Ask | 4–5 | 39–56 |
| Day 3 · Work | 6–7 | 57–76 |
| Day 4 · Train | 8–9 | 77–94 |
| Day 5 · Build | 10–11 | 95–110 |

`questions.js` contains 44 original multiple-choice questions, four per chapter, with one correct answer, an explanation, and a specific teaching page (not the answer-key page). Questions test the ebook's lessons rather than asserting current plan prices, model versions, or menu locations. If the ebook edition changes, manually review every question and page reference before updating the source URL.

## Selection and scoring

- Day test: six questions, three per chapter.
- Global test: 22 questions, two per chapter including the introduction.
- Fisher–Yates shuffles selection, question order, and option order. Stable option IDs preserve grading when options move.
- A retry in the same mounted session must differ from the previous question set for that mode. If randomness repeats the set, replace one question with an unused question from the same chapter. Separate sessions are independently randomized; repeats are possible across sessions.
- One question at a time; an answer is required to advance. Back allows revisions. No answer feedback is revealed until completion.
- Every correct answer has equal weight. Percentage is rounded to the nearest integer. Results include group scores, missed answers, corrections, explanations, and `#page=N` ebook links. Correct answers can also be reviewed.
- PDF fragment navigation depends on the viewer. Always show the human-readable page number as a fallback.

Answers/results live only in React memory. Leaving an attempt through the tool asks for confirmation; browser reload/close uses the native beforeunload warning when supported. Reloading loses the attempt. This is a practice tool, not a secure examination or certification: answer keys ship in the public lazy chunk.

## Maintenance and validation

All tool CSS is scoped to `.artifact-ai-knowledge`, including its portaled confirmation dialog. The public route sets/restores the title through `ArtifactPage`; there is no `InternalTheme` wrapper. Keep the slug stable after sharing it.

`test/ai-knowledge.test.js` checks chapter/page coverage, answer IDs, balanced selection, nonrepeating retries, independent option shuffles, partial/perfect/zero scores, changed answers, invalid completion, and ebook page links. Run `pnpm test` and `pnpm build` after edits. No deployment is performed by these commands.

Local browser validation (2026-11-20): public direct access and reload, document title, desktop and 390/320 px layouts without horizontal overflow, disabled advance before answering, Back retaining an answer, exit cancellation/confirmation, and fresh-test reset. A Day 2 attempt with two deliberate errors showed 4/6 (67%) and the correct review links (pages 41 and 54). A global attempt visited 22 unique questions and displayed a score with all six chapter groups and the missed-answer review. PDF fragment URLs were checked; exact scrolling in each external PDF viewer is not guaranteed. No production deploy or cloud data writes.
