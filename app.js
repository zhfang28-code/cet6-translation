import { lessons, catalog } from "./data.js";
import {
  STORAGE_KEY,
  blankState,
  readState,
  validateState,
  mergeStates,
  recordMistake,
  quizItems,
  maskedSentence,
  normalize,
  escapeHtml as esc,
} from "./core.js";

const main = document.querySelector("#main");
const dialog = document.querySelector("#word-dialog");
const paths = {
  book: "M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4V4Zm16 0h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h3V4Z",
  notebook: "M6 3h13v18H6V3ZM3 7h5M3 12h5M3 17h5M11 8h4M11 12h4",
  settings:
    "M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.2 2.2m8.4 8.4 2.2 2.2M5.6 18.4l2.2-2.2m8.4-8.4 2.2-2.2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-2 4 6 6",
  check: "m5 12 4 4L19 6",
  leaf: "M5 19C4 7 10 3 20 4c0 11-5 17-15 15Zm0 0L16 8",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  audio: "m11 4-6 5H2v6h3l6 5V4Zm4 4c3 2 3 6 0 8m3-11c5 4 5 10 0 14",
  close: "m6 6 12 12M6 18 18 6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  upload: "M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5",
  heart: "M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 1 9 8 15 7-6 12-11 8-15Z",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.book}"/></svg>`;
let storage;
let state;
try {
  storage = localStorage;
  state = readState(storage);
} catch {
  state = blankState();
}
let year = "all",
  search = "",
  mistakeFilter = "active",
  selectedWord = null,
  quiz = null,
  toastTimer,
  currentLesson = null;
const lessonMap = new Map(lessons.map((l) => [l.id, l]));
const activeMistakes = () =>
  Object.values(state.mistakes).filter((m) => !m.mastered);
const wordCount = (l) =>
  l.sentences.reduce((sum, s) => sum + s.tokens.length, 0);
const labelSession = (value) =>
  `${value.slice(0, 4)} 年 ${Number(value.slice(5))} 月`;
const topicIcon = (l) =>
  l.category.includes("科技")
    ? "globe"
    : l.category.includes("文化")
      ? "leaf"
      : "heart";
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 2800);
}
function persist() {
  try {
    if (!storage) throw new Error();
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    toast("浏览器未能保存记录，请到设置导出备份。");
  }
  updateNav();
}
function updateNav() {
  const route = location.hash.slice(1).split("/")[0] || "library";
  const selected =
    route === "mistakes"
      ? "mistakes"
      : route === "settings"
        ? "settings"
        : "library";
  const tabs = [
    ["library", "真题库", "book"],
    ["mistakes", "错词本", "notebook"],
    ["settings", "学习设置", "settings"],
  ];
  const html = tabs
    .map(
      ([id, label, i]) =>
        `<a class="nav-link ${selected === id ? "active" : ""}" href="#${id}" ${selected === id ? 'aria-current="page"' : ""}><span class="icon">${icon(i)}</span><span>${label}</span>${id === "mistakes" && activeMistakes().length ? `<span class="count">${activeMistakes().length}</span>` : ""}</a>`,
    )
    .join("");
  document.querySelector(".desktop-nav").innerHTML = html;
  document.querySelector(".bottom-nav").innerHTML = html;
  document.querySelector("#page-label").textContent =
    route === "lesson"
      ? "逐句精读"
      : route === "quiz"
        ? "拼写练习"
        : tabs.find((t) => t[0] === selected)[1];
  document.body.classList.toggle(
    "large-text",
    state.settings.fontSize === "large",
  );
}
function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}
function library() {
  const next = lessonMap.get(state.lastLesson) || lessons[0];
  main.innerHTML = `<section class="hero"><div><div class="eyebrow">A LITTLE EVERY DAY</div><h1>把长句拆开，<br>把每个词<span style="color:#78925c">记住。</span></h1><p>最近六次六级翻译真题，陪你逐句读懂、逐词积累。<br>从今天的一句开始。</p></div><div class="hero-art" aria-hidden="true"><div class="paper-art"><small>WORD BY WORD</small><strong>little by little.</strong><span></span></div><span class="art-tag">一点一点，积少成多</span><span class="art-star">✳</span></div></section>
  <section class="stats" aria-label="学习概况"><div class="stat"><span class="stat-icon">${icon("book")}</span><div><strong>${lessons.length}</strong><small>篇真题主题</small></div></div><div class="stat"><span class="stat-icon">${icon("check")}</span><div><strong>${state.completed.filter((id) => lessonMap.has(id)).length}</strong><small>篇已完成精读</small></div></div><div class="stat"><span class="stat-icon">${icon("notebook")}</span><div><strong>${activeMistakes().length}</strong><small>个待复习单词</small></div></div></section>
  <section class="continue-card"><div class="continue-copy"><small>${state.lastLesson ? "CONTINUE LEARNING · 继续上次" : "A FRESH START · 今日从这里开始"}</small><h2>${esc(next.title)}</h2><p>${labelSession(next.session)} · ${next.sentences.length} 个完整句子 · ${wordCount(next)} 词</p></div><a class="primary" href="#lesson/${next.id}">${state.lastLesson ? "继续学习" : "开始精读"} ${icon("arrow")}</a></section>
  <section aria-labelledby="library-title"><div class="section-header"><h2 id="library-title">真题书架</h2><small>6 次考试 · 每次 3 篇</small></div><div class="filters"><div class="filter-tabs" role="group" aria-label="年份筛选">${["all", "2026", "2025", "2024", "2023"].map((y) => `<button class="filter-tab ${year === y ? "active" : ""}" data-year="${y}" aria-pressed="${year === y}">${y === "all" ? "全部" : y}</button>`).join("")}</div><label class="search">${icon("search")}<input id="search" type="search" placeholder="搜索主题或英文单词" aria-label="搜索主题或英文单词" value="${esc(search)}" autocomplete="off"></label></div><div id="lesson-results"></div></section>
  <div class="source-note">英文为独立编写的完整学习参考译文，中文为配套学习释义。每篇附真题原文来源；不同资料的套号可能不同，以考试时间和主题识别。<a href="#settings">查看收录说明 ↗</a></div>`;
  renderResults();
  document.querySelector("#search").addEventListener("input", (event) => {
    search = event.target.value;
    renderResults();
  });
}
function renderResults() {
  const results = lessons.filter(
    (l) =>
      (year === "all" || l.session.startsWith(year)) &&
      normalize(
        `${l.title} ${l.category} ${l.sentences.map((s) => s.en + " " + s.zh).join(" ")}`,
      ).includes(normalize(search)),
  );
  const groups = [...new Set(results.map((l) => l.session))];
  document.querySelector("#lesson-results").innerHTML = results.length
    ? groups
        .map(
          (session) =>
            `<div class="session-heading"><h3>${labelSession(session)}</h3><span>${session.endsWith("06") ? "JUNE" : "DECEMBER"} / ${session.slice(0, 4)}</span></div><div class="lesson-grid">${results
              .filter((l) => l.session === session)
              .map(
                (l) =>
                  `<a class="lesson-card" href="#lesson/${l.id}"><div class="card-top"><span class="topic-icon">${icon(topicIcon(l))}</span><span class="category">${esc(l.category)}</span></div><h3>${esc(l.title)}</h3><p class="preview" lang="en">${esc(l.sentences[0].en)}</p><div class="card-foot"><span class="${state.completed.includes(l.id) ? "done" : ""}">${state.completed.includes(l.id) ? "✓ 已精读" : `${l.sentences.length} 句 · ${wordCount(l)} 词`}</span>${icon("arrow")}</div></a>`,
              )
              .join("")}</div>`,
        )
        .join("")
    : `<div class="empty"><span class="empty-symbol">⌕</span><h2>没有找到这个主题</h2><p>试试年份、中文主题或英文单词。</p><button class="secondary" data-action="clear-search">显示全部真题</button></div>`;
}
const switchControl = (key, label) =>
  `<label class="switch"><input type="checkbox" data-setting="${key}" ${state.settings[key] ? "checked" : ""} role="switch"><span>${label}</span></label>`;
function wordMarkup(sentence, si) {
  let position = 0;
  return sentence.tokens
    .map(([word, zh], ti) => {
      const start = sentence.en.indexOf(word, position);
      const end = start + word.length;
      const next =
        ti + 1 < sentence.tokens.length
          ? sentence.en.indexOf(sentence.tokens[ti + 1][0], end)
          : sentence.en.length;
      const punctuation = sentence.en.slice(end, next).trim();
      const prefix = ti === 0 ? sentence.en.slice(0, start) : "";
      position = end;
      const saved = Boolean(
        state.mistakes[normalize(word)] &&
          !state.mistakes[normalize(word)].mastered,
      );
      return `<button class="word ${saved ? "saved" : ""}" data-word="${si}:${ti}" aria-label="查看 ${esc(word)} 的释义与练习"><span class="en" lang="en">${esc(prefix + word + punctuation)}</span><span class="zh">${esc(zh)}</span></button>`;
    })
    .join(" ");
}
function reader(id) {
  const l = lessonMap.get(id);
  if (!l) {
    navigate("#library");
    return;
  }
  currentLesson = l;
  state.lastLesson = id;
  persist();
  const index = lessons.findIndex((item) => item.id === id),
    next = lessons[(index + 1) % lessons.length];
  main.innerHTML = `<a class="back-link" href="#library">${icon("back")} 返回真题书架</a><div class="reader-heading"><div class="page-heading"><div class="eyebrow">${l.session.replace("-", " · ")} / ${esc(l.category)}</div><h1>${esc(l.title)}</h1><p>${l.sentences.length} 个完整句子 · ${wordCount(l)} 个词 · 学习参考译文</p></div><button class="primary" data-action="quiz-lesson">${icon("spark")} 拼写练习</button></div>
  <div class="reader-toolbar"><div class="toggle-group">${switchControl("showWords", "逐词中文")}${switchControl("showSentence", "整句中文")}</div><span class="toolbar-hint">轻点英文词 → 查看释义 / 加入错词本</span></div>
  <div id="sentences" class="${state.settings.showWords ? "" : "hide-words"} ${state.settings.showSentence ? "" : "hide-sentence"}">${l.sentences.map((s, i) => `<article class="sentence-card"><div class="sentence-head"><span class="sentence-num">SENTENCE ${String(i + 1).padStart(2, "0")} <span aria-hidden="true">/ ${String(l.sentences.length).padStart(2, "0")}</span></span><div class="sentence-actions"><button data-speak="${i}" aria-label="朗读第 ${i + 1} 句">${icon("audio")} 朗读</button></div></div><div class="words" aria-label="第 ${i + 1} 句英文及逐词释义">${wordMarkup(s, i)}</div><p class="sentence-zh">${esc(s.zh)}</p></article>`).join("")}</div>
  <details class="passage-full"><summary>完整英文 · 连起来读一遍</summary><p lang="en">${l.sentences.map((s) => esc(s.en)).join(" ")}</p></details>
  <div class="reader-bottom"><button class="${state.completed.includes(id) ? "secondary" : "primary"}" data-action="complete">${icon("check")} ${state.completed.includes(id) ? "已完成精读" : "标记已精读"}</button><a class="secondary" href="#lesson/${next.id}">下一篇 ${icon("arrow")}</a></div>
  <div class="source-box"><strong>真题来源与译文说明</strong><p>依据真题信息独立编写英文参考译文；逐句中文为对应学习释义，逐词中文解释该词在句中的含义或语法作用，并非每个词都能一对一替换为汉字。</p><p>${esc(l.coverageNote)}</p>${l.verifiedSources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`).join("")}</div>`;
}
function openWord(si, ti) {
  const sentence = currentLesson.sentences[si],
    [word, meaning] = sentence.tokens[ti];
  selectedWord = {
    word,
    meaning,
    lessonId: currentLesson.id,
    sentenceIndex: si,
    tokenIndex: ti,
  };
  const saved =
    state.mistakes[normalize(word)] &&
    !state.mistakes[normalize(word)].mastered;
  dialog.innerHTML = `<div class="dialog-top"><h2 id="word-title" lang="en">${esc(word)}</h2><button class="icon-button" data-action="close-dialog" aria-label="关闭">${icon("close")}</button></div><p class="dialog-meaning">${esc(meaning)}</p><p class="dialog-context" lang="en">${esc(sentence.en)}</p><div class="dialog-buttons"><button class="primary" data-action="save-word">${icon("notebook")} ${saved ? "已在错词本 · 再次巩固" : "这个词不会 · 加入错词本"}</button><button class="secondary" data-action="quiz-word">练习这个词的拼写 ${icon("arrow")}</button><button class="link-button" data-action="speak-word">听单词发音</button></div><p class="dialog-hint">词义按当前句子解释；同一个词在不同句子里可能有不同含义。错词本按单词合并，保留最近收录的语境。</p>`;
  dialog.showModal();
}
function mistakes() {
  const values = Object.values(state.mistakes)
    .filter(
      (m) =>
        mistakeFilter === "all" ||
        (mistakeFilter === "mastered" ? m.mastered : !m.mastered),
    )
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  main.innerHTML = `<div class="page-heading"><div class="eyebrow">WORDS TO REMEMBER</div><h1>把不熟的词，留在这里。</h1><p>手动收藏与拼写错词会自动合并，随时回来巩固。</p></div><div class="review-header"><div class="filter-tabs" role="group" aria-label="错词筛选">${[
    ["active", "待复习"],
    ["mastered", "已掌握"],
    ["all", "全部"],
  ]
    .map(
      ([v, t]) =>
        `<button class="filter-tab ${mistakeFilter === v ? "active" : ""}" data-mistake-filter="${v}" aria-pressed="${mistakeFilter === v}">${t} ${v === "active" ? activeMistakes().length : v === "all" ? Object.keys(state.mistakes).length : Object.values(state.mistakes).filter((m) => m.mastered).length}</button>`,
    )
    .join(
      "",
    )}</div><button class="primary" data-action="quiz-mistakes" ${activeMistakes().length ? "" : "disabled"}>${icon("spark")} 开始复习</button></div>
  ${values.length ? `<div class="word-list">${values.map((m) => `<article class="mistake-row"><div class="mistake-copy"><strong lang="en">${esc(m.word)}</strong><span>${esc(m.meaning)}</span></div><div class="mistake-meta"><span>${m.wrongCount ? `拼错 ${m.wrongCount} 次` : "手动收藏"}</span>${m.mastered ? "<span>✓ 已掌握</span>" : ""}</div><div class="mistake-controls"><button data-context="${esc(normalize(m.word))}">原句</button><button data-master="${esc(normalize(m.word))}">${m.mastered ? "重新复习" : "标记掌握"}</button><button data-remove="${esc(normalize(m.word))}" aria-label="移除 ${esc(m.word)}">移除</button></div></article>`).join("")}</div>` : `<div class="empty"><span class="empty-symbol">${icon("leaf")}</span><h2>${mistakeFilter === "mastered" ? "熟悉的词，慢慢多起来" : "这里还没有单词"}</h2><p>${mistakeFilter === "mastered" ? "在错词本中把熟悉的单词标记为“已掌握”。" : "精读时点击不会的词，或开始拼写练习。<br>练习中拼错的词会自动来到这里。"}</p><a class="primary" href="#library">去读一篇真题 ${icon("arrow")}</a></div>`}
  <div class="source-note">记录保存在当前浏览器中，清理浏览器数据可能丢失。可以到<a href="#settings">学习设置</a>导出备份，在另一台设备上导入。</div>`;
}
function startQuiz(items, title, returnHash) {
  const valid = items.filter((item) =>
    lessonMap
      .get(item.lessonId)
      ?.sentences[
        item.sentenceIndex
      ]?.tokens.some(([word]) => normalize(word) === normalize(item.word)),
  );
  if (!valid.length) {
    toast("暂时没有可练习的词。");
    return;
  }
  quiz = {
    items: valid,
    index: 0,
    correct: 0,
    answered: false,
    title,
    returnHash,
    wrong: [],
  };
  dialog.close();
  navigate("#quiz");
}
function renderQuiz() {
  if (!quiz) {
    navigate("#library");
    return;
  }
  if (quiz.index >= quiz.items.length) {
    main.innerHTML = `<div class="quiz-container"><a class="back-link" href="${quiz.returnHash}">${icon("back")} 返回学习</a><div class="empty"><span class="empty-symbol">✳</span><div class="eyebrow" style="justify-content:center">LITTLE BY LITTLE</div><h1 style="font-size:29px;margin:13px 0">又向前走了一点。</h1><p>本轮练习 ${quiz.items.length} 词 · 一次答对 ${quiz.correct} 词<br>${quiz.wrong.length ? `${quiz.wrong.length} 个错词已加入错词本。` : "本轮全部正确，继续保持。"}</p><div class="settings-buttons" style="justify-content:center">${quiz.wrong.length ? '<button class="primary" data-action="retry-wrong">再练本轮错词</button>' : ""}<a class="secondary" href="#mistakes">查看错词本</a><a class="secondary" href="${quiz.returnHash}">返回学习</a></div></div></div>`;
    return;
  }
  const item = quiz.items[quiz.index],
    sentence = lessonMap.get(item.lessonId).sentences[item.sentenceIndex];
  main.innerHTML = `<div class="quiz-container"><a class="back-link" href="${quiz.returnHash}">${icon("back")} 退出本轮练习</a><div class="quiz-top"><span>${esc(quiz.title)}</span><span>${quiz.index + 1} / ${quiz.items.length}</span></div><div class="progress-track" role="progressbar" aria-label="练习进度" aria-valuenow="${quiz.index}" aria-valuemin="0" aria-valuemax="${quiz.items.length}"><div style="width:${(quiz.index / quiz.items.length) * 100}%"></div></div><div class="quiz-card"><div class="eyebrow">COMPLETE THE SENTENCE</div><p class="quiz-en" lang="en">${esc(maskedSentence(sentence.en, item.word))}</p><p class="quiz-zh">${esc(sentence.zh)}</p><div class="quiz-clue">待填词的意思：<strong>${esc(item.meaning)}</strong></div><form id="quiz-form"><label class="answer-label" for="answer">输入完整英文单词 · ${item.word.length} 个字符（含连字符 / 撇号）</label><input class="answer-input" id="answer" type="text" inputmode="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="在这里拼写…" aria-describedby="quiz-feedback"><div id="quiz-feedback" aria-live="polite"></div><div class="quiz-buttons"><button class="primary" type="submit" id="answer-button">检查答案 ${icon("arrow")}</button><button class="secondary" type="button" data-action="dont-know">还不会</button><button class="secondary" type="button" data-action="hint">提示</button></div></form></div></div>`;
  document.querySelector("#quiz-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (quiz.answered) {
      quiz.index++;
      quiz.answered = false;
      renderQuiz();
    } else checkAnswer();
  });
}
function checkAnswer(dontKnow = false) {
  if (!quiz || quiz.answered) return;
  const item = quiz.items[quiz.index],
    input = document.querySelector("#answer");
  if (!dontKnow && !input.value.trim()) {
    input.focus();
    toast("先输入单词，或选择“还不会”。");
    return;
  }
  const correct = !dontKnow && normalize(input.value) === normalize(item.word);
  quiz.answered = true;
  if (correct) quiz.correct++;
  else {
    recordMistake(state, item, "wrong");
    quiz.wrong.push(item);
    persist();
  }
  const feedback = document.querySelector("#quiz-feedback");
  feedback.className = `feedback ${correct ? "correct" : "wrong"}`;
  feedback.innerHTML = correct
    ? `✓ 拼写正确。${state.mistakes[normalize(item.word)] && !state.mistakes[normalize(item.word)].mastered ? "熟悉后可以在错词本中标记掌握。" : ""}`
    : `已加入错词本 · 正确拼写<br><strong lang="en">${esc(item.word)}</strong> — ${esc(item.meaning)}`;
  input.readOnly = true;
  document.querySelector("#answer-button").innerHTML =
    `${quiz.index + 1 === quiz.items.length ? "查看本轮结果" : "下一个单词"} ${icon("arrow")}`;
  document.querySelector('[data-action="dont-know"]').disabled = true;
  document.querySelector('[data-action="hint"]').disabled = true;
  document.querySelector("#answer-button").focus({ preventScroll: true });
}
function settings() {
  const sessions = [...new Set(lessons.map((l) => l.session))];
  main.innerHTML = `<div class="page-heading"><div class="eyebrow">MAKE IT YOURS</div><h1>按照你的节奏来。</h1><p>调整阅读习惯，也照顾好积累下来的每一个词。</p></div><div class="settings-grid"><section class="settings-card"><h2>阅读偏好</h2><div class="setting-row"><span>显示英文下方的逐词中文</span>${switchControl("showWords", "显示")}</div><div class="setting-row"><span>显示每一句的中文释义</span>${switchControl("showSentence", "显示")}</div><div class="setting-row"><span>更大的阅读字号</span><label class="switch"><input type="checkbox" data-setting="fontSize" ${state.settings.fontSize === "large" ? "checked" : ""} role="switch"><span>大字</span></label></div></section>
  <section class="settings-card"><h2>把学习记录随身带走</h2><p>错词本、精读进度和显示偏好保存在本机浏览器，不会上传到 GitHub。换手机或清理浏览器之前，记得导出 JSON 备份。导入会合并错词和进度，保留当前显示偏好。</p><div class="settings-buttons"><button class="primary" data-action="export">${icon("download")} 导出学习记录</button><label class="secondary import-label">${icon("upload")} 导入备份<input type="file" id="import-file" accept=".json,application/json" class="visually-hidden"></label></div><p style="margin-top:14px">手机浏览器可使用“添加到主屏幕”。首次联网打开后，已缓存的题库可离线学习；朗读是否可用取决于设备语音服务。</p></section>
  <section class="settings-card"><h2>这份题库，收录了什么？</h2><p>范围：2023 年 12 月至 2026 年 6 月，共 6 次考试、18 个翻译主题。2026 年 12 月尚未举行，不包含在内。按主题识别试卷，不使用各机构可能不一致的套号。</p><table class="coverage-table"><thead><tr><th>考试时间</th><th>核实的翻译主题</th></tr></thead><tbody>${sessions
    .map(
      (s) =>
        `<tr><td>${labelSession(s)}</td><td>${lessons
          .filter((l) => l.session === s)
          .map((l) => esc(l.title))
          .join(" / ")}</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table><p style="margin-top:16px">整理核对日期：${esc(catalog.checkedAt)}。共 ${catalog.sentences} 个完整英文句子、${catalog.tokens} 个逐词释义。每篇学习页底部均提供可追溯的真题原文来源链接。</p></section>
  <div class="about-grid"><section class="settings-card"><h2>关于译文和逐词释义</h2><div class="about-note">六级翻译通常允许多种表达。这里的英文是依据真题信息<strong>独立编写的学习参考译文</strong>，并非官方答案；中文是对应的学习释义，真题原文请打开来源查看。<br><br>冠词、助动词和介词会解释语法作用；词组按语境共同理解，不能把中文标签逐字拼起来当作整句翻译。</div></section><section class="settings-card"><h2>你的错词本</h2><div class="about-note">点击英文词，可以手动收录；拼写答错或点击“还不会”会自动收录。相同单词合并计数，保留最近一次收录语境。<br><br>拼写忽略首尾空格与大小写，连字符、内部空格和词形需要正确；答案以当前参考译文为准。掌握状态由你手动决定。</div></section></div><section class="settings-card"><h2>开源与反馈</h2><p>网页源码与题库数据保存在 GitHub。若发现题目归属、词义或译文问题，可以通过仓库反馈。</p><a class="link-button" style="display:inline-flex;align-items:center;margin-top:8px" href="https://github.com/zhfang28-code/cet6-translation" target="_blank" rel="noopener noreferrer">查看 GitHub 仓库 ↗</a></section></div>`;
  document
    .querySelector("#import-file")
    .addEventListener("change", importBackup);
}
function speak(text) {
  if (!("speechSynthesis" in window)) {
    toast("当前浏览器不支持朗读。");
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.82;
  const voice = speechSynthesis.getVoices().find((v) => v.lang === "en-US");
  if (voice) utterance.voice = voice;
  utterance.onerror = (e) => {
    if (!["interrupted", "canceled"].includes(e.error))
      toast("设备朗读服务不可用，请检查语音设置。");
  };
  speechSynthesis.speak(utterance);
}
function exportBackup() {
  const blob = new Blob(
    [
      JSON.stringify(
        { ...state, exportedAt: new Date().toISOString() },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `逐词-学习备份-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast("已导出学习记录。");
}
async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 5_000_000)
      throw new Error("备份文件过大，请选择逐词导出的 JSON 文件");
    const imported = validateState(JSON.parse(await file.text()));
    state = mergeStates(state, imported);
    persist();
    toast("已合并导入错词与学习进度。");
    settings();
  } catch (error) {
    toast(
      error instanceof SyntaxError
        ? "无法读取 JSON，请选择有效备份文件。"
        : error.message,
    );
  }
}
document.addEventListener("click", (event) => {
  const target = event.target.closest("button,[data-action]");
  if (!target) return;
  if (target.dataset.year) {
    year = target.dataset.year;
    library();
    return;
  }
  if (target.dataset.mistakeFilter) {
    mistakeFilter = target.dataset.mistakeFilter;
    mistakes();
    return;
  }
  if (target.dataset.word) {
    openWord(...target.dataset.word.split(":").map(Number));
    return;
  }
  if (target.dataset.speak !== undefined) {
    speak(currentLesson.sentences[Number(target.dataset.speak)].en);
    return;
  }
  if (target.dataset.master) {
    const m = state.mistakes[target.dataset.master];
    m.mastered = !m.mastered;
    persist();
    mistakes();
    toast(
      m.mastered ? "已标记掌握，仍可在“已掌握”中查看。" : "已放回待复习列表。",
    );
    return;
  }
  if (target.dataset.remove) {
    delete state.mistakes[target.dataset.remove];
    persist();
    mistakes();
    toast("已从错词本移除。");
    return;
  }
  if (target.dataset.context) {
    const m = state.mistakes[target.dataset.context];
    navigate(`#lesson/${m.lessonId}`);
    return;
  }
  switch (target.dataset.action) {
    case "clear-search":
      search = "";
      year = "all";
      library();
      break;
    case "close-dialog":
      dialog.close();
      break;
    case "save-word":
      recordMistake(state, selectedWord);
      persist();
      dialog.close();
      reader(currentLesson.id);
      toast("已加入错词本。");
      break;
    case "speak-word":
      speak(selectedWord.word);
      break;
    case "quiz-word":
      startQuiz([selectedWord], "单词巩固", `#lesson/${currentLesson.id}`);
      break;
    case "quiz-lesson":
      startQuiz(
        quizItems(currentLesson),
        `${currentLesson.title} · 拼写练习`,
        `#lesson/${currentLesson.id}`,
      );
      break;
    case "quiz-mistakes":
      startQuiz(activeMistakes(), "错词本 · 拼写巩固", "#mistakes");
      break;
    case "complete":
      if (!state.completed.includes(currentLesson.id))
        state.completed.push(currentLesson.id);
      persist();
      target.className = "secondary";
      target.innerHTML = `${icon("check")} 已完成精读`;
      toast("已记录精读进度。");
      break;
    case "dont-know":
      checkAnswer(true);
      break;
    case "hint":
      if (quiz && !quiz.answered)
        toast(
          `首字母是 ${quiz.items[quiz.index].word[0]}，共 ${quiz.items[quiz.index].word.length} 个字符。`,
        );
      break;
    case "retry-wrong":
      startQuiz(quiz.wrong, "本轮错词 · 再练一次", quiz.returnHash);
      break;
    case "export":
      exportBackup();
      break;
  }
});
document.addEventListener("change", (event) => {
  const key = event.target.dataset.setting;
  if (!key) return;
  state.settings[key] =
    key === "fontSize"
      ? event.target.checked
        ? "large"
        : "normal"
      : event.target.checked;
  persist();
  document
    .querySelector("#sentences")
    ?.classList.toggle("hide-words", !state.settings.showWords);
  document
    .querySelector("#sentences")
    ?.classList.toggle("hide-sentence", !state.settings.showSentence);
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  }
});
function render() {
  if (dialog.open) dialog.close();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  const [page, id] = location.hash.slice(1).split("/");
  if (page === "lesson") reader(id);
  else if (page === "mistakes") mistakes();
  else if (page === "quiz") renderQuiz();
  else if (page === "settings") settings();
  else library();
  updateNav();
  window.scrollTo({ top: 0, behavior: "instant" });
}
window.addEventListener("hashchange", render);
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    state = readState(storage);
    render();
  }
});
render();
if ("serviceWorker" in navigator && location.protocol !== "file:")
  navigator.serviceWorker.register("./sw.js").catch(() => {});
