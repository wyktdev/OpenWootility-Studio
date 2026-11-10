import { blobs, field, integer, join, replaceField } from "./proto.js";

export const lightbarLength = 10;
const modes = new Map([[5, "pulse"], [6, "solid"], [7, "segments"]]);
const canvas = join([field(1, 0), field(2, lightbarLength - 1)]);
const colorPattern = /^#[0-9a-f]{6}$/i;
const defaultColor = "#a5ecd6";
const isColor = value => typeof value === "string" && colorPattern.test(value);

export function decodeLightbarColors(data) {
  const leds = blobs(data, 1);
  if (leds.length !== lightbarLength) throw new Error("The keyboard did not report all ten lightbar colors.");
  return leds.map(led => {
    const channels = [1, 2, 3].map(channel => integer(led, channel) ?? 0);
    if (channels.some(value => value > 255)) throw new Error("The keyboard returned an invalid lightbar color.");
    return "#" + channels.map(value => value.toString(16).padStart(2, "0")).join("");
  });
}

export function defaultLightbar() {
  return { enabled: true, linked: true, brightness: 100, inherit: true, mode: "existing", color: defaultColor,
    secondary: "#203c54", duration: 1800, segments: Array(lightbarLength).fill(defaultColor) };
}

export function validLightbar(value) {
  return value && typeof value.enabled === "boolean" && typeof value.linked === "boolean" && typeof value.inherit === "boolean" &&
    Number.isInteger(value.brightness) && value.brightness >= 0 && value.brightness <= 100 &&
    ["existing", ...modes.values()].includes(value.mode) && isColor(value.color) && isColor(value.secondary) &&
    Number.isInteger(value.duration) && value.duration >= 100 && value.duration <= 20_000 &&
    Array.isArray(value.segments) && value.segments.length === lightbarLength && value.segments.every(isColor);
}

function baseLayer(layer) {
  if (blobs(layer, 1).length) return null;
  for (const [kind, mode] of modes) {
    const [effect] = blobs(layer, kind);
    if (!effect) continue;
    const [area] = blobs(effect, kind === 5 ? 5 : 2);
    if ((area && (integer(area, 1) ?? 0) === 0 && integer(area, 2) === lightbarLength - 1) || (kind === 7 && !area)) {
      return { kind, mode, effect };
    }
  }
  return null;
}

export function readLightbar(data, colorHex) {
  const state = defaultLightbar();
  if (!data.length) return state;
  const brightness = integer(data, 4);
  state.enabled = integer(data, 1) === 1;
  state.inherit = integer(data, 3) === 1;
  state.linked = brightness === undefined;
  state.brightness = brightness === undefined ? 100 : Math.round(Math.min(brightness, 255) * 100 / 255);
  const base = blobs(data, 2).map(baseLayer).filter(Boolean).at(-1);
  if (!base) return state;
  if (base.kind === 7) {
    const [rgb] = blobs(base.effect, 1);
    if (rgb?.length !== lightbarLength * 3) return state;
    state.segments = Array.from({ length: lightbarLength }, (_, i) => "#" + [...rgb.slice(i * 3, i * 3 + 3)]
      .map(value => value.toString(16).padStart(2, "0")).join(""));
  } else {
    state.color = colorHex(integer(base.effect, 1) ?? 0);
    state.segments.fill(state.color);
    if (base.kind === 5) {
      state.secondary = colorHex(integer(base.effect, 2) ?? 0);
      state.duration = integer(base.effect, 3) || state.duration;
    }
  }
  state.mode = base.mode;
  return state;
}

export function lightbarFingerprint(data, colorHex) {
  const layers = blobs(data, 2);
  const editable = layers.findLastIndex(layer => baseLayer(layer));
  return { settings: readLightbar(data, colorHex), preserved: layers.filter((_, index) => index !== editable) };
}

export function patchLightbar(data, before, after, colorWord) {
  if (!validLightbar(after)) throw new Error("Invalid lightbar settings.");
  let payload = data;
  if (!data.length || before.enabled !== after.enabled) payload = replaceField(payload, 1, [Number(after.enabled)]);
  if (!data.length || before.inherit !== after.inherit) payload = replaceField(payload, 3, [Number(after.inherit)]);
  if (before.linked !== after.linked || (!after.linked && before.brightness !== after.brightness)) {
    payload = replaceField(payload, 4, after.linked ? [] : [Math.round(after.brightness * 255 / 100)]);
  }
  const changed = before.mode !== after.mode || (after.mode === "segments" ? before.segments.some((color, i) => color !== after.segments[i]) :
    after.mode !== "existing" && (before.color !== after.color || (after.mode === "pulse" &&
      (before.secondary !== after.secondary || before.duration !== after.duration))));
  if (!changed) return payload;

  const layers = blobs(data, 2);
  const index = layers.findLastIndex(layer => baseLayer(layer));
  if (after.mode === "existing") {
    if (index >= 0) layers.splice(index, 1);
  } else {
    const kind = [...modes].find(([, mode]) => mode === after.mode)[0];
    const prior = index >= 0 ? baseLayer(layers[index]) : null;
    let effect = prior?.kind === kind ? prior.effect : new Uint8Array();
    if (kind === 7) {
      const colors = Uint8Array.from(after.segments.flatMap(hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16))));
      effect = replaceField(effect, 1, [colors]);
    } else {
      effect = replaceField(effect, 1, [colorWord(after.color)]);
      if (kind === 5) {
        effect = replaceField(effect, 2, [colorWord(after.secondary)]);
        effect = replaceField(effect, 3, [after.duration]);
      }
    }
    effect = replaceField(effect, kind === 5 ? 5 : 2, [canvas]);
    if (index < 0) layers.unshift(field(kind, effect));
    else if (prior.kind === kind) layers[index] = replaceField(layers[index], kind, [effect]);
    else layers[index] = replaceField(replaceField(layers[index], prior.kind, []), kind, [effect]);
  }
  return replaceField(payload, 2, layers);
}
