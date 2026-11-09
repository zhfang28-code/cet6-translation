import fs from "node:fs/promises";
import { tokenize } from "../core.js";
const files = [
  "research-2023-2024.json",
  "research-2024-2025.json",
  "research-2025-2026.json",
];
const lessons = [];
for (const file of files) {
  const entries = JSON.parse(
    await fs.readFile(new URL("../" + file, import.meta.url), "utf8"),
  );
  for (const l of entries) {
    for (const [si, s] of l.sentences.entries()) {
      const words = tokenize(s.en),
        gloss = Array.isArray(s.gloss)
          ? s.gloss
          : s.gloss.split("|").map((g) => g.trim());
      if (words.length !== gloss.length)
        throw new Error(
          `${l.id} sentence ${si + 1}: ${words.length} words / ${gloss.length} meanings`,
        );
      s.tokens = words.map((w, i) => [w, gloss[i]]);
      delete s.gloss;
    }
    lessons.push(l);
  }
}
lessons.sort(
  (a, b) => b.session.localeCompare(a.session) || a.id.localeCompare(b.id),
);
const catalog = {
  checkedAt: "2026-11-07",
  period: "2023-12/2026-06",
  sessions: 6,
  lessons: lessons.length,
  sentences: lessons.reduce((n, l) => n + l.sentences.length, 0),
  tokens: lessons.reduce(
    (n, l) => n + l.sentences.reduce((k, s) => k + s.tokens.length, 0),
    0,
  ),
  translationType: "独立编写的学习参考译文；中文为学习释义，原题请查看来源链接",
};
await fs.writeFile(
  new URL("../data.js", import.meta.url),
  `// Generated from individually verified research notes.\nexport const catalog = ${JSON.stringify(catalog, null, 2)};\nexport const lessons = ${JSON.stringify(lessons, null, 2)};\n`,
);
console.log(catalog);
