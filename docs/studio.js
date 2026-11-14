import { colorHex, colorWord, connectKeyboard } from "./device.js";
import { bindingLabel, codes, keyOptions, layout, makeDemo, paintKey, usageLabel } from "./layout.js";
import { getModel, models } from "./models.js";
import { advancedLabel } from "./customizations.js";
import { lightbarLength, validLightbar } from "./lightbar.js";
import { lightingPresets, presetColors } from "./presets.js";

const el = id => document.getElementById(id);
const setText = (id, value) => { el(id).textContent = value; };
const status = message => setText("status", message);
const copy = value => structuredClone(value);
const hid = navigator.hid;
const titles = {
  tune: ["Performance", "Tune the profile defaults or set overrides for individual switches."],
  colors: ["Lighting", "Paint individual keys, groups, or the whole board."],
  map: ["Keymap", "Inspect and edit the physical keyboard’s bindings by layer."],
  advanced: ["Advanced keys", "Create multi-stage actions, tap and hold behavior, and paired inputs."],
  monitor: ["Analog monitor", "See how far each switch travels while you press it."],
  profiles: ["Profiles", "Manage onboard slots and keep portable local presets."],
  device: ["Device", "Explore the keyboard lineup and check what this connection supports."],
};
const groupLabels = { tune: "Profile actuation and Rapid Trigger", actuation: "Per-key actuation",
  rapid: "Per-key Rapid Trigger", colors: "RGB colors", lighting: "RGB effect and brightness", map: "Key bindings",
  advanced: "Advanced key actions", lightbar: "Lightbar settings" };
const workFields = Object.keys(groupLabels);
const storageKey = "openwootility.studio-presets.v1";
const connectionPreference = "openwootility.reconnect";
const demoSlots = new Map();
const demoProfiles = () => ({ active: 0, names: ["Typing", "Gaming", "Precision", "Custom"] });

let family = "80";
let variant = "ANSI";
let tab = "tune";
let session;
let original = makeDemo(family);
let draft = copy(original);
let profiles = demoProfiles();
let busy = false;
let monitorStop;
let monitoring = false;
let monitorValues = new Map();
let peaks = new Map();
let historyDirty = true;
let queuedFrame = false;
let selected = new Set();
let anchor;
let keys = [];
let keysByIndex = new Map();
let keysByUsage = new Map();
let buttons = new Map();
let undo = [];
let redo = [];
let presets = [];
let brush = false;
let gesture;
let suppressClick = false;
let captureBinding = false;
let liveLightbar;
let lightbarTimer;
let lightbarRead;

const onboard = () => Boolean(session?.profileEditing);
const slotKey = slot => `${family}/${variant}/${slot}`;
const scope = key => `${draft.layer}/${key.id}`;
const rgbAvailable = () => getModel(family).rgb !== false;
const canEditLighting = () => rgbAvailable() && (!onboard() || draft.effectEditing);
const canEditAdvanced = () => !onboard() || draft.advancedEditing;
const canEditLightbar = () => Boolean(draft.lightbar && (!onboard() || draft.lightbarEditing));

try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
  if (Array.isArray(stored)) presets = stored.filter(preset => typeof preset.name === "string");
} catch { /* The editor remains usable without local storage. */ }

function dirty() {
  return workFields.filter(key => JSON.stringify(original[key]) !== JSON.stringify(draft[key]));
}

function buildBoard() {
  const rows = layout(family, variant);
  keys = rows.flat().filter(key => !key.gap);
  keysByIndex = new Map(keys.map(key => [key.id, key]));
  keysByUsage = new Map(keys.filter(key => key.usage).map(key => [key.usage, key]));
  const width = Math.max(...rows.map(row => row.reduce((sum, key) => sum + key.width, 0)));
  const board = el("board");
  board.replaceChildren();
  board.style.setProperty("--columns", width);
  board.dataset.family = getModel(family).shape;
  board.dataset.variant = variant;
  buttons = new Map();
  for (const row of rows) {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";
    for (const key of row) {
      const item = document.createElement(key.gap ? "span" : "button");
      item.className = key.gap ? "key-gap" : "key";
      item.style.setProperty("--width", key.width);
      if (!key.gap) {
        item.type = "button";
        item.dataset.key = key.id;
        item.setAttribute("aria-label", key.label);
        const label = document.createElement("span");
        const hint = document.createElement("small");
        label.textContent = key.label;
        item.append(label, hint);
        item.addEventListener("click", event => {
          if (busy || (suppressClick && event.detail)) return;
          if (tab === "colors" && brush) {
            paint([key]);
            return;
          }
          if (event.shiftKey && anchor !== undefined) {
            const start = keys.findIndex(item => item.id === anchor);
            const end = keys.indexOf(key);
            for (const ranged of keys.slice(Math.min(start, end), Math.max(start, end) + 1)) selected.add(ranged.id);
          } else if (selected.has(key.id)) selected.delete(key.id);
          else selected.add(key.id);
          anchor = key.id;
          syncSelection();
          update();
        });
        buttons.set(key.id, item);
      }
      rowEl.append(item);
    }
    board.append(rowEl);
  }
  if (getModel(family).lightbar) {
    const strip = document.createElement("button");
    strip.id = "board-lightbar";
    strip.type = "button";
    strip.className = "board-lightbar";
    strip.setAttribute("aria-label", "Edit lightbar");
    for (let index = 0; index < lightbarLength; index++) strip.append(document.createElement("span"));
    strip.addEventListener("click", () => {
      document.querySelector('[data-tab="colors"]').click();
      el("lightbar-panel").scrollIntoView({ block: "nearest" });
      el("lightbar-mode").focus({ preventScroll: true });
    });
    board.append(strip);
  }
  setText("layout-title", `${getModel(family).name} ${variant}`);
  setText("key-count", `${keys.length} keys`);
}

function paintBoard() {
  const board = el("board");
  const effect = tab === "colors" ? draft.lighting.effect : "static";
  board.dataset.effect = effect;
  board.style.setProperty("--effect-time", `${Math.max(.8, 10 - draft.lighting.speed * .24)}s`);
  for (const key of keys) {
    const item = buttons.get(key.id);
    item.setAttribute("aria-pressed", String(selected.has(key.id)));
    const reading = monitorValues.get(key.id) || (key.usage && monitorValues.get(`usage/${key.usage}`));
    item.dataset.pressed = String(tab === "monitor" && Boolean(reading));
    item.dataset.actuated = String(tab === "monitor" && reading?.actuated === true);
    item.style.setProperty("--paint", draft.colors[key.row]?.[key.col] || "#102030");
    item.style.setProperty("--strength", tab === "colors" ? `${draft.lighting.brightness * .78}%` : "0%");
    item.style.setProperty("--offset", -(key.col * .14 + key.row * .08) + "s");
    const assigned = draft.map?.[key.row]?.[key.col];
    const actuation = draft.actuation[key.id];
    const rapid = draft.rapid[key.id];
    item.dataset.override = String(tab === "tune" && (actuation !== undefined || Boolean(rapid)));
    item.lastElementChild.textContent = tab === "map" && assigned !== undefined && assigned !== key.value ?
      bindingLabel(assigned) : tab === "tune" && (actuation !== undefined || rapid) ?
        `${actuation === undefined ? "" : actuation.toFixed(2)}${rapid ? (rapid.off ? " RT off" : " RT") : ""}` :
        tab === "advanced" && draft.advanced[scope(key)] ? advancedLabel(draft.advanced[scope(key)].kind) :
        tab === "monitor" && reading ? travelText(reading) : "";
  }
}

function rangeValues() {
  const actuation = Number(el("actuation").value);
  setText("actuation-value", actuation.toFixed(2) + " mm");
  el("actuation-marker").style.setProperty("--travel", `${25 + actuation / 4 * 52}%`);
  setText("sensitivity-value", Number(el("sensitivity").value).toFixed(2) + " mm");
  for (const id of ["actuation", "sensitivity"]) {
    const slider = el(id);
    const position = (Number(slider.value) - Number(slider.min)) / (Number(slider.max) - Number(slider.min));
    slider.style.setProperty("--progress", `${position * 100}%`);
  }
}

function tuneInputs() {
  const active = el("per-key").checked && selected.size === 1 ? [...selected][0] : undefined;
  const rapid = draft.rapid[active];
  el("actuation").value = draft.actuation[active] ?? draft.tune.actuation;
  el("rapid").checked = rapid?.off ? false : rapid ? true : draft.tune.enabled;
  el("sensitivity").value = rapid?.sensitivity ?? draft.tune.sensitivity;
  el("continuous").checked = rapid?.continuous ?? false;
  const release = rapid?.secondary ?? draft.tune.secondary;
  el("split-sensitivity").checked = release !== undefined;
  el("release-sensitivity").value = release ?? .2;
  rangeValues();
}

function update() {
  const groups = dirty();
  const perKey = el("per-key").checked;
  const count = selected.size;
  const inBrush = tab === "colors" && brush && rgbAvailable();
  setText("selected-count", `${count} selected`);
  setText("changes", groups.length ? `${groups.length} pending ${groups.length === 1 ? "section" : "sections"}` : "No pending changes");
  el("changes").closest(".savebar").dataset.dirty = String(Boolean(groups.length));
  setText("device-name", getModel(family).name);
  setText("device-info", session ? `${variant} · Firmware ${session.firmware}` : `${variant} · Sample profile`);
  setText("connection", session ? "Connected" : "Demo mode");
  el("connection").classList.toggle("demo", !session);
  el("demo-model-label").hidden = Boolean(session);
  el("demo-layout-label").hidden = Boolean(session);
  setText("slot-label", onboard() ? "Onboard profiles" : "Local workspace slots");
  setText("connect", session ? "Disconnect" : "Connect keyboard");
  setText("stage-tuning", perKey ? "Stage selected key tuning" : "Stage profile tuning");
  setText("monitor-toggle", monitoring ? "Stop analog monitor" : "Start analog monitor");
  setText("editing-profile", profiles.names[draft.slot] || `Slot ${draft.slot + 1}`);
  setText("stage-hint", inBrush ? "Drag across keys to paint with the current color." :
    "Click or drag to select. Shift adds a range.");
  el("layer-control").hidden = tab !== "map" && tab !== "advanced";
  el("release-label").hidden = !el("split-sensitivity").checked;
  el("lighting-mode").hidden = tab !== "colors";
  el("select-tool").setAttribute("aria-pressed", String(!brush));
  el("brush-tool").setAttribute("aria-pressed", String(brush));
  el("key-stage").classList.toggle("brushing", inBrush);
  setText("map-hint", draft.sharedMap ?
    "This layer is inherited from the first onboard slot. Open that slot to edit the shared map." :
    draft.map ? "Select physical keys, then choose what they should send." : "This slot has no saved mapping for the selected layer.");
  const picked = keys.filter(key => selected.has(key.id));
  setText("map-selection", picked.length ? picked.slice(0, 4).map(key => {
    const value = draft.map?.[key.row]?.[key.col];
    return value === undefined ? key.label : `${key.label} → ${bindingLabel(value)}`;
  }).join(" · ") + (picked.length > 4 ? ` · +${picked.length - 4} more` : "") :
    "Select keys on the board to see their current bindings.");
  el("profile").disabled = busy;
  for (const card of el("profile-cards").children) card.disabled = busy;
  el("layer").disabled = busy;
  el("connect").disabled = busy || !hid;
  el("clear-selection").disabled = !count;
  el("stage-tuning").disabled = busy || (perKey && !count);
  el("clear-overrides").disabled = busy || !count;
  el("clear-overrides").hidden = !perKey;
  el("continuous-label").hidden = !perKey;
  el("stage-map").disabled = busy || !count || !draft.map || draft.sharedMap || !el("binding").value;
  el("paint-selected").disabled = busy || !count || !rgbAvailable();
  el("paint-all").disabled = busy || !rgbAvailable();
  el("brush-tool").disabled = !rgbAvailable();
  el("gradient").disabled = busy || !rgbAvailable();
  for (const button of document.querySelectorAll("[data-palette], [data-preset]")) button.disabled = busy || !rgbAvailable();
  el("preset-lightbar").disabled = busy || !canEditLightbar();
  el("preview").disabled = busy || !session?.previewAvailable;
  el("stage-lighting").disabled = busy || !canEditLighting();
  el("solid-paint").disabled = busy || !canEditLighting();
  setText("lighting-hint", !rgbAvailable() ? "This model has no RGB lighting." :
    canEditLighting() ? draft.lighting.clearEffects ? "Static colors staged. Saving clears the keyboard’s RGB effect layers." :
      `The profile has ${draft.lighting.effectLayers || 0} RGB effect layers. Solid painting clears them when you save.` :
    "Onboard effect editing is available only in supported first slots. Per-key colors have separate controls.");
  el("restore").disabled = busy || !session?.previewing;
  el("monitor-toggle").disabled = busy || Boolean(session && !session.analogDevice);
  el("lightbar-panel").hidden = !draft.lightbar;
  el("stage-lightbar").disabled = busy || !canEditLightbar();
  for (const button of el("lightbar-panel").querySelectorAll("[data-bar-recipe]")) button.disabled = busy || !canEditLightbar();
  if (draft.lightbar) setText("lightbar-hint", canEditLightbar() ? "Set the base look while keeping existing indicator layers." :
    "The keyboard did not provide a readable lightbar profile for this slot.");
  el("activate-profile").disabled = busy || draft.slot === profiles.active;
  el("refresh").disabled = busy || !onboard();
  el("undo").disabled = busy || !undo.length;
  el("redo").disabled = busy || !redo.length;
  el("discard").disabled = busy || !groups.length;
  el("review").disabled = busy || !groups.length || (onboard() && draft.slot !== profiles.active);
  el("load-preset").disabled = busy || !presets.length;
  el("delete-preset").disabled = busy || !presets.length;
  el("save-preset").disabled = busy;
  el("import").disabled = busy;
  if (tab === "advanced") renderAdvanced();
  if (tab === "device") renderCapabilities();
  if (tab === "monitor") renderHistory();
  paintBoard();
  paintLightbar();
  scheduleLightbarRead();
}

function renderProfiles() {
  const select = el("profile");
  const cards = el("profile-cards");
  select.replaceChildren();
  cards.replaceChildren();
  profiles.names.forEach((name, slot) => {
    if (name === null) return;
    select.add(new Option(`${slot + 1} · ${name}${slot === profiles.active ? " (active)" : ""}`, slot));
    const card = document.createElement("button");
    card.type = "button";
    card.className = "profile-card";
    card.setAttribute("aria-pressed", String(slot === draft.slot));
    const number = document.createElement("span");
    number.className = "profile-number";
    number.textContent = String(slot + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.className = "profile-name";
    label.textContent = name;
    const active = document.createElement("span");
    active.className = "profile-active";
    active.textContent = slot === profiles.active ? "Active" : "";
    card.append(number, label, active);
    card.addEventListener("click", () => {
      if (slot !== draft.slot) editSlot(slot, 0);
    });
    cards.append(card);
  });
  select.value = draft.slot;
  el("layer").value = draft.layer;
}

function replaceProfile(profile) {
  original = profile;
  draft = copy(profile);
  undo = [];
  redo = [];
  syncSelection();
  lightingInputs();
  lightbarInputs();
  renderLightingPresets();
  renderProfiles();
  update();
}

function stage(change) {
  const before = copy(draft);
  change(draft);
  if (JSON.stringify(before) === JSON.stringify(draft)) return;
  undo.push(before);
  if (undo.length > 50) undo.shift();
  redo = [];
  status("Edits staged. Review them before saving.");
  update();
}

function moveHistory(from, to) {
  if (!from.length) return;
  to.push(draft);
  draft = from.pop();
  syncSelection();
  lightingInputs();
  lightbarInputs();
  update();
}

async function run(action) {
  if (busy) return;
  busy = true;
  update();
  try {
    if (lightbarRead) {
      const current = session;
      await lightbarRead;
      if (session !== current) return;
    }
    await action();
  } catch (error) {
    status(error.message || String(error));
  } finally {
    busy = false;
    update();
  }
}

function select(ids) {
  selected = new Set(ids);
  anchor = undefined;
  syncSelection();
  update();
}

async function stopMonitor() {
  const stop = monitorStop;
  monitorStop = undefined;
  monitoring = false;
  showTravel(new Map());
  if (stop) await stop();
}

function travelText(reading) {
  const fullTravel = session ? session.travel?.get(reading.index) : 4;
  return fullTravel === undefined ? `${(reading.fraction * 100).toFixed(1)}%` : `${(reading.fraction * fullTravel).toFixed(2)} mm`;
}

function readingKey(reading) {
  return reading.index === undefined ? keysByUsage.get(reading.usage) : keysByIndex.get(reading.index);
}

function readingName(reading) {
  const key = readingKey(reading);
  if (key) return key.label;
  if (reading.index !== undefined) return `Row ${(reading.index >> 5) + 1}, column ${(reading.index & 31) + 1}`;
  return usageLabel.get(reading.usage) || `HID 0x${reading.usage.toString(16)}`;
}

function clearHistory() {
  peaks.clear();
  historyDirty = true;
  renderHistory();
}

function renderHistory() {
  const results = [...peaks.values()].filter(reading => !selected.size || selected.has(readingKey(reading)?.id));
  el("export-peaks").disabled = !results.length;
  const rank = reading => reading.fraction * (session?.travel?.get(reading.index) ?? (session ? 1 : 4));
  const comparable = [...peaks.values()];
  const scaled = comparable.filter(reading => !session || session.travel?.has(reading.index) && session.travel.get(reading.index) !== undefined);
  const deepest = (scaled.length ? scaled : comparable).reduce((best, reading) => !best || rank(reading) > rank(best) ? reading : best, null);
  setText("peak-travel", deepest ? travelText(deepest) : "—");
  const list = el("history-list");
  if (!results.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = peaks.size ? "No recorded peaks for the selection." : "Press a key to start recording.";
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...results.map(reading => {
    const line = document.createElement("div");
    line.className = "history-row";
    const name = document.createElement("span");
    const depth = document.createElement("output");
    name.textContent = readingName(reading);
    depth.textContent = travelText(reading);
    line.append(name, depth);
    return line;
  }));
}

function showTravel(values) {
  monitorValues = values;
  for (const [id, reading] of values) {
    if (reading.fraction <= (peaks.get(id)?.fraction ?? 0)) continue;
    peaks.set(id, reading);
    historyDirty = true;
  }
  if (queuedFrame) return;
  queuedFrame = true;
  requestAnimationFrame(() => {
    queuedFrame = false;
    if (historyDirty) {
      historyDirty = false;
      renderHistory();
    }
    const list = el("travel");
    list.replaceChildren();
    if (!monitorValues.size) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No keys pressed.";
      list.append(empty);
    }
    for (const reading of monitorValues.values()) {
      const line = document.createElement("div");
      line.className = "travel-row";
      const name = document.createElement("span");
      const progress = document.createElement("progress");
      const value = document.createElement("span");
      name.textContent = readingName(reading);
      line.dataset.actuated = String(reading.actuated === true);
      progress.max = 1;
      progress.value = reading.fraction;
      progress.setAttribute("aria-label", name.textContent + " travel");
      value.textContent = travelText(reading);
      line.append(name, progress, value);
      list.append(line);
    }
    paintBoard();
  });
}

function demoProfile(slot, layer) {
  const fallback = makeDemo(family, variant);
  if (layer) fallback.map = fallback.map.map(row => row.map(() => 255));
  const saved = localSlot(slot);
  return copy({ ...fallback, ...saved?.profile, map: saved?.maps?.[layer] || fallback.map, slot, layer });
}

function localSlot(slot) {
  const index = slotKey(slot);
  if (demoSlots.has(index)) return demoSlots.get(index);
  try { return JSON.parse(localStorage.getItem(`openwootility.slot.${index}`)); }
  catch { return null; }
}

async function loadSlot(slot, layer) {
  replaceProfile(onboard() ? await session.read(slot, layer) : demoProfile(slot, layer));
}

function editSlot(slot, layer) {
  renderProfiles();
  if (dirty().length) {
    status("Save or discard your pending edits before opening a different slot or layer.");
    return;
  }
  void run(async () => {
    await loadSlot(slot, layer);
    status(`Opened slot ${slot + 1}${layer ? ` · Fn ${layer}` : ""}.`);
  });
}

function disconnectToDemo() {
  session = undefined;
  liveLightbar = undefined;
  clearHistory();
  profiles = demoProfiles();
  family = el("demo-model").value;
  variant = el("demo-layout").value;
  selected = new Set();
  anchor = undefined;
  buildBoard();
  replaceProfile(demoProfile(0, 0));
}

const on = (id, event, callback) => el(id).addEventListener(event, callback);
const setLayouts = (model, preferred = model.layouts[0]) => {
  el("demo-layout").replaceChildren(...model.layouts.map(name => new Option(name, name)));
  el("demo-layout").value = preferred;
};
for (const button of document.querySelectorAll("[data-tab]")) {
  button.addEventListener("click", () => {
    tab = button.dataset.tab;
    captureBinding = false;
    setText("capture", "Capture keystroke");
    for (const sibling of document.querySelectorAll("[data-tab]")) sibling.removeAttribute("aria-current");
    button.setAttribute("aria-current", "page");
    for (const panel of document.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== tab;
    setText("page-title", titles[tab][0]);
    setText("page-hint", titles[tab][1]);
    update();
  });
}
on("manage-profiles", "click", () => document.querySelector('[data-tab="profiles"]').click());

async function openConnectedKeyboard(connected) {
  session = connected;
  liveLightbar = undefined;
  clearHistory();
  family = session.family;
  variant = session.variant;
  selected = new Set();
  anchor = undefined;
  let profile;
  if (onboard()) {
    try {
      profiles = await session.profiles();
      profile = await session.read(profiles.active);
    } catch (error) {
      session.profileEditing = false;
      session.profileError = error.message;
    }
  }
  if (!profile) profiles = demoProfiles();
  buildBoard();
  replaceProfile(profile || demoProfile(0, 0));
  status(profile ? "Profile read from keyboard. Changes stay staged until you save." :
    "Keyboard connected. Local editing is available. Check Device for live features.");
}

function rememberConnection(enabled) {
  try { localStorage.setItem(connectionPreference, enabled ? "on" : "off"); }
  catch { /* The keyboard can still connect when storage is disabled. */ }
}

on("connect", "click", () => run(async () => {
  if (dirty().length) throw new Error("Save or discard your pending edits before changing devices.");
  if (session) {
    rememberConnection(false);
    await stopMonitor();
    try {
      await session.close();
    } finally {
      disconnectToDemo();
    }
    status("Keyboard disconnected.");
    return;
  }
  status("Select a keyboard in the browser prompt.");
  const connected = await connectKeyboard(hid);
  if (!connected) {
    status("No keyboard selected.");
    return;
  }
  rememberConnection(true);
  await openConnectedKeyboard(connected);
}));

on("lightbar-connect", "click", () => {
  if (session?.arm) {
    liveLightbar = undefined;
    clearTimeout(lightbarTimer);
    lightbarTimer = undefined;
    paintLightbar();
    scheduleLightbarRead();
    return;
  }
  void run(async () => {
    if (dirty().length) throw new Error("Save or discard your pending edits before changing devices.");
    status("Select your keyboard in the browser prompt.");
    const previous = session;
    const connected = await connectKeyboard(hid, { configurationOnly: true, modelId: previous?.family });
    if (!connected) {
      status("No keyboard selected.");
      return;
    }
    if (previous) {
      await stopMonitor();
      await previous.close();
    }
    rememberConnection(true);
    await openConnectedKeyboard(connected);
  });
});
hid?.addEventListener("disconnect", event => {
  if (event.device !== session?.device) return;
  void stopMonitor().catch(() => {});
  disconnectToDemo();
  status("Keyboard disconnected.");
});
document.addEventListener("visibilitychange", () => scheduleLightbarRead());
window.addEventListener("pagehide", () => {
  clearTimeout(lightbarTimer);
  lightbarTimer = undefined;
  if (session && !busy) void session.close().catch(() => {});
});

on("profile", "change", event => editSlot(Number(event.target.value), 0));
on("layer", "change", event => editSlot(draft.slot, Number(event.target.value)));
on("demo-model", "change", event => {
  if (dirty().length) {
    event.target.value = family;
    status("Save or discard your pending edits before changing the demo layout.");
    return;
  }
  family = event.target.value;
  clearHistory();
  setLayouts(getModel(family));
  variant = el("demo-layout").value;
  selected = new Set();
  anchor = undefined;
  buildBoard();
  replaceProfile(demoProfile(0, 0));
});
on("demo-layout", "change", event => {
  if (dirty().length) {
    event.target.value = variant;
    status("Save or discard your pending edits before changing the physical layout.");
    return;
  }
  variant = event.target.value;
  clearHistory();
  selected = new Set();
  anchor = undefined;
  buildBoard();
  replaceProfile(demoProfile(0, 0));
});
on("activate-profile", "click", () => run(async () => {
  if (onboard()) await session.activate(draft.slot);
  profiles.active = draft.slot;
  renderProfiles();
  status(`Slot ${draft.slot + 1} is active.`);
}));
on("refresh", "click", () => {
  if (dirty().length && !window.confirm("Discard staged edits and read the keyboard again?")) return;
  void run(async () => {
    profiles = await session.profiles();
    await loadSlot(profiles.active, 0);
    status("Keyboard profile refreshed.");
  });
});

on("select-all", "click", () => select(keys.map(key => key.id)));
on("select-wasd", "click", () => select(keys.filter(key => ["KeyW","KeyA","KeyS","KeyD"].includes(key.code)).map(key => key.id)));
on("key-group", "change", event => {
  const match = { letters: /^Key/, numbers: /^Digit/, arrows: /^Arrow/, function: /^F\d/, modifiers: /^(Control|Shift|Alt|Meta|Fn)/,
    numpad: /^(Numpad|NumLock)/ }[event.target.value];
  if (match) select(keys.filter(key => match.test(key.code)).map(key => key.id));
  if (event.target.value === "invert") select(keys.filter(key => !selected.has(key.id)).map(key => key.id));
  event.target.value = "";
});
on("clear-selection", "click", () => select([]));
on("per-key", "change", () => { tuneInputs(); update(); });
on("split-sensitivity", "change", update);
on("actuation", "input", rangeValues);
on("sensitivity", "input", rangeValues);
on("stage-tuning", "click", () => run(() => {
  const actuation = Number(el("actuation").value);
  const enabled = el("rapid").checked;
  const sensitivity = Number(el("sensitivity").value);
  const secondary = el("split-sensitivity").checked ? el("release-sensitivity").valueAsNumber : undefined;
  if (secondary !== undefined && !el("release-sensitivity").validity.valid) {
    throw new Error("Enter a release sensitivity from 0.10 to 4.00 mm.");
  }
  if (Number.isNaN(secondary)) throw new Error("Enter a release sensitivity in millimeters.");
  const split = secondary === undefined ? {} : { secondary };
  stage(profile => {
    if (!el("per-key").checked) {
      profile.tune = { actuation, enabled, sensitivity, ...split };
      return;
    }
    for (const id of selected) {
      profile.actuation[id] = actuation;
      profile.rapid[id] = enabled ? { sensitivity, continuous: el("continuous").checked, ...split } : { off: true };
    }
  });
}));
const tuningRecipes = {
  typing: { actuation: 2, enabled: false, sensitivity: .35 },
  balanced: { actuation: 1.4, enabled: true, sensitivity: .3 },
  fast: { actuation: .8, enabled: true, sensitivity: .2 },
};
for (const button of document.querySelectorAll("[data-tuning]")) button.addEventListener("click", () => {
  if (busy) return;
  el("per-key").checked = false;
  stage(profile => { profile.tune = { ...tuningRecipes[button.dataset.tuning] }; });
  tuneInputs();
  update();
});
on("clear-overrides", "click", () => stage(profile => {
  for (const id of selected) {
    delete profile.actuation[id];
    delete profile.rapid[id];
  }
}));

const swatches = ["#68dec8", "#709dff", "#a987ff", "#fa81a6", "#ff986b", "#fee37d", "#eaf3ff", "#000000"];
let hue = 247;
let saturation = .39;
let brightness = 1;

function showColor(color) {
  el("color").value = color;
  el("hex-entry").value = color.toUpperCase();
  el("hex-entry").removeAttribute("aria-invalid");
  el("hue").value = Math.round(hue) % 360;
  el("color-plane").style.setProperty("--hue", `hsl(${hue} 100% 50%)`);
  el("color-cursor").style.setProperty("--sat", `${saturation * 100}%`);
  el("color-cursor").style.setProperty("--shade", `${(1 - brightness) * 100}%`);
}

function chooseColor(color) {
  const [r, g, b] = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255);
  brightness = Math.max(r, g, b);
  const chroma = brightness - Math.min(r, g, b);
  saturation = brightness ? chroma / brightness : 0;
  if (chroma) {
    const sector = brightness === r ? (g - b) / chroma : brightness === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
    hue = (sector * 60 + 360) % 360;
  }
  showColor(color);
}

function showPickerColor() {
  const channel = offset => {
    const position = (offset + hue / 60) % 6;
    const fraction = Math.max(0, Math.min(position, 4 - position, 1));
    return Math.round(255 * brightness * (1 - saturation * fraction)).toString(16).padStart(2, "0");
  };
  showColor("#" + [5, 3, 1].map(channel).join(""));
}

function pointColor(event) {
  const rect = el("color-plane").getBoundingClientRect();
  const unit = value => Math.min(1, Math.max(0, value));
  saturation = unit((event.clientX - rect.left) / rect.width);
  brightness = 1 - unit((event.clientY - rect.top) / rect.height);
  showPickerColor();
}
for (const color of swatches) {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "swatch";
  swatch.style.setProperty("--swatch", color);
  swatch.setAttribute("aria-label", `Use ${color.toUpperCase()}`);
  swatch.addEventListener("click", () => chooseColor(color));
  el("palette").append(swatch);
}
on("color", "input", event => chooseColor(event.target.value));
on("hue", "input", event => {
  hue = Number(event.target.value);
  showPickerColor();
});
on("hex-entry", "change", event => {
  const input = event.target;
  const value = input.value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(value)) chooseColor("#" + value.toLowerCase());
  else input.setAttribute("aria-invalid", "true");
});
on("hex-entry", "keydown", event => { if (event.key === "Enter") event.target.blur(); });
on("color-plane", "pointerdown", event => {
  if (event.button !== 0) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  pointColor(event);
});
on("color-plane", "pointermove", event => {
  if (event.currentTarget.hasPointerCapture(event.pointerId)) pointColor(event);
});
function paint(targets, color = el("color").value) {
  if (!rgbAvailable()) return;
  stage(profile => {
    for (const key of targets) paintKey(profile.colors, key, color, family, variant);
    stageSolidPaint(profile);
  });
  lightingInputs();
}
on("paint-selected", "click", () => paint(keys.filter(key => selected.has(key.id))));
on("paint-all", "click", () => paint(keys));
const paletteRecipes = { prism: [[104,222,200],[169,135,255]], ember: [[255,188,89],[181,28,78]],
  ocean: [[53,232,211],[72,91,255]] };
function gradient(recipe) {
  if (busy) return;
  const targets = selected.size ? keys.filter(key => selected.has(key.id)) : keys;
  const left = Math.min(...targets.map(key => key.col));
  const span = Math.max(1, Math.max(...targets.map(key => key.col)) - left);
  const [start, end] = paletteRecipes[recipe];
  stage(profile => {
    for (const key of targets) {
      const ratio = (key.col - left) / span;
      const color = "#" + start.map((channel, i) => Math.round(channel + (end[i] - channel) * ratio)
        .toString(16).padStart(2, "0")).join("");
      paintKey(profile.colors, key, color, family, variant);
    }
    stageSolidPaint(profile);
  });
  lightingInputs();
}
on("gradient", "click", () => gradient("prism"));
for (const button of document.querySelectorAll("[data-palette]")) button.addEventListener("click", () => gradient(button.dataset.palette));
function stageSolidPaint(profile) {
  if (el("solid-paint").checked && canEditLighting() &&
      (profile.lighting.effect !== "static" || profile.lighting.effectLayers > 0)) {
    profile.lighting = { ...profile.lighting, effect: "static", speed: 16, clearEffects: true };
  }
}

function renderLightingPresets() {
  const collection = el("preset-collection").value;
  const cards = lightingPresets.filter(preset => collection === "all" || preset.source === collection).map(preset => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lighting-preset";
    button.dataset.preset = preset.id;
    button.disabled = busy || !rgbAvailable();
    const colors = presetColors(preset, family, variant);
    const swatches = preset.stops || [...new Set(colors.flat())].slice(0, 12);
    button.style.setProperty("--preset-gradient", `linear-gradient(110deg, ${swatches.join(", ")})`);
    const preview = document.createElement("span");
    preview.className = "preset-preview";
    preview.setAttribute("aria-hidden", "true");
    const title = document.createElement("strong");
    title.textContent = preset.name;
    const detail = document.createElement("small");
    detail.textContent = preset.description || `${preset.source} color preset`;
    button.append(preview, title, detail);
    button.addEventListener("click", () => {
      if (busy || !rgbAvailable()) return;
      stage(profile => {
        profile.colors = colors.map(row => [...row]);
        stageSolidPaint(profile);
        if (canEditLighting()) profile.lighting.brightness = 100;
        if (el("preset-lightbar").checked && canEditLightbar()) {
          const width = Math.max(...keys.map(key => key.col));
          profile.lightbar = { ...profile.lightbar, enabled: true, linked: false, brightness: 100, mode: "segments",
            segments: Array.from({ length: lightbarLength }, (_, index) => colors[1][Math.round(index * width / (lightbarLength - 1))]) };
        }
      });
      lightingInputs();
      lightbarInputs();
      status(`${preset.name} staged for the whole keyboard. Review & save to apply.${
        !canEditLighting() ? " Brightness and effect editing are unavailable in this slot." : ""}`);
    });
    return button;
  });
  el("lighting-presets").replaceChildren(...cards);
}
on("preset-collection", "change", renderLightingPresets);

function lightingInputs() {
  el("lighting-effect").value = draft.lighting.effect;
  el("lighting-brightness").value = draft.lighting.brightness;
  el("lighting-speed").value = draft.lighting.speed;
  setText("lighting-level", `${draft.lighting.brightness}%`);
  el("lighting-brightness").style.setProperty("--progress", `${draft.lighting.brightness}%`);
  updateSpeed();
  for (const input of el("indicator-colors").querySelectorAll("input")) {
    const value = draft.lighting.indicators?.[input.dataset.indicator];
    input.disabled = onboard() && value === undefined;
    input.value = value === undefined ? "#ffffff" : colorHex(value);
  }
}
function updateSpeed() {
  const effect = el("lighting-effect").value;
  el("speed-label").hidden = effect === "static";
  el("lighting-speed").min = effect === "spiral" ? -255 : 0;
}
on("lighting-effect", "change", () => {
  updateSpeed();
  if (!el("lighting-speed").validity.valid) el("lighting-speed").value = 16;
});
on("lighting-brightness", "input", event => {
  const level = `${event.target.value}%`;
  setText("lighting-level", level);
  event.target.style.setProperty("--progress", level);
});
on("stage-lighting", "click", () => run(() => {
  const effect = el("lighting-effect").value;
  const speed = el("lighting-speed").valueAsNumber;
  if (effect !== "static" && (!el("lighting-speed").validity.valid || !Number.isInteger(speed))) {
    throw new Error(`Enter a whole-number speed from ${el("lighting-speed").min} to 255.`);
  }
  const indicators = { ...draft.lighting.indicators };
  for (const input of el("indicator-colors").querySelectorAll("input:not(:disabled)")) {
    const previous = indicators[input.dataset.indicator];
    if (input.value !== (previous === undefined ? "#ffffff" : colorHex(previous))) indicators[input.dataset.indicator] = colorWord(input.value);
  }
  stage(profile => {
    profile.lighting = { brightness: Number(el("lighting-brightness").value), effect,
      speed: effect === "static" ? 16 : speed, clearEffects: effect === "static",
      ...(Object.keys(indicators).length ? { indicators } : {}) };
  });
}));
on("preview", "click", () => run(async () => {
  const factor = draft.lighting.brightness / 100;
  const scale = hex => "#" + [1, 3, 5].map(start => Math.round(parseInt(hex.slice(start, start + 2), 16) * factor)
    .toString(16).padStart(2, "0")).join("");
  await session.previewLighting(draft.colors.map(row => row.map(scale)));
  status("Live preview active. Restore lighting when you finish.");
}));
on("restore", "click", () => run(async () => {
  await session.restoreLighting();
  status("Stored keyboard lighting restored.");
}));

const segmentInputs = Array.from({ length: lightbarLength }, (_, index) => {
  const label = document.createElement("label");
  label.textContent = String(index + 1);
  const input = document.createElement("input");
  input.type = "color";
  input.setAttribute("aria-label", `Lightbar segment ${index + 1}`);
  label.append(input);
  el("lightbar-segment-colors").append(label);
  return input;
});

el("lightbar-draft").append(...segmentInputs.map(() => document.createElement("span")));

function scheduleLightbarRead(delay = 0) {
  if (!session?.arm || !session.model.lightbar || !session.device.opened || busy || document.hidden) {
    clearTimeout(lightbarTimer);
    lightbarTimer = undefined;
    return;
  }
  if (lightbarRead || lightbarTimer !== undefined) return;
  lightbarTimer = setTimeout(() => {
    lightbarTimer = undefined;
    const current = session;
    if (!current?.device.opened || busy || document.hidden) return;
    lightbarRead = current.readLightbarColors().catch(() => null).then(colors => {
      if (session !== current) return;
      liveLightbar = colors;
      paintLightbar();
    }).finally(() => {
      lightbarRead = undefined;
      scheduleLightbarRead(liveLightbar ? 125 : 2500);
    });
  }, delay);
}

function paintLightbar() {
  const strip = el("board-lightbar");
  const bar = draft.lightbar;
  const feed = el("lightbar-feed");
  const connect = el("lightbar-connect");
  const draftRow = el("lightbar-draft-row");
  feed.hidden = !strip;
  draftRow.hidden = !session || !bar || (JSON.stringify(bar) === JSON.stringify(original.lightbar) &&
    (!bar.linked || draft.lighting.brightness === original.lighting.brightness));
  if (!strip || !bar) return;
  const label = !session ? "Demo lightbar" : liveLightbar ? "Live lightbar" :
    liveLightbar === undefined && session.arm ? "Reading lightbar…" : "Live lightbar unavailable";
  if (feed.textContent !== label) feed.textContent = label;
  feed.dataset.live = String(Boolean(liveLightbar));
  connect.hidden = Boolean(liveLightbar || (session?.arm && liveLightbar === undefined));
  connect.disabled = busy || !hid;
  const action = session?.arm ? "Retry live lightbar" : "Connect for live colors";
  if (connect.textContent !== action) connect.textContent = action;
  const message = !hid ? "Open in Edge or Chrome to connect your keyboard." : !session ?
    "Connect your keyboard to see its live colors above the arrow keys." : liveLightbar ?
      "The strip above the arrow keys is showing your keyboard’s live colors." : !session.arm ?
        "Connect the keyboard interface to read the lightbar. The analog interface only sends key travel." :
        liveLightbar === undefined ? "Waiting for live colors from your keyboard." : "The keyboard hasn’t supplied live colors. Try reading it again.";
  const liveStatus = el("lightbar-live-status");
  if (liveStatus.textContent !== message) liveStatus.textContent = message;
  if (session) {
    strip.dataset.mode = liveLightbar ? "live" : "waiting";
    for (const [index, segment] of [...strip.children].entries()) {
      segment.style.setProperty("--segment-color", liveLightbar?.[index] ?? "#344249");
    }
  } else {
    paintLightbarPreview(strip, bar);
  }
  if (!draftRow.hidden) paintLightbarPreview(el("lightbar-draft"), bar);
}

function paintLightbarPreview(strip, bar) {
  strip.dataset.mode = bar.enabled ? bar.mode : "off";
  strip.style.setProperty("--bar-level", `${bar.linked ? draft.lighting.brightness : bar.brightness}%`);
  strip.style.setProperty("--pulse-color", bar.secondary);
  strip.style.setProperty("--pulse-time", `${bar.duration}ms`);
  for (const [index, segment] of [...strip.children].entries()) {
    const color = bar.mode === "segments" ? bar.segments[index] : bar.color;
    segment.style.setProperty("--segment-color", color);
  }
}

function lightbarControls() {
  const mode = el("lightbar-mode").value;
  el("lightbar-color-label").hidden = !["solid", "pulse"].includes(mode);
  el("lightbar-secondary-label").hidden = mode !== "pulse";
  el("lightbar-duration-label").hidden = mode !== "pulse";
  el("lightbar-segment-colors").hidden = mode !== "segments";
  el("lightbar-brightness-label").hidden = el("lightbar-linked").checked;
  const level = `${el("lightbar-brightness").value}%`;
  el("lightbar-brightness").style.setProperty("--progress", level);
  setText("lightbar-level", level);
}

function lightbarInputs() {
  const bar = draft.lightbar;
  if (!bar) return;
  for (const key of ["enabled", "linked", "inherit"]) el(`lightbar-${key}`).checked = bar[key];
  for (const key of ["mode", "color", "secondary", "brightness"]) el(`lightbar-${key}`).value = bar[key];
  el("lightbar-duration").value = bar.duration / 1000;
  for (const [index, input] of segmentInputs.entries()) input.value = bar.segments[index];
  lightbarControls();
}

on("lightbar-mode", "change", lightbarControls);
on("lightbar-linked", "change", lightbarControls);
on("lightbar-brightness", "input", lightbarControls);
on("stage-lightbar", "click", () => run(() => {
  const next = {
    enabled: el("lightbar-enabled").checked,
    linked: el("lightbar-linked").checked,
    brightness: Number(el("lightbar-brightness").value),
    inherit: el("lightbar-inherit").checked,
    mode: el("lightbar-mode").value,
    color: el("lightbar-color").value,
    secondary: el("lightbar-secondary").value,
    duration: Math.round(el("lightbar-duration").valueAsNumber * 1000),
    segments: segmentInputs.map(input => input.value),
  };
  if (!validLightbar(next)) throw new Error("Set a pulse interval between 0.1 and 20 seconds.");
  stage(profile => { profile.lightbar = next; });
}));

const dusk = ["#54278f", "#6440b5", "#7d46bc", "#a253b9", "#c75ca5", "#e26d93", "#f58486", "#fa9d79", "#ffb578", "#ffd08c"];
for (const button of document.querySelectorAll("[data-bar-recipe]")) button.addEventListener("click", () => {
  if (busy || !canEditLightbar()) return;
  const palette = selected.size ? keys.filter(key => selected.has(key.id)) : keys.filter(key => key.row === 1);
  const sample = palette.map(key => draft.colors[key.row][key.col]);
  const recipe = button.dataset.barRecipe;
  const colors = recipe === "dusk" ? dusk : Array.from({ length: lightbarLength }, (_, index) => recipe === "contrast" ?
    ["#57e3d0", "#6f7eff"][index % 2] : sample[Math.round(index * (sample.length - 1) / (lightbarLength - 1))]);
  stage(profile => {
    profile.lightbar = { ...profile.lightbar, enabled: true, mode: "segments", segments: [...colors] };
  });
  lightbarInputs();
});

on("select-tool", "click", () => { brush = false; update(); });
on("brush-tool", "click", () => { brush = true; update(); });

function brushPoint(x, y) {
  const button = document.elementFromPoint(x, y)?.closest("[data-key]");
  if (!button) return;
  const id = Number(button?.dataset.key);
  if (buttons.get(id) !== button || gesture.keys.has(id)) return;
  gesture.keys.add(id);
  button.style.setProperty("--paint", gesture.color);
}

on("key-stage", "pointerdown", event => {
  if (busy || event.button !== 0 || !event.isPrimary) return;
  const painting = tab === "colors" && brush;
  if (!painting && event.pointerType !== "mouse") return;
  gesture = {
    pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false, painting,
    lastX: event.clientX, lastY: event.clientY, color: el("color").value, keys: new Set(),
    before: new Set(selected), additive: event.shiftKey,
  };
  if (painting) brushPoint(event.clientX, event.clientY);
});

window.addEventListener("pointermove", event => {
  if (!gesture || event.pointerId !== gesture.pointer) return;
  const { clientX: x, clientY: y } = event;
  if (gesture.painting) {
    const dx = x - gesture.lastX;
    const dy = y - gesture.lastY;
    const samples = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    for (let point = 1; point <= samples; point++) {
      brushPoint(gesture.lastX + dx * point / samples, gesture.lastY + dy * point / samples);
    }
    gesture.lastX = x;
    gesture.lastY = y;
    return;
  }
  if (!gesture.moved && Math.hypot(x - gesture.x, y - gesture.y) < 6) return;
  gesture.moved = true;
  const left = Math.min(x, gesture.x);
  const right = Math.max(x, gesture.x);
  const top = Math.min(y, gesture.y);
  const bottom = Math.max(y, gesture.y);
  const bounds = el("key-stage").getBoundingClientRect();
  const outline = el("marquee");
  outline.hidden = false;
  outline.style.left = `${left - bounds.left}px`;
  outline.style.top = `${top - bounds.top}px`;
  outline.style.width = `${right - left}px`;
  outline.style.height = `${bottom - top}px`;
  el("key-stage").classList.add("dragging");
  const ids = gesture.additive ? new Set(gesture.before) : new Set();
  for (const [id, button] of buttons) {
    const key = button.getBoundingClientRect();
    if (key.left < right && key.right > left && key.top < bottom && key.bottom > top) ids.add(id);
  }
  select(ids);
});

function finishGesture(cancelled) {
  if (!gesture) return;
  const completed = gesture;
  gesture = undefined;
  el("marquee").hidden = true;
  el("key-stage").classList.remove("dragging");
  if (cancelled) {
    select(completed.before);
    return;
  }
  if (completed.painting || completed.moved) {
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
  }
  if (completed.painting) paint(keys.filter(key => completed.keys.has(key.id)), completed.color);
}
window.addEventListener("pointerup", event => {
  if (event.pointerId === gesture?.pointer) finishGesture(false);
});
window.addEventListener("pointercancel", event => {
  if (event.pointerId === gesture?.pointer) finishGesture(true);
});
window.addEventListener("blur", () => finishGesture(true));
on("workspace", "keydown", event => {
  if (event.target.matches("input, select, textarea") || el("confirm").open) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    event.preventDefault();
    select(keys.map(key => key.id));
  } else if (event.key === "Escape" && (gesture || selected.size)) {
    if (gesture) finishGesture(true);
    else select([]);
  }
});

const bindingOptions = options => options.map(key => new Option(key.label, key.value));
el("binding").replaceChildren(...bindingOptions(keyOptions));
on("binding-search", "input", event => {
  const query = event.target.value.trim().toLowerCase();
  el("binding").replaceChildren(...bindingOptions(keyOptions.filter(key => `${key.label} ${key.code}`.toLowerCase().includes(query))));
  update();
});
on("capture", "click", () => {
  captureBinding = !captureBinding;
  setText("capture", captureBinding ? "Press a key · Esc to cancel" : "Capture keystroke");
});
window.addEventListener("keydown", event => {
  if (!captureBinding || tab !== "map") return;
  event.preventDefault();
  event.stopPropagation();
  captureBinding = false;
  setText("capture", "Capture keystroke");
  if (event.code === "Escape") return;
  const key = codes.get(event.code);
  if (!key || !keyOptions.includes(key)) return status("This keystroke has no known binding code.");
  el("binding-search").value = "";
  el("binding").replaceChildren(...bindingOptions(keyOptions));
  el("binding").value = key.value;
  status(`Captured ${key.label}. Select the physical keys to assign it to.`);
  update();
}, true);
on("stage-map", "click", () => stage(profile => {
  for (const key of keys.filter(key => selected.has(key.id))) {
    profile.map[key.row][key.col] = Number(el("binding").value);
  }
}));

const pointNames = ["First press", "Bottom out", "Start release", "Full release"];
const dksBindings = [];
const dksActions = [];
for (let binding = 0; binding < 4; binding++) {
  const lane = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = `Binding ${binding + 1}`;
  lane.append(legend);
  const choice = document.createElement("select");
  choice.setAttribute("aria-label", legend.textContent);
  choice.replaceChildren(...bindingOptions(keyOptions));
  choice.value = 255;
  dksBindings.push(choice);
  lane.append(choice);
  dksActions.push(pointNames.map(point => {
    const label = document.createElement("label");
    label.textContent = point;
    const select = document.createElement("select");
    select.setAttribute("aria-label", `${legend.textContent} · ${point}`);
    select.replaceChildren(...["Hold", "Down", "Up", "Single"].map((name, index) => new Option(name, index)));
    label.append(select);
    lane.append(label);
    return select;
  }));
  el("dks-editor").append(lane);
}
el("action-primary").replaceChildren(...bindingOptions(keyOptions));
el("action-secondary").replaceChildren(...bindingOptions(keyOptions));
const singleKey = () => selected.size === 1 ? keys.find(key => selected.has(key.id)) : undefined;
function actionInputs(action) {
  const kind = el("advanced-kind").value;
  const pair = kind === "rappy" || kind === "socd";
  el("dks-editor").hidden = kind !== "dks";
  el("action-primary-label").hidden = kind !== "mod-tap" && kind !== "toggle";
  setText("action-primary-title", kind === "mod-tap" ? "Tap binding" : "Toggle binding");
  el("action-secondary-label").hidden = kind !== "mod-tap";
  el("action-pair-label").hidden = !pair;
  el("action-mode-label").hidden = !pair && kind !== "mod-tap";
  el("action-bottom-label").hidden = kind !== "socd";
  setText("action-mode-title", pair ? "Input priority" : "Early activation");
  const modes = pair ? ["Both inputs", "Neither input", "First key", "Paired key", "Last input"] :
    ["Hold for modifiers", "Wait for release", "Prefer hold", "Prefer tap"];
  el("action-mode").replaceChildren(...modes.map((label, index) => new Option(label, index)));
  el("action-mode").value = action?.mode ?? (kind === "socd" ? 4 : 0);
  el("action-primary").value = action?.primary ?? singleKey()?.value ?? 255;
  el("action-secondary").value = kind === "mod-tap" ? action?.secondary ?? 0x63 : 255;
  el("action-bottom").checked = action?.bottom ?? false;
  el("action-pair").replaceChildren(new Option("Choose another key", ""), ...keys.filter(key => key !== singleKey())
    .map(key => new Option(key.label, key.id)));
  if (pair) el("action-pair").value = action?.secondary ?? "";
  if (kind === "dks") {
    for (const [binding, select] of dksBindings.entries()) {
      select.value = action?.keys[binding] ?? 255;
      for (const [point, cell] of dksActions[binding].entries()) {
        cell.value = action ? ((action.actions[point] ?? 0) >>> (binding * 2)) & 3 : [1, 0, 0, 2][point];
      }
    }
  }
}
function syncSelection() {
  tuneInputs();
  const key = singleKey();
  const action = key && draft.advanced[scope(key)];
  el("advanced-kind").value = action?.kind || "dks";
  actionInputs(action);
}
function renderAdvanced() {
  const key = singleKey();
  setText("advanced-target", key ? `${key.label} · ${draft.layer ? `Fn ${draft.layer}` : "Base"}` : "Select one key");
  setText("advanced-hint", canEditAdvanced() ? "Select one physical key to create or replace an action on this layer." :
    "Onboard action editing is available in supported first slots. Open that slot to edit its actions.");
  el("stage-advanced").disabled = busy || !key || !canEditAdvanced();
  el("remove-advanced").disabled = busy || !key || !canEditAdvanced() || !draft.advanced[scope(key)];
  const actions = keys.filter(key => draft.advanced[scope(key)]);
  el("advanced-list").replaceChildren(...(actions.length ? actions : [null]).map(key => {
    const item = document.createElement("li");
    if (!key) item.textContent = "No actions on this layer.";
    else {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${key.label} · ${advancedLabel(draft.advanced[scope(key)].kind)}`;
      button.addEventListener("click", () => select([key.id]));
      item.append(button);
    }
    return item;
  }));
}
on("advanced-kind", "change", () => actionInputs());
on("stage-advanced", "click", () => run(() => {
  const key = singleKey();
  const kind = el("advanced-kind").value;
  const action = { kind };
  if (kind === "dks") {
    action.keys = dksBindings.map(select => Number(select.value));
    if (action.keys.every(value => value === 255)) throw new Error("Add at least one DKS binding.");
    action.actions = pointNames.map((_, point) => dksActions.reduce((bits, lane, index) => bits | (Number(lane[point].value) << (2 * index)), 0));
  } else if (kind === "mod-tap" || kind === "toggle") {
    action.primary = Number(el("action-primary").value);
    if (kind === "mod-tap") {
      action.secondary = Number(el("action-secondary").value);
      action.mode = Number(el("action-mode").value);
    }
  } else {
    if (!el("action-pair").value) throw new Error("Choose another physical key for this pair.");
    action.secondary = Number(el("action-pair").value);
    action.mode = Number(el("action-mode").value);
    if (kind === "socd") action.bottom = el("action-bottom").checked;
  }
  stage(profile => { profile.advanced[scope(key)] = action; });
}));
on("remove-advanced", "click", () => {
  stage(profile => { delete profile.advanced[scope(singleKey())]; });
  syncSelection();
});

function renderCapabilities() {
  const model = getModel(family);
  setText("capability-model", model.name);
  const details = [
    ["Layout", variant], ["Switch technology", model.tech || "Hall effect"],
    ["Profiles", onboard() ? "Onboard read and verified save" : "Local editing and presets"],
    ["Live RGB", model.rgb === false ? "This model has no RGB" : session?.previewAvailable ? "Static preview available" : "Requires a compatible HID interface"],
    ...(model.lightbar ? [["Lightbar", onboard() && draft.lightbarEditing ? "Editable onboard profile" : "Local editor preview"]] : []),
    ["Analog travel", session?.analogDevice ? "Live input available" : session ? "Analog interface unavailable" : "Simulated in demo"],
  ];
  if (session?.profileError) details.push(["Profile read", session.profileError]);
  el("device-capabilities").replaceChildren(...details.flatMap(([title, description]) => {
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = title;
    detail.textContent = description;
    return [term, detail];
  }));
}

on("clear-peak", "click", clearHistory);
on("export-peaks", "click", () => {
  const csvCell = text => '"' + (/^[=+\-@]/.test(text) ? "'" : "") + text.replaceAll('"', '""') + '"';
  const rows = [["key", "matrix_index", "hid_usage", "peak_percent", "peak_mm"]];
  for (const reading of peaks.values()) {
    if (selected.size && !selected.has(readingKey(reading)?.id)) continue;
    const travel = session ? session.travel?.get(reading.index) : 4;
    rows.push([csvCell(readingName(reading)), reading.index ?? "", reading.usage ?? "", (reading.fraction * 100).toFixed(2),
      travel === undefined ? "" : (reading.fraction * travel).toFixed(3)]);
  }
  const url = URL.createObjectURL(new Blob([rows.map(row => row.join(",")).join("\r\n")], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "openwootility-switch-peaks.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

on("monitor-toggle", "click", () => run(async () => {
  if (monitoring) {
    await stopMonitor();
    setText("monitor-hint", "Analog monitor stopped.");
    return;
  }
  if (session) monitorStop = await session.startMonitor(showTravel);
  monitoring = true;
  setText("monitor-hint", session ? ([...session.travel.values()].some(travel => travel !== undefined) ?
    "Live travel uses the keyboard’s switch and spacer settings. A highlighted outline marks actuation." :
    "Live readings use percent of the sensor range. Millimeters require switch calibration data.") :
    "Demo input. Press and release a key to see simulated full travel.");
}));
function demoKey(event, pressed) {
  if (!monitoring || session || tab !== "monitor") return;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  const key = keys.find(item => item.code === event.code);
  if (!key) return;
  if (pressed) monitorValues.set(key.id, { index: key.id, fraction: 1, actuated: true });
  else monitorValues.delete(key.id);
  showTravel(monitorValues);
}
window.addEventListener("keydown", event => demoKey(event, true));
window.addEventListener("keyup", event => demoKey(event, false));
window.addEventListener("blur", () => { if (!session) showTravel(new Map()); });

function presetData(name) {
  return { schema: 1, name, family, variant, layer: draft.layer,
    ...Object.fromEntries(workFields.map(key => [key, copy(draft[key])])) };
}

function loadPreset(preset) {
  const distance = value => typeof value === "number" && value >= 0 && value <= 4;
  const object = value => value && typeof value === "object" && !Array.isArray(value);
  const matrix = (rows, valid) => Array.isArray(rows) && rows.length === 6 &&
    rows.every(row => Array.isArray(row) && row.length === 21 && row.every(valid));
  const known = new Set(keys.map(key => String(key.id)));
  const byte = value => Number.isInteger(value) && value >= 0 && value < 256;
  const validLighting = value => object(value) && el("lighting-effect").querySelector(`option[value="${CSS.escape(String(value.effect))}"]`) &&
    Number.isInteger(value.brightness) && value.brightness >= 0 && value.brightness <= 100 &&
    Number.isInteger(value.speed) && value.speed >= (value.effect === "spiral" ? -255 : 0) && value.speed <= 255 &&
    (value.clearEffects === undefined || typeof value.clearEffects === "boolean" && (!value.clearEffects || value.effect === "static")) &&
    (value.indicators === undefined || object(value.indicators) && Object.entries(value.indicators).every(([name, color]) =>
      ["caps", "fn", "scroll", "num"].includes(name) && Number.isInteger(color) && color >= 0 && color <= 65535));
  const validAdvanced = value => object(value) && Object.entries(value).every(([index, action]) => {
    const [layer, key, ...rest] = index.split("/");
    if (rest.length || !/^[0-3]$/.test(layer) || !known.has(key) || !object(action)) return false;
    const mode = max => Number.isInteger(action.mode) && action.mode >= 0 && action.mode <= max;
    const fourBytes = items => Array.isArray(items) && items.length === 4 && items.every(byte);
    switch (action.kind) {
      case "dks": return fourBytes(action.keys) && fourBytes(action.actions);
      case "mod-tap": return byte(action.primary) && byte(action.secondary) && mode(3);
      case "toggle": return byte(action.primary);
      case "rappy":
      case "socd": return String(action.secondary) !== key && known.has(String(action.secondary)) && mode(4) &&
        (action.kind !== "socd" || typeof action.bottom === "boolean");
      default: return false;
    }
  });
  if (!preset || preset.schema !== 1 || preset.family !== family || (preset.variant || "ANSI") !== variant || preset.layer !== draft.layer ||
      !distance(preset.tune?.actuation) || !distance(preset.tune?.sensitivity) || typeof preset.tune?.enabled !== "boolean" ||
      (preset.tune.secondary !== undefined && !distance(preset.tune.secondary)) ||
      !object(preset.actuation) || !Object.entries(preset.actuation).every(([key, value]) => known.has(key) && distance(value)) ||
      !object(preset.rapid) || !Object.entries(preset.rapid).every(([key, value]) => known.has(key) && object(value) &&
        (value.off === true || (distance(value.sensitivity) && typeof value.continuous === "boolean" &&
          (value.secondary === undefined || distance(value.secondary))))) ||
      !matrix(preset.colors, value => typeof value === "string" && /^#[a-f0-9]{6}$/i.test(value)) ||
      (preset.map !== null && !matrix(preset.map, byte)) || (preset.lighting !== undefined && !validLighting(preset.lighting)) ||
      (preset.advanced !== undefined && !validAdvanced(preset.advanced)) ||
      (preset.lightbar !== undefined && preset.lightbar !== null && !validLightbar(preset.lightbar))) {
    throw new Error("This preset does not match the current layout or layer.");
  }
  stage(profile => {
    for (const key of workFields) {
      if (key === "map" && (profile.sharedMap || !profile.map || !preset.map)) continue;
      if ((key === "advanced" && !canEditAdvanced()) || (key === "lighting" && !canEditLighting()) ||
          (key === "colors" && !rgbAvailable()) || (key === "lightbar" && (!canEditLightbar() || !preset.lightbar))) continue;
      if (preset[key] === undefined) continue;
      profile[key] = copy(preset[key]);
    }
  });
  syncSelection();
  lightingInputs();
  lightbarInputs();
}

function showPresets() {
  el("presets").replaceChildren(...presets.map((preset, index) => new Option(preset.name, index)));
  update();
}
function storePresets(next) {
  localStorage.setItem(storageKey, JSON.stringify(next));
  presets = next;
  showPresets();
}
on("save-preset", "click", () => run(() => {
  const name = el("preset-name").value.trim();
  if (!name) throw new Error("Enter a name for this preset.");
  const next = presets.filter(preset => preset.name !== name);
  storePresets([...next, presetData(name)]);
  status(`Local preset saved as “${name}”.`);
}));
on("load-preset", "click", () => run(() => loadPreset(presets[Number(el("presets").value)])));
on("delete-preset", "click", () => run(() => {
  storePresets(presets.filter((_, index) => index !== Number(el("presets").value)));
  status("Local preset removed.");
}));
on("export", "click", () => {
  const data = presetData(el("preset-name").value.trim() || "Keyboard profile");
  const link = document.createElement("a");
  link.download = "openwootility-profile.json";
  link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
on("import", "change", event => run(async () => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 128_000) throw new Error("That profile file is too large.");
  loadPreset(JSON.parse(await file.text()));
}));

on("undo", "click", () => moveHistory(undo, redo));
on("redo", "click", () => moveHistory(redo, undo));
on("discard", "click", () => {
  replaceProfile(original);
  status("Pending edits discarded.");
});
on("review", "click", () => {
  const dialog = el("confirm");
  dialog.returnValue = "cancel";
  setText("confirm-title", `Save slot ${draft.slot + 1}?`);
  setText("confirm-detail", onboard() ?
    "These sections will be written to the active keyboard profile and checked by reading them back." :
    "These sections will be saved to this browser’s workspace.");
  el("confirm-list").replaceChildren(...dirty().map(key => {
    const item = document.createElement("li");
    item.textContent = groupLabels[key];
    return item;
  }));
  dialog.showModal();
});
on("confirm", "close", () => {
  if (el("confirm").returnValue !== "save") return;
  void run(async () => {
    const groups = dirty();
    if (onboard()) {
      if (draft.slot !== profiles.active) throw new Error("Activate the edited slot before saving.");
      const verified = await session.save(original, draft, groups);
      replaceProfile(verified);
      status("Saved to the active profile. Changed sections matched keyboard read-back.");
      return;
    }
    const index = slotKey(draft.slot);
    const { map, layer, ...profile } = draft;
    const maps = { ...localSlot(draft.slot)?.maps, [layer]: map };
    const saved = { profile, maps };
    localStorage.setItem(`openwootility.slot.${index}`, JSON.stringify(saved));
    demoSlots.set(index, copy(saved));
    replaceProfile(draft);
    status("Saved to the local workspace profile.");
  });
});

el("demo-model").replaceChildren(...models.map(model => new Option(model.name, model.id)));
el("demo-model").value = family;
setLayouts(getModel(family), variant);
el("model-library").replaceChildren(...models.map(model => {
  const item = document.createElement("li");
  item.textContent = `${model.name} · ${model.layouts.join(" / ")}`;
  return item;
}));
buildBoard();
replaceProfile(demoProfile(0, 0));
chooseColor(el("color").value);
showPresets();
if (!hid) status("Demo mode. Use Edge or Chrome to connect to a physical keyboard.");
else {
  let reconnect = true;
  try { reconnect = localStorage.getItem(connectionPreference) !== "off"; }
  catch { /* Previously granted devices are still available. */ }
  if (reconnect) void run(async () => {
    const connected = await connectKeyboard(hid, { reuse: true });
    if (connected) await openConnectedKeyboard(connected);
  });
}
setTimeout(() => {
  el("loading").hidden = true;
  el("studio").hidden = false;
}, 500);
