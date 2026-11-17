"use strict";

const STORAGE_KEY = "cfop-trainer-web-v1";
const PHASES = ["Cross", "F2L", "OLL", "PLL"];
const FACE_MOVES = ["U", "D", "R", "L", "F", "B"];
const SUFFIXES = ["", "'", "2"];
const GROUPS = ["F2L", "OLL", "PLL"];

const elements = Object.fromEntries(
  [
    "device-mode", "train-group", "train-progress", "train-group-tag",
    "train-case", "train-state", "train-answer", "reveal-button",
    "next-button", "learned-actions", "learned-button", "again-button",
    "library-count", "case-search", "library-group", "case-list",
    "detail-group", "detail-case", "detail-algorithm", "detail-learned",
    "solve-count", "scramble", "new-scramble", "best-time", "ao5-time",
    "ao12-time", "timer-display", "timer-hint", "timer-button",
    "split-controls", "split-status", "split-button", "recent-solves",
  ].map((id) => [id, document.getElementById(id)]),
);

let algorithms = {};
let saved = loadSaved();
let activeView = "train";
let currentCase = "";
let selectedCase = "";
let revealed = false;
let currentScramble = "";
let timerStartedAt = 0;
let timerInterval = null;
let splitDurations = [];
let timerMode = "idle";

function loadSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      learned: data.learned && typeof data.learned === "object" ? data.learned : {},
      solves: Array.isArray(data.solves) ? data.solves : [],
    };
  } catch (error) {
    console.warn("Could not read saved browser progress.", error);
    return { learned: {}, solves: [] };
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch (error) {
    elements.timerHint.textContent = "Could not save browser data. Check available storage.";
    console.error("Could not save CFOP Cubers browser data.", error);
  }
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;
}

function updateDeviceMode() {
  const mobile = isMobileLayout();
  document.body.dataset.device = mobile ? "mobile" : "desktop";
  elements["device-mode"].textContent = mobile ? "Mobile controls" : "PC controls";
}

function switchView(view) {
  activeView = view;
  document.querySelectorAll(".tab").forEach((tab) => {
    const selected = tab.dataset.view === view;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-current", selected ? "page" : "false");
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("hidden", section.id !== `${view}-view`);
  });
}

function caseNames(group) {
  return Object.keys(algorithms[group] || {});
}

function pickNextCase(group) {
  const allCases = caseNames(group);
  const dueCases = allCases.filter((name) => !saved.learned[name]);
  const candidates = dueCases.length ? dueCases : allCases;
  const alternatives = candidates.filter((name) => name !== currentCase);
  const pool = alternatives.length ? alternatives : candidates;
  currentCase = pool[Math.floor(Math.random() * pool.length)] || "";
  revealed = false;
  renderTrainer();
}

function renderTrainer() {
  const group = elements["train-group"].value;
  const total = caseNames(group).length;
  const learned = caseNames(group).filter((name) => saved.learned[name]).length;
  elements["train-group-tag"].textContent = group;
  elements["train-progress"].textContent = `${learned} / ${total} learned`;
  elements["train-case"].textContent = currentCase || "Loading cases…";
  elements["train-state"].textContent = currentCase
    ? saved.learned[currentCase] ? "Marked learned" : "Still practicing"
    : "";
  elements["train-answer"].textContent = revealed
    ? algorithms[group]?.[currentCase] || ""
    : "";
  elements["train-answer"].classList.toggle("hidden", !revealed);
  elements["reveal-button"].classList.toggle("hidden", revealed);
  elements["learned-actions"].classList.toggle("hidden", !revealed);
  elements["learned-button"].textContent = saved.learned[currentCase]
    ? "Already learned" : "Got it";
  elements["learned-button"].disabled = Boolean(saved.learned[currentCase]);
  elements["again-button"].textContent = "Practice again";
}

function setLearned(caseName, learned) {
  saved.learned[caseName] = learned;
  save();
  renderTrainer();
  renderLibrary();
}

function renderLibrary() {
  const query = elements["case-search"].value.trim().toLowerCase();
  const groupFilter = elements["library-group"].value;
  const visible = GROUPS.flatMap((group) => group === groupFilter || groupFilter === "All groups"
    ? caseNames(group)
      .filter((name) => name.toLowerCase().includes(query))
      .map((name) => ({ group, name }))
    : []);
  elements["library-count"].textContent = `${visible.length} shown`;
  elements["case-list"].replaceChildren();
  for (const item of visible) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `case-option${item.name === selectedCase ? " selected" : ""}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(item.name === selectedCase));
    const name = document.createElement("span");
    name.textContent = item.name;
    button.append(name);
    if (saved.learned[item.name]) {
      const learned = document.createElement("span");
      learned.className = "learned-dot";
      learned.textContent = "✓";
      learned.setAttribute("aria-label", "learned");
      button.append(learned);
    }
    button.addEventListener("click", () => selectLibraryCase(item.group, item.name));
    elements["case-list"].append(button);
  }
  if (!visible.some((item) => item.name === selectedCase)) {
    if (visible.length) selectLibraryCase(visible[0].group, visible[0].name, false);
    else showLibraryCase("", "");
  }
}

function selectLibraryCase(group, name, rerender = true) {
  selectedCase = name;
  showLibraryCase(group, name);
  if (rerender) renderLibrary();
}

function showLibraryCase(group, name) {
  elements["detail-group"].textContent = group ? `${group} CASE` : "CASE LIBRARY";
  elements["detail-case"].textContent = name || "No matching cases";
  elements["detail-algorithm"].textContent = name
    ? algorithms[group]?.[name] || "No algorithm available."
    : "Try another search or group filter.";
  elements["detail-learned"].disabled = !name;
  elements["detail-learned"].textContent = saved.learned[name] ? "Mark practicing" : "Mark learned";
}

function formatTime(milliseconds) {
  if (!Number.isFinite(milliseconds)) return "—";
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function averageLast(count) {
  const records = saved.solves.slice(-count);
  if (records.length !== count) return null;
  const values = records.map((record) => record.penalty === "DNF"
    ? Infinity : record.time_ms + (record.penalty === "+2" ? 2000 : 0));
  values.sort((first, second) => first - second);
  const trim = count === 12 ? 1 : 1;
  if (values.filter((value) => !Number.isFinite(value)).length > trim) return Infinity;
  const trimmed = values.slice(trim, values.length - trim);
  if (trimmed.some((value) => !Number.isFinite(value))) return Infinity;
  return trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
}

function generateScramble(length = 25) {
  const moves = [];
  let previousFace = "";
  let previousAxis = -1;
  const axis = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
  while (moves.length < length) {
    const face = FACE_MOVES[Math.floor(Math.random() * FACE_MOVES.length)];
    if (face === previousFace || axis[face] === previousAxis) continue;
    moves.push(face + SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]);
    previousFace = face;
    previousAxis = axis[face];
  }
  return moves.join(" ");
}

function updateTimerDisplay() {
  const elapsed = performance.now() - timerStartedAt;
  elements["timer-display"].textContent = formatTime(elapsed);
}

function startTimer() {
  if (timerMode === "running") return;
  timerStartedAt = performance.now();
  splitDurations = [];
  timerMode = "running";
  elements["timer-button"].textContent = "Stop and save";
  elements["timer-hint"].textContent = "Press Space or tap to stop. Optional splits are available below.";
  elements["split-controls"].classList.remove("hidden");
  elements["split-button"].disabled = false;
  elements["split-button"].textContent = `Mark ${PHASES[0]}`;
  elements["split-status"].textContent = "Optional: Cross → F2L → OLL → PLL";
  timerInterval = window.setInterval(updateTimerDisplay, 20);
}

function stopTimer() {
  if (timerMode !== "running") return;
  const elapsed = Math.max(0, Math.round(performance.now() - timerStartedAt));
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerMode = "idle";
  saved.solves.push({
    time_ms: elapsed,
    scramble: currentScramble,
    timestamp: new Date().toISOString(),
    cfop_splits_ms: [...splitDurations],
    penalty: "",
  });
  save();
  renderTimer();
  elements["timer-display"].textContent = formatTime(elapsed);
  elements["timer-button"].textContent = "Start solve";
  elements["timer-hint"].textContent = splitDurations.length
    ? `Saved with ${splitDurations.length} CFOP split(s).`
    : "Solve saved on this device. Ready for the next one.";
  elements["split-controls"].classList.add("hidden");
  splitDurations = [];
  currentScramble = generateScramble();
  elements.scramble.textContent = currentScramble;
}

function toggleTimer() {
  if (timerMode === "running") stopTimer();
  else startTimer();
}

function markSplit() {
  if (timerMode !== "running" || splitDurations.length >= PHASES.length) return;
  const elapsed = Math.max(0, Math.round(performance.now() - timerStartedAt));
  const completeSoFar = splitDurations.reduce((sum, split) => sum + split, 0);
  splitDurations.push(Math.max(0, elapsed - completeSoFar));
  if (splitDurations.length === PHASES.length) {
    stopTimer();
    return;
  }
  elements["split-button"].textContent = `Mark ${PHASES[splitDurations.length]}`;
  elements["split-status"].textContent = `${PHASES[splitDurations.length - 1]} ${formatTime(splitDurations.at(-1))} · Next: ${PHASES[splitDurations.length]}`;
}

function renderTimer() {
  const valid = saved.solves.filter((record) => record.penalty !== "DNF");
  const best = valid.reduce((result, record) => Math.min(result, record.time_ms + (record.penalty === "+2" ? 2000 : 0)), Infinity);
  elements["best-time"].textContent = formatTime(best);
  elements["ao5-time"].textContent = formatTime(averageLast(5));
  elements["ao12-time"].textContent = formatTime(averageLast(12));
  elements["solve-count"].textContent = `${saved.solves.length} solve${saved.solves.length === 1 ? "" : "s"}`;
  elements["recent-solves"].replaceChildren();
  for (const record of saved.solves.slice(-8).reverse()) {
    const item = document.createElement("li");
    const solve = document.createElement("strong");
    solve.textContent = record.penalty === "DNF" ? "DNF" : formatTime(record.time_ms + (record.penalty === "+2" ? 2000 : 0));
    item.append(solve, document.createTextNode(` · ${record.scramble}`));
    if (record.cfop_splits_ms?.length) {
      const splits = document.createElement("small");
      splits.className = "recent-splits";
      splits.textContent = `  ${record.cfop_splits_ms.map((value, index) => `${PHASES[index]} ${formatTime(value)}`).join(" / ")}`;
      item.append(splits);
    }
    elements["recent-solves"].append(item);
  }
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });
  elements["train-group"].addEventListener("change", () => pickNextCase(elements["train-group"].value));
  elements["reveal-button"].addEventListener("click", () => {
    revealed = true;
    renderTrainer();
  });
  elements["next-button"].addEventListener("click", () => pickNextCase(elements["train-group"].value));
  elements["learned-button"].addEventListener("click", () => currentCase && setLearned(currentCase, true));
  elements["again-button"].addEventListener("click", () => currentCase && setLearned(currentCase, false));
  elements["case-search"].addEventListener("input", renderLibrary);
  elements["library-group"].addEventListener("change", renderLibrary);
  elements["detail-learned"].addEventListener("click", () => {
    if (selectedCase) setLearned(selectedCase, !saved.learned[selectedCase]);
    showLibraryCase(elements["detail-group"].textContent.split(" ")[0], selectedCase);
  });
  elements["new-scramble"].addEventListener("click", () => {
    if (timerMode !== "running") {
      currentScramble = generateScramble();
      elements.scramble.textContent = currentScramble;
    }
  });
  elements["timer-button"].addEventListener("click", toggleTimer);
  elements["split-button"].addEventListener("click", markSplit);
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || activeView !== "timer" || event.repeat) return;
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
    event.preventDefault();
    if (event.target instanceof HTMLButtonElement && event.target.id === "split-button") {
      markSplit();
    } else {
      toggleTimer();
    }
  });
  window.addEventListener("resize", updateDeviceMode);
}

async function initialize() {
  updateDeviceMode();
  bindEvents();
  try {
    const response = await fetch("../algorithms.json");
    if (!response.ok) throw new Error(`Could not load cases (${response.status}).`);
    algorithms = await response.json();
  } catch (error) {
    elements["train-case"].textContent = "Could not load cases";
    elements["train-state"].textContent = "Run a local web server from the app folder or host the project online.";
    elements["library-count"].textContent = error.message;
    console.error("Could not load the CFOP case library.", error);
    return;
  }
  currentScramble = generateScramble();
  elements.scramble.textContent = currentScramble;
  pickNextCase(elements["train-group"].value);
  renderLibrary();
  renderTimer();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Offline caching is unavailable.", error);
    });
  }
}

initialize();
