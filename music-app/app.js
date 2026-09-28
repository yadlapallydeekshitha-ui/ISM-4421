// Music Studio: a one-page front end for the Suno API (https://docs.sunoapi.org).
// Everything runs in the browser: the user's API key is kept in their browser
// and sent straight to api.sunoapi.org.

const API_BASE = "https://api.sunoapi.org";
const MODELS = [
  ["V6", "V6 · best quality"],
  ["V6_MINI", "V6 Mini · fastest"],
  ["V6_WILD", "V6 Wild · most creative"],
  ["V5", "V5 · legacy"],
];
const STYLE_IDEAS = [
  "pop", "hip hop", "r&b", "rock", "indie", "edm", "lo-fi", "jazz", "country",
  "reggaeton", "afrobeats", "latin", "classical", "cinematic", "acoustic", "synthwave",
];
const POLL_MS = 5000;
const MAX_WAIT_MS = 15 * 60 * 1000;
const KEY_STORE = "suno:key";
const LIB_STORE = "suno:library";
const JOB_STORE = "suno:jobs";

const API_ERRORS = {
  400: "Invalid parameters.",
  401: "Your API key was rejected. Check it in 🔑 API key.",
  404: "Invalid request method or path.",
  405: "Rate limit exceeded. Please wait a moment.",
  413: "Prompt, style, or lyrics are too long.",
  429: "Your Suno account is out of credits.",
  430: "Too many requests. Please try again shortly.",
  455: "Suno API is under maintenance. Try again later.",
  500: "Suno API server error. Try again.",
};

const FAILED_STATES = {
  CREATE_TASK_FAILED: "Suno couldn't create the task.",
  GENERATE_AUDIO_FAILED: "Suno couldn't generate the audio.",
  GENERATE_LYRICS_FAILED: "Suno couldn't write the lyrics.",
  CALLBACK_EXCEPTION: "Suno reported a callback error.",
  SENSITIVE_WORD_ERROR: "Your text contains words Suno doesn't allow. Please rephrase.",
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- storage ----------

function store(kind) {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}
function readJSON(key, fallback) {
  try {
    return JSON.parse(store()?.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}

function getKey() {
  try {
    return store()?.getItem(KEY_STORE) || store("session")?.getItem(KEY_STORE) || "";
  } catch {
    return "";
  }
}
function isKeyRemembered() {
  try {
    return Boolean(store()?.getItem(KEY_STORE));
  } catch {
    return false;
  }
}
function setKey(key, remember) {
  try {
    store()?.removeItem(KEY_STORE);
    store("session")?.removeItem(KEY_STORE);
    if (key) (remember ? store() : store("session"))?.setItem(KEY_STORE, key);
  } catch {
    /* ignore */
  }
}

// ---------- API ----------

class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function api(path, { method = "GET", query, body } = {}) {
  const key = getKey();
  if (!key) {
    openKeyDialog();
    throw new ApiError("Add your Suno API key first.", 401);
  }
  const url = new URL(API_BASE + path);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Couldn't reach the Suno API. Check your connection and try again.", 0);
  }
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON */
  }
  // Suno reports errors in the body's `code` field (often with HTTP 200).
  const code = payload?.code ?? res.status;
  if (!res.ok || code !== 200) {
    const msg = payload?.msg && payload.msg !== "success" ? payload.msg : API_ERRORS[code] || `Request failed (${code}).`;
    throw new ApiError(msg, code);
  }
  return payload.data;
}

// Suno requires a callback URL; this app polls instead, so any reachable URL works.
function callBackUrl() {
  return location.protocol === "https:" ? `${location.origin}/` : "https://example.com/suno-callback";
}

// ---------- credits ----------

async function refreshCredits() {
  const el = $("#credits");
  if (!getKey()) {
    el.textContent = "Credits: –";
    return;
  }
  try {
    const credits = await api("/api/v1/generate/credit");
    el.textContent = `Credits: ${typeof credits === "number" ? credits.toLocaleString() : credits}`;
    el.classList.toggle("warn", Number(credits) < 20);
  } catch (err) {
    el.textContent = "Credits: ?";
    el.title = err.message;
  }
}

// ---------- API key dialog ----------

function openKeyDialog(message = "") {
  const dlg = $("#key-dialog");
  $("#key-input").value = getKey();
  $("#key-input").type = "password";
  $("#key-remember").checked = isKeyRemembered() || !getKey();
  $("#key-msg").textContent = message;
  $("#key-msg").className = "small";
  if (!dlg.open) dlg.showModal();
  $("#key-input").focus();
}

function syncKeyUI() {
  const has = Boolean(getKey());
  $("#key-label").textContent = has ? "Key added" : "Add API key";
  $("#key-btn").classList.toggle("warn", !has);
  $("#key-banner").hidden = has;
}

function initKeyDialog() {
  const dlg = $("#key-dialog");
  $("#key-btn").addEventListener("click", () => openKeyDialog());
  $$("[data-open-key]").forEach((b) => b.addEventListener("click", () => openKeyDialog()));
  $("#key-cancel").addEventListener("click", () => dlg.close());
  $("#key-show").addEventListener("click", () => {
    const input = $("#key-input");
    input.type = input.type === "password" ? "text" : "password";
  });
  $("#key-clear").addEventListener("click", () => {
    setKey("");
    $("#key-input").value = "";
    syncKeyUI();
    refreshCredits();
    dlg.close();
  });
  $("#key-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = $("#key-input").value.trim();
    const msg = $("#key-msg");
    if (!key) {
      msg.textContent = "Paste your API key.";
      msg.className = "small error";
      return;
    }
    const previous = getKey();
    const wasRemembered = isKeyRemembered();
    setKey(key, $("#key-remember").checked);
    msg.textContent = "Checking key…";
    msg.className = "small";
    $("#key-save").disabled = true;
    try {
      await api("/api/v1/generate/credit");
      syncKeyUI();
      refreshCredits();
      resumeJobs();
      dlg.close();
    } catch (err) {
      setKey(previous, wasRemembered);
      msg.textContent = err.code === 401 ? "That key was rejected by Suno." : err.message;
      msg.className = "small error";
    } finally {
      $("#key-save").disabled = false;
    }
  });
}

// ---------- form helpers ----------

function initForms() {
  // Tabs
  $$(".tabs [role=tab]").forEach((tab) =>
    tab.addEventListener("click", () => {
      $$(".tabs [role=tab]").forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        $("#" + t.getAttribute("aria-controls")).hidden = !on;
      });
      setStatus("");
    })
  );

  // Model selects
  $$(".model-select").forEach((sel) => {
    for (const [value, label] of MODELS) sel.add(new Option(label, value));
  });

  // Style chips append to the linked input
  $$(".chips").forEach((box) => {
    const input = $("#" + box.dataset.target);
    for (const style of STYLE_IDEAS) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = style;
      b.addEventListener("click", () => {
        const parts = input.value.split(",").map((s) => s.trim()).filter(Boolean);
        if (!parts.includes(style)) parts.push(style);
        input.value = parts.join(", ");
        input.focus();
      });
      box.append(b);
    }
  });

  // Character counters
  $$(".counter").forEach((c) => {
    const field = c.closest("form").elements[c.dataset.for];
    const update = () => (c.textContent = `${field.value.length} / ${c.dataset.max}`);
    field.addEventListener("input", update);
    update();
  });

  // Range outputs
  $$("output[data-for]").forEach((o) => {
    const input = o.closest("form").elements[o.dataset.for];
    const update = () => (o.textContent = input.step === "1" || input.step === "5" ? input.value : Number(input.value).toFixed(2));
    input.addEventListener("input", update);
    update();
  });

  // Instrumental hides lyrics + voice
  const instr = $("#custom-instrumental");
  const syncInstr = () => {
    $("#lyrics-block").hidden = instr.checked;
    $("#vocal-field").hidden = instr.checked;
  };
  instr.addEventListener("change", syncInstr);
  syncInstr();

  $("#set-duration").addEventListener("change", (e) => ($("#duration-field").hidden = !e.target.checked));

  $("#form-simple").addEventListener("submit", onSimpleSubmit);
  $("#form-custom").addEventListener("submit", onCustomSubmit);

  // AI lyrics
  $("#ai-lyrics-btn").addEventListener("click", () => {
    const box = $("#ai-lyrics");
    box.hidden = !box.hidden;
    if (!box.hidden) $("#ai-lyrics-prompt").focus();
  });
  $("#ai-lyrics-go").addEventListener("click", generateLyrics);
  $("#ai-lyrics-prompt").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      generateLyrics();
    }
  });
}

function setStatus(text, isError = false) {
  const el = $("#form-status");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function onSimpleSubmit(e) {
  e.preventDefault();
  const f = e.target.elements;
  const prompt = f.prompt.value.trim();
  const style = f.style.value.trim();
  if (!prompt) return setStatus("Describe the song you want.", true);
  const body = { customMode: false, instrumental: f.instrumental.checked, model: f.model.value, prompt };
  if (style) body.style = style;
  startGeneration(body, e.target, prompt);
}

function onCustomSubmit(e) {
  e.preventDefault();
  const f = e.target.elements;
  const instrumental = f.instrumental.checked;
  const title = f.title.value.trim();
  const style = f.style.value.trim();
  const lyrics = instrumental ? "" : f.lyrics.value.trim();
  const negativeTags = f.negativeTags.value.trim();

  if (!style && !lyrics) return setStatus("Add a style of music (and lyrics, unless it's instrumental).", true);
  if (!instrumental && !lyrics) return setStatus("Add lyrics, use ✍️ Write lyrics with AI, or switch on Instrumental.", true);

  const body = {
    customMode: true,
    instrumental,
    model: f.model.value,
    styleWeight: Number(f.styleWeight.value),
    weirdnessConstraint: Number(f.weirdnessConstraint.value),
    variety: Number(f.variety.value),
  };
  if (title) body.title = title;
  if (style) body.style = style;
  if (lyrics) body.lyrics = lyrics;
  if (negativeTags) body.negativeTags = negativeTags;
  if (!instrumental && f.vocalGender.value) body.vocalGender = f.vocalGender.value;
  if ($("#set-duration").checked && body.model !== "V5") body.duration = Number(f.duration.value);

  startGeneration(body, e.target, title || style);
}

async function startGeneration(body, form, label) {
  const btn = $("button[type=submit]", form);
  btn.disabled = true;
  setStatus("Sending to Suno…");
  try {
    const data = await api("/api/v1/generate", { method: "POST", body: { ...body, callBackUrl: callBackUrl() } });
    const job = { taskId: data.taskId, label: label || "New song", started: Date.now(), params: body };
    const jobs = readJSON(JOB_STORE, []);
    jobs.push(job);
    writeJSON(JOB_STORE, jobs);
    setStatus("Started! Your songs usually take 1–3 minutes.");
    watchJob(job);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

// ---------- jobs / polling ----------

const watching = new Set();

function jobEl(job) {
  let el = $(`.job[data-task="${CSS.escape(job.taskId)}"]`);
  if (!el) {
    el = document.createElement("div");
    el.className = "job";
    el.dataset.task = job.taskId;
    el.innerHTML = `<div class="spinner" aria-hidden="true"></div>
      <div class="job-text"><div class="job-title"></div><div class="job-state muted small"></div></div>`;
    $(".job-title", el).textContent = job.label;
    $("#jobs").prepend(el);
  }
  return el;
}

function removeJob(taskId) {
  writeJSON(JOB_STORE, readJSON(JOB_STORE, []).filter((j) => j.taskId !== taskId));
  watching.delete(taskId);
}

const STATE_TEXT = {
  PENDING: "Queued…",
  TEXT_SUCCESS: "Lyrics written, composing music…",
  FIRST_SUCCESS: "First version ready (streaming). Finishing the second…",
  SUCCESS: "Done!",
};

async function watchJob(job) {
  if (watching.has(job.taskId)) return;
  watching.add(job.taskId);
  const el = jobEl(job);
  const state = $(".job-state", el);
  state.textContent = "Queued…";

  while (watching.has(job.taskId)) {
    if (Date.now() - job.started > MAX_WAIT_MS) {
      fail("This is taking too long. Check back later or try again.");
      return;
    }
    try {
      const data = await api("/api/v1/generate/record-info", { query: { taskId: job.taskId } });
      const status = data?.status || "PENDING";
      const tracks = data?.response?.sunoData || [];

      if (FAILED_STATES[status] || /FAIL|ERROR|EXCEPTION/.test(status)) {
        fail(data.errorMessage || FAILED_STATES[status] || "Generation failed.");
        return;
      }
      if (tracks.length) addTracks(tracks, job, status === "SUCCESS");
      state.textContent = STATE_TEXT[status] || status;

      if (status === "SUCCESS") {
        el.remove();
        removeJob(job.taskId);
        refreshCredits();
        return;
      }
    } catch (err) {
      if (err.code === 401) {
        state.textContent = "Waiting for a valid API key…";
        watching.delete(job.taskId);
        return;
      }
      state.textContent = `Retrying… (${err.message})`;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  function fail(message) {
    el.classList.add("failed");
    $(".spinner", el).remove();
    state.textContent = message;
    state.classList.add("error");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn-ghost small";
    close.textContent = "Dismiss";
    close.addEventListener("click", () => el.remove());
    el.append(close);
    removeJob(job.taskId);
  }
}

function resumeJobs() {
  for (const job of readJSON(JOB_STORE, [])) watchJob(job);
}

// ---------- AI lyrics ----------

async function generateLyrics() {
  const prompt = $("#ai-lyrics-prompt").value.trim();
  const status = $("#ai-lyrics-status");
  const btn = $("#ai-lyrics-go");
  if (!prompt) {
    status.textContent = "Tell the AI what the song is about.";
    return;
  }
  btn.disabled = true;
  status.textContent = "Writing lyrics…";
  try {
    const { taskId } = await api("/api/v1/lyrics", { method: "POST", body: { prompt, callBackUrl: callBackUrl() } });
    const started = Date.now();
    while (Date.now() - started < 5 * 60 * 1000) {
      await new Promise((r) => setTimeout(r, 4000));
      const data = await api("/api/v1/lyrics/record-info", { query: { taskId } });
      const st = data?.status || "PENDING";
      if (FAILED_STATES[st] || /FAIL|ERROR|EXCEPTION/.test(st)) {
        throw new Error(data.errorMessage || FAILED_STATES[st] || "Lyrics generation failed.");
      }
      const options = (data?.response?.data || []).filter((d) => d.text);
      if (st === "SUCCESS" && options.length) {
        const pick = options[0];
        $("#lyrics").value = pick.text;
        $("#lyrics").dispatchEvent(new Event("input"));
        const title = $("#form-custom").elements.title;
        if (!title.value && pick.title) title.value = pick.title;
        status.textContent = options.length > 1 ? `Done! Used option 1 of ${options.length}. Edit freely.` : "Done! Edit freely.";
        refreshCredits();
        return;
      }
    }
    throw new Error("Lyrics took too long. Try again.");
  } catch (err) {
    status.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

// ---------- library ----------

function normalizeTrack(t, job) {
  return {
    id: t.id,
    title: t.title || job.label,
    tags: t.tags || job.params.style || "",
    image: t.image_url || t.imageUrl || t.source_image_url || "",
    audio: t.audio_url || t.audioUrl || t.source_audio_url || "",
    stream: t.stream_audio_url || t.streamAudioUrl || t.source_stream_audio_url || "",
    lyrics: t.prompt || "",
    duration: t.duration || 0,
    model: t.model_name || t.modelName || job.params.model,
    created: Date.now(),
    params: job.params,
  };
}

function addTracks(tracks, job) {
  const lib = readJSON(LIB_STORE, []);
  for (const raw of [...tracks].reverse()) {
    if (!raw.id) continue;
    const t = normalizeTrack(raw, job);
    const i = lib.findIndex((x) => x.id === t.id);
    if (i >= 0) lib[i] = { ...lib[i], ...t, created: lib[i].created };
    else lib.unshift(t);
  }
  writeJSON(LIB_STORE, lib.slice(0, 200));
  renderLibrary();
}

function fmtDuration(s) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

function renderLibrary() {
  const lib = readJSON(LIB_STORE, []);
  const root = $("#library");
  const tpl = $("#track-tpl");

  // Keep currently-playing players intact where possible.
  const existing = new Map($$(".track", root).map((el) => [el.dataset.id, el]));
  root.replaceChildren();

  for (const t of lib) {
    const src = t.audio || t.stream;
    let el = existing.get(t.id);
    if (!el || el.dataset.src !== src) {
      el = tpl.content.firstElementChild.cloneNode(true);
      el.dataset.id = t.id;
      el.dataset.src = src;
      const img = $(".cover", el);
      img.addEventListener("error", () => img.removeAttribute("src"), { once: true });
      if (t.image) img.src = t.image;
      else img.removeAttribute("src");
      $("audio", el).src = src;
      wireTrack(el, t);
    }
    $(".track-title", el).textContent = t.title;
    const meta = [fmtDuration(t.duration), t.model].filter(Boolean).join(" · ");
    $(".track-meta", el).textContent = t.audio ? meta : `${meta ? meta + " · " : ""}streaming preview`;
    $(".track-tags", el).textContent = t.tags;
    const dl = $(".dl", el);
    dl.hidden = !t.audio;
    if (t.audio) {
      dl.href = t.audio;
      dl.setAttribute("download", `${t.title.replace(/[^\w\- ]+/g, "").trim() || "song"}.mp3`);
    }
    $(".show-lyrics", el).hidden = !t.lyrics || t.params?.instrumental;
    $(".track-lyrics", el).textContent = t.lyrics;
    root.append(el);
  }
  $("#library-empty").hidden = lib.length > 0;
  $("#clear-library").hidden = lib.length === 0;
}

function wireTrack(el, t) {
  $(".show-lyrics", el).addEventListener("click", () => {
    const pre = $(".track-lyrics", el);
    pre.hidden = !pre.hidden;
  });
  $(".remove", el).addEventListener("click", () => {
    writeJSON(LIB_STORE, readJSON(LIB_STORE, []).filter((x) => x.id !== t.id));
    renderLibrary();
  });
  $(".reuse", el).addEventListener("click", () => reuse(t));
  // Only one song plays at a time.
  $("audio", el).addEventListener("play", (e) =>
    $$("audio").forEach((a) => a !== e.target && a.pause())
  );
}

function reuse(t) {
  const p = t.params || {};
  if (p.customMode) {
    $("#tab-custom").click();
    const f = $("#form-custom").elements;
    f.title.value = p.title || t.title || "";
    f.style.value = p.style || t.tags || "";
    f.instrumental.checked = Boolean(p.instrumental);
    f.instrumental.dispatchEvent(new Event("change"));
    f.lyrics.value = p.lyrics || t.lyrics || "";
    f.negativeTags.value = p.negativeTags || "";
    f.vocalGender.value = p.vocalGender || "";
    if (p.model) f.model.value = p.model;
  } else {
    $("#tab-simple").click();
    const f = $("#form-simple").elements;
    f.prompt.value = p.prompt || "";
    f.style.value = p.style || "";
    f.instrumental.checked = Boolean(p.instrumental);
    if (p.model) f.model.value = p.model;
  }
  $$("textarea").forEach((x) => x.dispatchEvent(new Event("input")));
  $(".panel").scrollIntoView({ behavior: "smooth" });
}

// ---------- init ----------

function init() {
  initKeyDialog();
  initForms();
  syncKeyUI();
  renderLibrary();
  $("#clear-library").addEventListener("click", () => {
    if (confirm("Remove all songs from this list? (They stay in your Suno account for 14 days.)")) {
      writeJSON(LIB_STORE, []);
      renderLibrary();
    }
  });
  if (getKey()) {
    refreshCredits();
    resumeJobs();
  }
}

init();
