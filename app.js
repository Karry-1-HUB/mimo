"use strict";

const STORAGE_KEY = "cet6-mobile-sprint-v1";
const EXAM_DATE = "2026-12-12";
const defaults = { version: 1, settings: { theme: "sky", budget: 45 }, days: {}, revisions: [], hesitations: [], papers: [], mocks: [] };

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return structuredClone(defaults);
    return { ...structuredClone(defaults), ...saved, settings: { ...defaults.settings, ...(saved.settings || {}) }, days: saved.days || {}, revisions: saved.revisions || [], hesitations: saved.hesitations || [], papers: saved.papers || [], mocks: saved.mocks || [] };
  } catch { return structuredClone(defaults); }
}

let state = loadState();
const today = localDate();
let toastTimer;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function save(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
  if (message) showToast(message);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2100);
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function daysLeft() {
  return Math.max(0, Math.ceil((new Date(`${EXAM_DATE}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000));
}

function stageText(days) {
  if (days > 42) return "基础重建期 · 恢复精听流程和独立输出";
  if (days > 21) return "强化提分期 · 围绕模考短板集中训练";
  if (days > 7) return "套题整合期 · 严格计时并修正考试节奏";
  return "考前稳态期 · 减量复盘，保持手感";
}

const priorities = ["讲话/讲座精听", "仔细阅读定位", "写作翻译重写"];
function taskPlan(budget) {
  const day = new Date().getDay();
  const plans = {
    0: [["严格计时完成一套真题", 125], ["录入分项成绩", 10], ["复盘高权重错题", 15]],
    1: [["词汇主动回忆", 10], [priorities[0], 20], ["仔细阅读：写定位依据", 15]],
    2: [["词汇主动回忆", 10], ["精听：盲听→听写→跟读", 25], ["写作主体段", 15]],
    3: [["词汇主动回忆", 10], [priorities[1], 20], ["翻译拆句与重写", 15]],
    4: [["讲话/讲座精听", 25], ["仔细阅读：解释干扰项", 15], ["复听昨日材料", 10]],
    5: [["本周薄弱项限时训练", 25], ["写作或翻译完整输出", 20], ["整理本周错题", 10]],
    6: [["本周第一弱项强化", 40], ["写作+翻译完整输出", 30], ["错题二次作答", 20]],
  };
  let remaining = budget;
  return (plans[day] || plans[1]).flatMap(([label, minutes], index) => {
    if (remaining < 3) return [];
    const actual = Math.min(minutes, remaining); remaining -= actual;
    return [{ id: `${today}-${index}-${label}`, label, minutes: actual, done: false }];
  });
}

function ensureToday() {
  if (!state.days[today]) state.days[today] = { budget: state.settings.budget, note: "", tasks: taskPlan(state.settings.budget), updatedAt: new Date().toISOString() };
}

function renderTasks() {
  ensureToday();
  const day = state.days[today];
  $("#budgetSelect").value = String(day.budget);
  $("#dailyNote").value = day.note || "";
  $("#taskList").innerHTML = day.tasks.map(task => `<label class="task ${task.done ? "done" : ""}"><input type="checkbox" data-task="${escapeHtml(task.id)}" ${task.done ? "checked" : ""}><span><strong>${escapeHtml(task.label)}</strong><small>${task.minutes} 分钟</small></span><b>${task.done ? "✓" : `${task.minutes}m`}</b></label>`).join("");
  const completion = day.tasks.length ? Math.round(day.tasks.filter(task => task.done).length / day.tasks.length * 100) : 0;
  $("#taskProgress").style.width = `${completion}%`;
  $$('[data-task]').forEach(box => box.addEventListener("change", () => { const task = day.tasks.find(item => item.id === box.dataset.task); if (task) task.done = box.checked; day.updatedAt = new Date().toISOString(); save(); }));
}

function renderRecords() {
  const empty = '<p class="subtle">还没有记录。</p>';
  $("#revisionList").innerHTML = state.revisions.slice(0, 10).map(item => `<article class="record"><header><span>${escapeHtml(item.kind)}</span><small>${escapeHtml(item.date)} · ${Number(item.minutes) || 0} 分钟</small></header><strong>${escapeHtml(item.prompt)}</strong>${item.errors ? `<p>反复问题：${escapeHtml(item.errors)}</p>` : ""}</article>`).join("") || empty;
  $("#hesitationList").innerHTML = state.hesitations.slice(0, 10).map(item => `<article class="record"><header><span>${escapeHtml(item.trap)}</span><small>${escapeHtml(item.date)}</small></header><strong>${escapeHtml(item.source)}</strong><p>${escapeHtml(item.evidence)}</p></article>`).join("") || empty;
  $("#paperList").innerHTML = state.papers.map(item => `<article class="record"><header><span>${escapeHtml(item.status)}</span><small>${escapeHtml(item.date || "尚未排期")}</small></header><strong>${escapeHtml(item.label)}</strong>${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}</article>`).join("") || empty;
  $("#mockList").innerHTML = state.mocks.slice(0, 6).map(item => `<article class="record"><header><span>${item.total} 分</span><small>${escapeHtml(item.date)}</small></header><strong>${escapeHtml(item.label)}</strong><p>听力 ${item.listening} · 阅读 ${item.reading} · 写译 ${item.writing}</p></article>`).join("") || empty;
}

function weekStartIso() {
  const date = new Date(`${today}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return localDate(date);
}

function renderReport() {
  const start = weekStartIso();
  const logs = Object.entries(state.days).filter(([date]) => date >= start && date <= today).map(([, value]) => value);
  const minutes = logs.reduce((sum, log) => sum + (log.tasks || []).filter(task => task.done).reduce((acc, task) => acc + Number(task.minutes || 0), 0), 0);
  const completed = logs.reduce((sum, log) => sum + (log.tasks || []).filter(task => task.done).length, 0);
  const latest = state.mocks[0]?.total || 470;
  const pending = state.hesitations.length + state.revisions.filter(item => !item.revised).length + state.papers.filter(item => item.status !== "已复盘").length;
  $("#weekMinutes").textContent = minutes;
  $("#latestScore").textContent = latest;
  $("#pendingCount").textContent = pending;
  $("#reportStats").innerHTML = [["本周投入", `${minutes} 分钟`], ["完成任务", `${completed} 项`], ["最近估分", `${latest} 分`], ["距目标", `${Math.max(0, 560 - latest)} 分`]].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  const actions = [minutes < 200 ? "下周先保证 5 个工作日各完成 40 分钟" : "保持当前总时长，不额外加量", state.hesitations.length ? "阅读先写定位证据，再决定两个纠结选项" : "开始记录阅读纠结选项与最终证据", state.revisions.length ? "从最近一次写译记录中挑一篇脱稿重写" : "完成第一篇限时写作并保存修改对照"];
  $("#reportActions").innerHTML = actions.map((action, index) => `<div class="action"><b>0${index + 1}</b><span>${escapeHtml(action)}</span></div>`).join("");
  $("#storageStatus").textContent = `当前共有 ${state.revisions.length + state.hesitations.length + state.papers.length + state.mocks.length} 条训练记录。`;
}

function renderAll() {
  const days = daysLeft();
  $("#daysLeft").textContent = days;
  $("#stageText").textContent = stageText(days);
  renderTasks(); renderRecords(); renderReport();
}

function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }

$$('.bottom-nav button').forEach(button => button.addEventListener("click", () => {
  $$('.bottom-nav button').forEach(item => item.classList.toggle("active", item === button));
  $$('.view').forEach(view => view.classList.toggle("active", view.id === button.dataset.view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}));

$("#themeSelect").value = state.settings.theme;
document.documentElement.dataset.theme = state.settings.theme;
$("#themeSelect").addEventListener("change", event => { state.settings.theme = event.target.value; document.documentElement.dataset.theme = event.target.value; document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(); save("主题已切换"); });

$("#budgetSelect").addEventListener("change", event => { const budget = Number(event.target.value); state.settings.budget = budget; state.days[today] = { budget, note: state.days[today]?.note || "", tasks: taskPlan(budget), updatedAt: new Date().toISOString() }; save("今日计划已重排"); });
$("#rescueBtn").addEventListener("click", () => { state.days[today] = { budget: 20, note: state.days[today]?.note || "", updatedAt: new Date().toISOString(), tasks: [["高频词主动回忆",5],["第一弱项最小训练",8],["一道错题重新定位",4],["写下明天第一步",3]].map(([label,minutes],index)=>({ id:`rescue-${today}-${index}`, label, minutes, done:false })) }; save("已切换为 20 分钟急救计划"); });
$("#saveTodayBtn").addEventListener("click", () => { ensureToday(); state.days[today].note = $("#dailyNote").value; state.days[today].updatedAt = new Date().toISOString(); save("今日进度已保存在手机"); });

let audioUrl = "";
const audio = $("#audioPlayer");
$("#audioFile").addEventListener("change", event => { const file = event.target.files?.[0]; if (!file) return; if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = URL.createObjectURL(file); audio.src = audioUrl; showToast("音频已载入，不会上传"); });
$("#audioRate").addEventListener("change", event => { audio.playbackRate = Number(event.target.value); });
$("#setA").addEventListener("click", () => { $("#loopStart").value = audio.currentTime.toFixed(1); });
$("#setB").addEventListener("click", () => { $("#loopEnd").value = audio.currentTime.toFixed(1); });
audio.addEventListener("timeupdate", () => { if ($("#loopToggle").checked && audio.currentTime >= Number($("#loopEnd").value) && Number($("#loopEnd").value) > Number($("#loopStart").value)) { audio.currentTime = Number($("#loopStart").value); audio.play().catch(()=>{}); } });
$("#toggleTranscript").addEventListener("click", () => { const field = $("#transcript"); field.classList.toggle("masked"); $("#toggleTranscript").textContent = field.classList.contains("masked") ? "显示原文" : "隐藏原文"; });

$("#revisionForm").elements.date.value = today;
$("#revisionForm").addEventListener("submit", event => { event.preventDefault(); const item = formObject(event.currentTarget); state.revisions.unshift({ ...item, id: crypto.randomUUID(), savedAt: new Date().toISOString() }); event.currentTarget.reset(); event.currentTarget.elements.date.value = today; event.currentTarget.elements.minutes.value = 30; save("写译修改对照已保存"); });
$("#hesitationForm").addEventListener("submit", event => { event.preventDefault(); const item = formObject(event.currentTarget); state.hesitations.unshift({ ...item, date: today, id: crypto.randomUUID(), savedAt: new Date().toISOString() }); event.currentTarget.reset(); save("阅读判断证据已保存"); });
$("#paperForm").addEventListener("submit", event => { event.preventDefault(); const item = formObject(event.currentTarget); const existing = state.papers.findIndex(paper => paper.label === item.label); const value = { ...item, id: existing >= 0 ? state.papers[existing].id : crypto.randomUUID(), savedAt: new Date().toISOString() }; if (existing >= 0) state.papers[existing] = value; else state.papers.unshift(value); event.currentTarget.reset(); save("真题库存已更新"); });
$("#mockForm").addEventListener("submit", event => { event.preventDefault(); const item = formObject(event.currentTarget); const listening = Number(item.listening)||0, reading = Number(item.reading)||0, writing = Number(item.writing)||0; state.mocks.unshift({ ...item, listening, reading, writing, total: listening + reading + writing, date: today, id: crypto.randomUUID() }); event.currentTarget.reset(); save("模考成绩已保存"); });

$("#exportBtn").addEventListener("click", () => { download(`cet6-backup-${today}.json`, JSON.stringify(state, null, 2), "application/json"); showToast("备份文件已导出"); });
$("#importFile").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || typeof parsed !== "object" || !parsed.days) throw new Error();
      state = { ...structuredClone(defaults), ...parsed };
      document.documentElement.dataset.theme = state.settings.theme;
      $("#themeSelect").value = state.settings.theme;
      document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      save("备份已导入");
    } catch {
      showToast("备份文件无法识别");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
});

function icsEscape(value) { return String(value).replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;"); }
function compact(iso, time) { return `${iso.replace(/-/g,"")}T${time.replace(":","")}00`; }
function addIcsEvent(lines, iso, start, end, title, description, alarm, index) { lines.push("BEGIN:VEVENT",`UID:cet6-${iso}-${index}@mobile-mirror`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/, "Z")}`,`DTSTART;TZID=Asia/Shanghai:${compact(iso,start)}`,`DTEND;TZID=Asia/Shanghai:${compact(iso,end)}`,`SUMMARY:${icsEscape(title)}`,`DESCRIPTION:${icsEscape(description)}`,"BEGIN:VALARM","ACTION:DISPLAY",`TRIGGER:-PT${alarm}M`,`DESCRIPTION:${icsEscape(title)}`,"END:VALARM","END:VEVENT"); }
$("#calendarBtn").addEventListener("click", () => {
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CET6 Mobile Sprint//ZH-CN","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:六级560冲刺提醒","X-WR-TIMEZONE:Asia/Shanghai"];
  const cursor=new Date(`${today}T12:00:00Z`), exam=new Date(`${EXAM_DATE}T12:00:00Z`); let index=0;
  while(cursor<=exam){const iso=cursor.toISOString().slice(0,10),day=cursor.getUTCDay(); if(iso===EXAM_DATE)addIcsEvent(lines,iso,"08:00","08:15","六级考试日","核对准考证、证件、听力设备和考场安排。",60,index++); else if(day>=1&&day<=5){addIcsEvent(lines,iso,"07:20","07:30","六级晨间唤醒｜10分钟","复习错词或跟读一小段。",0,index++);addIcsEvent(lines,iso,"20:40","21:30","六级主训练｜打开今日看板","完成今日任务并打卡。",10,index++);}else if(day===6)addIcsEvent(lines,iso,"09:30","10:40","六级周六强化块","完成本周第一弱项训练。",10,index++);else{addIcsEvent(lines,iso,"09:00","11:10","六级周日严格模考","按考试顺序计时完成一套真题。",20,index++);addIcsEvent(lines,iso,"15:30","16:30","六级周日复盘","录入成绩并复盘高权重错题。",10,index++);}cursor.setUTCDate(cursor.getUTCDate()+1);}
  lines.push("END:VCALENDAR"); download("cet6-sprint-reminders.ics",`${lines.join("\r\n")}\r\n`,"text/calendar;charset=utf-8"); showToast("日历文件已生成");
});

ensureToday(); renderAll();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(()=>{}));

