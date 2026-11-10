import { getModel } from "./models.js";
import { defaultLightbar } from "./lightbar.js";

const mappings = [
  ...Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ", (letter, index) => [`Key${letter}`, letter, index + 1, index + 4]),
  ...Array.from("1234567890", (number, index) => [`Digit${number}`, number, 27 + index, 30 + index]),
  ...Array.from({ length: 12 }, (_, index) => [`F${index + 1}`, `F${index + 1}`, 55 + index, 58 + index]),
  ["Enter", "Enter", 0x25, 0x28], ["Escape", "Esc", 0x26, 0x29],
  ["Backspace", "Backspace", 0x27, 0x2a], ["Tab", "Tab", 0x28, 0x2b], ["Space", "Space", 0x29, 0x2c],
  ["Minus", "-", 0x2a, 0x2d], ["Equal", "=", 0x2b, 0x2e], ["BracketLeft", "[", 0x2c, 0x2f],
  ["BracketRight", "]", 0x2d, 0x30], ["Backslash", "\\", 0x2e, 0x31], ["Semicolon", ";", 0x30, 0x33],
  ["Quote", "'", 0x31, 0x34], ["Backquote", "`", 0x32, 0x35], ["Comma", ",", 0x33, 0x36],
  ["Period", ".", 0x34, 0x37], ["Slash", "/", 0x35, 0x38], ["CapsLock", "Caps", 0x36, 0x39],
  ["PrintScreen", "PrtSc", 0x43, 0x46], ["Pause", "Pause", 0x45, 0x48],
  ["Insert", "Ins", 0x46, 0x49], ["Home", "Home", 0x47, 0x4a], ["PageUp", "PgUp", 0x48, 0x4b],
  ["Delete", "Del", 0x49, 0x4c], ["End", "End", 0x4a, 0x4d], ["PageDown", "PgDn", 0x4b, 0x4e],
  ["ArrowRight", "→", 0x4c, 0x4f], ["ArrowLeft", "←", 0x4d, 0x50],
  ["ArrowDown", "↓", 0x4e, 0x51], ["ArrowUp", "↑", 0x4f, 0x52],
  ["ControlLeft", "L Ctrl", 0x63, 0xe0], ["ShiftLeft", "L Shift", 0x64, 0xe1],
  ["AltLeft", "L Alt", 0x65, 0xe2], ["MetaLeft", "Win", 0x66, 0xe3],
  ["ControlRight", "R Ctrl", 0x67, 0xe4], ["ShiftRight", "R Shift", 0x68, 0xe5],
  ["AltRight", "R Alt", 0x69, 0xe6], ["ContextMenu", "Menu", 0x77, 0x65],
  ["MetaRight", "R Win", 0x6a, 0xe7], ["IntlBackslash", "ISO", 0x61, 0x64],
  ["IntlYen", "Yen", 0xf4, 0x89], ["IntlRo", "Ro", 0xf2, 0x87],
  ["Convert", "Convert", 0xff, 0x8a], ["NonConvert", "Non-conv", 0xff, 0x8b],
  ["ScrollLock", "ScrLk", 0x44, 0x47], ["NumLock", "Num", 0x50, 0x53],
  ["NumpadDivide", "÷", 0x51, 0x54], ["NumpadMultiply", "×", 0x53, 0x55],
  ["NumpadSubtract", "−", 0x54, 0x56], ["NumpadAdd", "+", 0x55, 0x57],
  ["NumpadEnter", "Enter", 0x56, 0x58], ["Numpad0", "0", 0x60, 0x62],
  ["NumpadDecimal", ".", 0x52, 0x63],
  ...Array.from({ length: 9 }, (_, index) => [`Numpad${index + 1}`, String(index + 1), 0x57 + index, 0x59 + index]),
  ["Profile2", "P2", 0xff], ["Profile3", "P3", 0xff], ["Profile4", "P4", 0xff],
  ["Mode", "Mode", 0xe6], ["Fn", "Fn", 0xe7], ["Unbound", "Unbound", 0xff],
];

export const codes = new Map(mappings.map(([code, label, value, usage]) => [code, { code, label, value, usage }]));
export const keyOptions = mappings.filter(([code, , value]) => value !== 0xff || code === "Unbound")
  .map(([code]) => codes.get(code));
export const usageLabel = new Map(mappings.filter(([, , , usage]) => usage !== undefined)
  .map(([, label, , usage]) => [usage, label]));
export const bindingLabel = value => value === 0xff ? "Unbound" : mappings.find(([, , binding]) => binding === value)?.[1] ||
  `Code ${value.toString(16).toUpperCase()}`;

const sequence = (start, names) => names.map((name, index) => [start + index, name]);
const letters = (start, text) => sequence(start, [...text].map(letter => "Key" + letter));
const num = sequence(1, [..."1234567890"].map(number => "Digit" + number));
const gap = width => [null, null, width];
const nav = (first, second) => [gap(1), [15, first], [16, second]];
const familyRows = (shape, variant) => {
  if (shape === "pad") return [[], [], [[1,"KeyZ",8], gap(1), [3,"KeyX",8], gap(1), [5,"KeyC",8]],
    [[2,"Escape",8], gap(1), [3,"Space",8], gap(1), [4,"Fn",8]]];
  const wide = shape === "80";
  const tkl = shape === "tkl" || shape === "full";
  const full = shape === "full";
  const iso = variant.startsWith("ISO");
  const jis = variant === "JIS";
  const split = variant.endsWith("Split");
  const end = wide ? 14 : 13;
  const top = wide ? [[0, "Escape"], ...sequence(1, ["F1","F2","F3","F4"]), gap(1),
      ...sequence(5, ["F5","F6","F7","F8"]), gap(1),
      ...sequence(10, ["F9","F10","F11","F12"]), gap(1), ...sequence(14, ["Mode","PrintScreen","Pause"])] :
    [[0,"Escape"], gap(4), ...sequence(2,["F1","F2","F3","F4"]), gap(2), ...sequence(6,["F5","F6","F7","F8"]),
      gap(2), ...sequence(10,["F9","F10","F11","F12"]), gap(1),
      ...sequence(14,["PrintScreen","Pause",full ? "ScrollLock" : "Mode"]),
      ...(full ? [gap(1), ...sequence(17,["Profile2","Profile3","Profile4","Mode"])] : [])];
  const side = (names, pad) => [...(tkl ? [gap(1), ...sequence(14,names)] : []),
    ...(full ? [gap(1), ...sequence(17,pad)] : [])];
  const space = split ? [[4,"Space",10],[6,"Fn",5],[8,"Space",10]] :
    jis ? [[3,"NonConvert",5],[6,"Space",15],[9,"Convert",5]] : [[6,"Space",25]];
  return [
    wide || tkl ? top : [],
    [[0, wide || tkl ? "Backquote" : "Escape"], ...num, [11,"Minus"], [12,"Equal"], ...(jis ? [[13,"IntlYen"]] : []),
      [end,"Backspace",jis ? 4 : 8], ...(wide ? nav("Insert","PageUp") :
        side(["Insert","Home","PageUp"],["NumLock","NumpadDivide","NumpadMultiply","NumpadSubtract"]))],
    [[0,"Tab",6], ...letters(1,"QWERTYUIOP"), [11,"BracketLeft"], [12,"BracketRight"],
      iso || jis ? gap(6) : [end,"Backslash",6], ...(wide ? nav("Delete","PageDown") :
        side(["Delete","End","PageDown"],["Numpad7","Numpad8","Numpad9","NumpadAdd"]))],
    [[0,"CapsLock",7], ...letters(1,"ASDFGHJKL"), [10,"Semicolon"], [11,"Quote"],
      ...(iso || jis ? [[12,"Backslash"]] : []), [end,"Enter",iso || jis ? 5 : 9],
      ...(full ? [gap(14), ...sequence(17,["Numpad4","Numpad5","Numpad6"])] : [])],
    [[0,"ShiftLeft",iso ? 5 : 9], ...(iso ? [[1,"IntlBackslash"]] : []),
      ...letters(2,"ZXCVBNM"), [9,"Comma"], [10,"Period"], [11,"Slash"], ...(jis ? [[12,"IntlRo"]] : []),
      [end,"ShiftRight",jis ? 7 : 11], ...(wide || tkl ? [gap(5), [15,"ArrowUp"]] : []),
      ...(full ? [gap(5), ...sequence(17,["Numpad1","Numpad2","Numpad3","NumpadEnter"])] : [])],
    [[0,"ControlLeft",5], [1,"MetaLeft",5], [2,"AltLeft",5], ...space, [10,"AltRight",5],
      ...(wide ? [[11,"ControlRight",5], [12,"Fn",5]] : tkl ? [[11,"MetaRight",5],[12,"Fn",5],[13,"ControlRight",5]] :
        [[11,"ContextMenu",5], [12,"ControlRight",5], [13,"Fn",5]]),
      ...(wide || tkl ? [gap(1), ...sequence(14, ["ArrowLeft","ArrowDown","ArrowRight"])] : []),
      ...(full ? [gap(1), [18,"Numpad0",8], [19,"NumpadDecimal"]] : [])],
  ];
};

export function layout(family, variant = getModel(family).layouts[0]) {
  const { shape } = getModel(family);
  return familyRows(shape, variant).map((keys, row) => keys.map(([col, code, width = 4]) => {
    if (col === null) return { width, gap: true };
    return { ...codes.get(code), row, col, width, id: row * 32 + col };
  })).filter(row => row.length);
}

export function makeDemo(family, variant) {
  const map = Array.from({ length: 6 }, () => Array(21).fill(255));
  const colors = Array.from({ length: 6 }, () => Array(21).fill("#102030"));
  const keys = layout(family, variant).flat().filter(key => !key.gap);
  const maxCol = Math.max(...keys.map(key => key.col));
  for (const key of keys) {
    map[key.row][key.col] = key.value;
    const ratio = key.col / maxCol;
    colors[key.row][key.col] = "#" + [168 - 80 * ratio, 116 + 90 * ratio, 236 - 45 * ratio]
      .map(channel => Math.round(channel).toString(16).padStart(2, "0")).join("");
  }
  return { slot: 0, layer: 0, tune: { actuation: 1.6, enabled: true, sensitivity: .2 },
    actuation: {}, rapid: {}, colors, map, lighting: { brightness: 100, effect: "static", speed: 16 }, advanced: {},
    lightbar: getModel(family).lightbar ? defaultLightbar() : null };
}
