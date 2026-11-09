export const STORAGE_KEY = "zhuci-cet6-v1";
export const tokenPattern =
  /[A-Za-z]+(?:['’][A-Za-z]+)?(?:-[A-Za-z]+)*|\d+(?:[.,]\d+)*/g;
export const tokenize = (text) =>
  Array.from(text.matchAll(tokenPattern), (m) => m[0]);
export const normalize = (text) =>
  String(text).normalize("NFKC").trim().toLowerCase().replaceAll("’", "'");
export const escapeHtml = (text) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const blankState = () => ({
  version: 1,
  settings: { showWords: true, showSentence: true, fontSize: "normal" },
  mistakes: {},
  completed: [],
  lastLesson: null,
});
export function validateState(input) {
  if (
    !input ||
    input.version !== 1 ||
    !input.mistakes ||
    Array.isArray(input.mistakes) ||
    typeof input.mistakes !== "object"
  )
    throw new Error("不是有效的逐词备份文件");
  const state = blankState();
  const settings = input.settings || {};
  state.settings = {
    showWords: settings.showWords !== false,
    showSentence: settings.showSentence !== false,
    fontSize: settings.fontSize === "large" ? "large" : "normal",
  };
  state.completed = Array.isArray(input.completed)
    ? input.completed.filter((x) => typeof x === "string").slice(0, 1000)
    : [];
  state.lastLesson =
    typeof input.lastLesson === "string" ? input.lastLesson : null;
  for (const [key, m] of Object.entries(input.mistakes).slice(0, 10000)) {
    if (
      !m ||
      typeof m.word !== "string" ||
      typeof m.meaning !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9’'.,-]*$/.test(m.word) ||
      key !== normalize(m.word)
    )
      continue;
    state.mistakes[key] = {
      word: m.word.slice(0, 100),
      meaning: m.meaning.slice(0, 300),
      lessonId: String(m.lessonId || "").slice(0, 100),
      sentenceIndex: Math.max(0, Math.trunc(Number(m.sentenceIndex) || 0)),
      tokenIndex: Math.max(0, Math.trunc(Number(m.tokenIndex) || 0)),
      wrongCount: Math.max(
        0,
        Math.min(100000, Math.trunc(Number(m.wrongCount) || 0)),
      ),
      manual: Boolean(m.manual),
      mastered: Boolean(m.mastered),
      lastSeen: typeof m.lastSeen === "string" ? m.lastSeen.slice(0, 30) : "",
    };
  }
  return state;
}
export function readState(storage) {
  try {
    const value = storage.getItem(STORAGE_KEY);
    return value ? validateState(JSON.parse(value)) : blankState();
  } catch {
    return blankState();
  }
}
export function recordMistake(state, item, reason = "manual") {
  const key = normalize(item.word);
  const previous = state.mistakes[key];
  state.mistakes[key] = {
    ...item,
    wrongCount: (previous?.wrongCount || 0) + (reason === "wrong" ? 1 : 0),
    manual: reason === "manual" || Boolean(previous?.manual),
    mastered: false,
    lastSeen: new Date().toISOString(),
  };
  return state.mistakes[key];
}
export function mergeStates(current, imported) {
  const merged = validateState(current);
  for (const [key, value] of Object.entries(imported.mistakes)) {
    const old = merged.mistakes[key];
    if (!old) merged.mistakes[key] = value;
    else
      merged.mistakes[key] = {
        ...(old.lastSeen > value.lastSeen ? old : value),
        wrongCount: Math.max(old.wrongCount, value.wrongCount),
        manual: old.manual || value.manual,
        mastered: old.mastered && value.mastered,
      };
  }
  merged.completed = [
    ...new Set([...current.completed, ...imported.completed]),
  ];
  return merged;
}
const skipWords = new Set(
  "a an the of to and or in on at for by with from is are was were be been being as it its this that these those has have had will would can could may might should shall must do does did not also than their they them we our who which whose there such more most much very both all any each every one two three he she his her into over under between through during about among along up out per so but if while when then what how us you your only even many some other another".split(
    " ",
  ),
);
export function quizItems(lesson, includeAll = false) {
  const found = new Set();
  return lesson.sentences
    .flatMap((sentence, sentenceIndex) =>
      sentence.tokens.map(([word, meaning], tokenIndex) => ({
        word,
        meaning,
        lessonId: lesson.id,
        sentenceIndex,
        tokenIndex,
      })),
    )
    .filter((item) => {
      const key = normalize(item.word);
      if (
        found.has(key) ||
        /^\d/.test(key) ||
        (!includeAll && (skipWords.has(key) || key.length < 4))
      )
        return false;
      found.add(key);
      return true;
    });
}
export function maskedSentence(sentence, word) {
  return sentence.replace(tokenPattern, (token) =>
    normalize(token) === normalize(word) ? "______" : token,
  );
}
