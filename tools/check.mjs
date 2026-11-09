import assert from "node:assert/strict";
import { lessons, catalog } from "../data.js";
import { tokenize, quizItems } from "../core.js";
assert.equal(lessons.length, 18);
assert.equal(new Set(lessons.map((l) => l.id)).size, 18);
assert.deepEqual([...new Set(lessons.map((l) => l.session))].sort(), [
  "2023-12",
  "2024-06",
  "2024-12",
  "2025-06",
  "2025-12",
  "2026-06",
]);
for (const session of new Set(lessons.map((l) => l.session)))
  assert.equal(lessons.filter((l) => l.session === session).length, 3);
for (const l of lessons) {
  assert(l.verifiedSources.length >= 2, `${l.id}: two sources required`);
  assert(quizItems(l).length > 5);
  for (const source of l.verifiedSources)
    assert.equal(new URL(source.url).protocol, "https:");
  for (const [i, s] of l.sentences.entries()) {
    assert.deepEqual(
      tokenize(s.en),
      s.tokens.map((t) => t[0]),
      `${l.id} ${i}: token order`,
    );
    assert(
      s.zh && /[。！？]$/.test(s.zh),
      `${l.id} ${i}: complete Chinese sentence`,
    );
    assert(/[.!?]$/.test(s.en), `${l.id} ${i}: complete English sentence`);
    assert(
      s.tokens.every(
        (t) =>
          t.length === 2 && t[1].trim().length && /[\u3400-\u9fff]/.test(t[1]),
      ),
      `${l.id} ${i}: every token has Chinese gloss`,
    );
  }
}
assert.equal(
  catalog.sentences,
  lessons.reduce((n, l) => n + l.sentences.length, 0),
);
assert.equal(
  catalog.tokens,
  lessons.reduce(
    (n, l) => n + l.sentences.reduce((k, s) => k + s.tokens.length, 0),
    0,
  ),
);
console.log(
  `PASS: ${lessons.length} lessons, ${catalog.sentences} sentences, ${catalog.tokens} aligned words, all 6 sessions covered.`,
);
