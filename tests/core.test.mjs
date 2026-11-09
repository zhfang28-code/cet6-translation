import test from "node:test";
import assert from "node:assert/strict";
import {
  blankState,
  recordMistake,
  validateState,
  mergeStates,
  normalize,
  tokenize,
  maskedSentence,
  quizItems,
  readState,
  STORAGE_KEY,
} from "../core.js";
const item = {
  word: "Development",
  meaning: "发展",
  lessonId: "sample",
  sentenceIndex: 0,
  tokenIndex: 0,
};
test("manual and spelling mistakes share a word; only incorrect answers increase the count", () => {
  const state = blankState();
  recordMistake(state, item);
  recordMistake(state, item);
  assert.equal(Object.keys(state.mistakes).length, 1);
  assert.equal(state.mistakes.development.wrongCount, 0);
  recordMistake(state, { ...item, word: "development" }, "wrong");
  assert.equal(state.mistakes.development.wrongCount, 1);
  assert.equal(state.mistakes.development.manual, true);
  state.mistakes.development.mastered = true;
  recordMistake(state, item, "wrong");
  assert.equal(state.mistakes.development.mastered, false);
  assert.equal(state.mistakes.development.wrongCount, 2);
});
test("answer comparison ignores case and outer whitespace but preserves grammar and hyphenation", () => {
  assert.equal(normalize(" DEVELOPMENT "), normalize("development"));
  assert.notEqual(normalize("self reliance"), normalize("self-reliance"));
  assert.notEqual(normalize("network"), normalize("networks"));
  assert.equal(normalize("China’s"), normalize("China's"));
});
test("backup round-trip restores mistakes and progress", () => {
  const state = blankState();
  recordMistake(state, item, "wrong");
  state.completed = ["sample"];
  state.settings.showWords = false;
  const storage = {
    getItem: (key) => (key === STORAGE_KEY ? JSON.stringify(state) : null),
  };
  assert.deepEqual(readState(storage), state);
});
test("backup merge is idempotent, does not double counts and preserves local preferences", () => {
  const a = blankState(),
    b = blankState();
  recordMistake(a, item, "wrong");
  recordMistake(b, item, "wrong");
  recordMistake(b, item, "wrong");
  b.completed = ["sample"];
  b.settings.showWords = false;
  const merged = mergeStates(a, validateState(b));
  assert.equal(merged.mistakes.development.wrongCount, 2);
  assert.deepEqual(merged.completed, ["sample"]);
  assert.equal(merged.settings.showWords, true);
  assert.deepEqual(mergeStates(merged, b), merged);
});
test("malformed or hostile backup entries cannot pollute state", () => {
  assert.throws(() => validateState({ version: 2, mistakes: {} }));
  assert.throws(() => validateState({ version: 1, mistakes: [] }));
  const state = validateState(
    JSON.parse(
      '{"version":1,"mistakes":{"__proto__":{"word":"__proto__","meaning":"x"},"<script>":{"word":"<script>","meaning":"x"}},"completed":[{},"good"]}',
    ),
  );
  assert.equal(Object.keys(state.mistakes).length, 0);
  assert.deepEqual(state.completed, ["good"]);
});
test("tokenization keeps hyphenated words, possessives, numbers and punctuation in order", () => {
  assert.deepEqual(
    tokenize("China's self-reliance grew in 2026, by 1.5 percent."),
    ["China's", "self-reliance", "grew", "in", "2026", "by", "1.5", "percent"],
  );
});
test("quiz masks every repeated occurrence without leaking the answer", () => {
  assert.equal(
    maskedSentence("Networks connect networks, not networking.", "networks"),
    "______ connect ______, not networking.",
  );
});
test("quiz selection skips function words and deduplicates content words", () => {
  const lesson = {
    id: "x",
    sentences: [
      {
        tokens: [
          ["The", "定冠词"],
          ["networks", "网络"],
          ["connect", "连接"],
          ["networks", "网络"],
        ],
      },
    ],
  };
  assert.deepEqual(
    quizItems(lesson).map((x) => x.word),
    ["networks", "connect"],
  );
});
