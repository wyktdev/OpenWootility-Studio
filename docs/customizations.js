import { blobs, field, integer, join, replaceField } from "./proto.js";

const empty = new Uint8Array();
const effects = new Map([["wave", 1], ["scan", 2], ["breath", 3], ["cycle", 4], ["noise", 14], ["spiral", 15]]);
const effectSpeedField = id => id === 3 ? 1 : id >= 14 ? 3 : 2;
const effectDefaults = {
  1: [[1, 0], [3, 0]], 2: [[1, 1], [3, 30], [4, 0]], 3: [[3, 0]], 4: [[1, 0]],
  14: [[1, 0x181f], [2, 0x07e1], [4, 25]], 15: [[1, 0xf81f], [2, 0x07ff], [4, 100]],
};
const kinds = new Map([["dks", 1], ["mod-tap", 2], ["toggle", 3], ["rappy", 4], ["socd", 5]]);

export function lightingSettings(data) {
  const [base = empty] = blobs(data, 1);
  const [stack = empty] = blobs(data, 4);
  const settings = { brightness: Math.round((integer(base, 1) ?? 255) * 100 / 255), effect: "static", speed: 16,
    effectLayers: blobs(stack, 1).length };
  const indicators = Object.fromEntries([["caps", 2], ["fn", 3], ["scroll", 4], ["num", 5]]
    .map(([name, field]) => [name, integer(base, field)]).filter(([, color]) => color !== undefined && color <= 65535));
  if (Object.keys(indicators).length) settings.indicators = indicators;
  for (const layer of blobs(stack, 1)) {
    for (const [effect, id] of effects) {
      const [config] = blobs(layer, id);
      if (config) {
        const speed = integer(config, effectSpeedField(id));
        return { ...settings, effect, speed: speed === undefined ? 16 : id === 15 ? (speed >>> 1) ^ -(speed & 1) : speed };
      }
    }
  }
  return settings;
}

export function patchLighting(data, settings, before) {
  const [base] = blobs(data, 1);
  if (!base) throw new Error("The keyboard did not provide its lighting settings.");
  let editedBase = base;
  if (settings.brightness !== before.brightness) {
    editedBase = replaceField(editedBase, 1, [Math.round(settings.brightness * 255 / 100)]);
  }
  for (const [name, field] of [["caps", 2], ["fn", 3], ["scroll", 4], ["num", 5]]) {
    const color = settings.indicators?.[name];
    if (color !== undefined && color !== before.indicators?.[name]) editedBase = replaceField(editedBase, field, [color]);
  }
  const updated = editedBase === base ? data : replaceField(data, 1, [editedBase]);
  if (settings.clearEffects) {
    const [stack = empty] = blobs(data, 4);
    const cleared = replaceField(stack, 1, []);
    return replaceField(updated, 4, cleared.length ? [cleared] : []);
  }
  if (settings.effect === before.effect && settings.speed === before.speed) return updated;
  const [stack = empty] = blobs(data, 4);
  const layers = blobs(stack, 1);
  const currentIndex = layers.findIndex(layer => [...effects.values()].some(id => blobs(layer, id).length));
  const id = effects.get(settings.effect);
  if (!id && currentIndex < 0) return updated;
  if (!id) layers.splice(currentIndex, 1);
  else {
    const current = currentIndex < 0 ? null : blobs(layers[currentIndex], id)[0];
    const speed = id === 15 ? (settings.speed << 1) ^ (settings.speed >> 31) : settings.speed;
    const defaults = join(effectDefaults[id].map(([key, value]) => field(key, value)));
    const payload = replaceField(current || defaults, effectSpeedField(id), [speed]);
    const layer = current ? replaceField(layers[currentIndex], id, [payload]) : field(id, payload);
    if (currentIndex < 0) layers.unshift(layer);
    else layers[currentIndex] = layer;
  }
  return replaceField(updated, 4, [replaceField(stack, 1, layers)]);
}

function keyOf(item) {
  const key = integer(item, 8);
  return key === undefined ? null : `${integer(item, 9) ?? 0}/${key}`;
}

export function advancedSettings(data) {
  const result = {};
  for (const item of blobs(data, 1)) {
    const key = keyOf(item);
    if (!key) continue;
    for (const [kind, id] of kinds) {
      const [config] = blobs(item, id);
      if (!config) continue;
      if (kind === "dks") {
        result[key] = { kind, keys: [...(blobs(config, 1)[0] || [])], actions: [...(blobs(config, 2)[0] || [])] };
      } else if (kind === "mod-tap") {
        result[key] = { kind, primary: integer(config, 1) ?? 255, secondary: integer(config, 2) ?? 255,
          mode: integer(config, 4) ?? 0 };
      } else if (kind === "toggle") {
        result[key] = { kind, primary: integer(config, 1) ?? 255 };
      } else {
        result[key] = { kind, secondary: integer(config, 1) ?? 0, mode: integer(config, 2) ?? 0,
          ...(kind === "socd" ? { bottom: integer(config, 3) === 1 } : {}) };
      }
      break;
    }
  }
  return result;
}

function encodeAdvanced(key, value, old = empty) {
  const id = kinds.get(value.kind);
  let config = blobs(old, id)[0] || empty;
  if (value.kind === "dks") {
    config = replaceField(config, 1, [Uint8Array.from(value.keys)]);
    config = replaceField(config, 2, [Uint8Array.from(value.actions)]);
  } else if (value.kind === "mod-tap") {
    config = replaceField(config, 1, [value.primary]);
    config = replaceField(config, 2, [value.secondary]);
    config = replaceField(config, 4, [value.mode]);
  } else if (value.kind === "toggle") {
    config = replaceField(config, 1, [value.primary]);
  } else {
    config = replaceField(config, 1, [value.secondary]);
    config = replaceField(config, 2, [value.mode]);
    if (value.kind === "socd") config = replaceField(config, 3, [Number(value.bottom)]);
  }
  let item = old;
  for (const candidate of kinds.values()) if (candidate !== id) item = replaceField(item, candidate, []);
  const [layer, keyIndex] = key.split("/").map(Number);
  item = replaceField(item, 8, [keyIndex]);
  item = replaceField(item, 9, [layer]);
  return replaceField(item, id, [config]);
}

export function patchAdvanced(data, before, after) {
  const items = blobs(data, 1);
  const total = integer(data, 3) ?? items.length;
  if (total > items.length) throw new Error("This profile’s advanced bindings span several reports.");
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    const index = items.findIndex(item => keyOf(item) === key);
    if (index >= 0 && items.findLastIndex(item => keyOf(item) === key) !== index) {
      throw new Error("This key has multiple existing actions. Edit it in Wootility.");
    }
    if (after[key]) {
      const updated = encodeAdvanced(key, after[key], items[index]);
      if (index < 0) items.push(updated);
      else items[index] = updated;
    } else if (index >= 0) items.splice(index, 1);
  }
  return replaceField(replaceField(replaceField(data, 1, items), 2, [0]), 3, [items.length]);
}

export const advancedLabel = kind => ({ dks: "Dynamic Keystroke", "mod-tap": "Mod Tap", toggle: "Toggle Key",
  rappy: "Rappy Snappy", socd: "Snappy Tappy" })[kind];
