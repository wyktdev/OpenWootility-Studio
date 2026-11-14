import assert from "node:assert/strict";
import test from "node:test";
import { lightingSettings, patchLighting } from "../docs/customizations.js";
import { colorWord, KeyboardSession } from "../docs/device.js";
import { layout, makeDemo, paintKey, rgbPositions } from "../docs/layout.js";
import { getModel, models } from "../docs/models.js";
import { lightingPresets, presetColors, studioPresets, wootilityPresets } from "../docs/presets.js";
import { blobs, field, integer, integers, join, varint } from "../docs/proto.js";

test("painting a standard spacebar updates every LED, with JIS and split keys addressed separately", () => {
  for (const model of models) {
    for (const variant of model.layouts) {
      const keys = layout(model.id, variant).flat().filter(key => !key.gap);
      for (const key of keys.filter(key => key.code === "Space")) {
        const colors = Array.from({ length: 6 }, () => Array(21).fill("#ff8800"));
        paintKey(colors, key, "#101c5c", model.id, variant);
        const count = ["compact", "80"].includes(model.shape) && !variant.endsWith("Split") ? variant === "JIS" ? 3 : 5 : 1;
        assert.equal(rgbPositions(key, model.id, variant).length, count);
        assert.equal(colors.flat().filter(color => color === "#101c5c").length, count);
        assert.equal(colors[key.row][key.col], "#101c5c");
      }
    }
  }
});

test("solid painting clears all RGB effect layers while preserving brightness, indicators and other metadata", () => {
  const base = join([field(1, 180), field(2, 0xffff), field(3, 0x1234)]);
  const stack = join([field(1, field(1, field(2, 16))), field(1, field(8, field(1, 25))), field(9, 77)]);
  const core = join([field(1, base), field(4, stack), field(12, 34)]);
  const before = lightingSettings(core);
  const result = patchLighting(core, { ...before, effect: "static", clearEffects: true }, before);
  assert.equal(blobs(blobs(result, 4)[0], 1).length, 0);
  assert.equal(integer(blobs(result, 4)[0], 9), 77);
  assert.deepEqual(blobs(result, 1)[0], base);
  assert.equal(integer(result, 12), 34);
  assert.equal(lightingSettings(result).effect, "static");
  assert.deepEqual(patchLighting(result, { ...before, effect: "static", clearEffects: true }, before), result);
  assert.deepEqual(patchLighting(core, before, before), core);
});

test("all 23 presets supply independent valid RGB matrices for every supported model and layout", () => {
  assert.equal(wootilityPresets.length, 9);
  assert.equal(studioPresets.length, 14);
  assert.equal(new Set(lightingPresets.map(preset => preset.id)).size, 23);
  for (const model of models) {
    for (const variant of model.layouts) {
      for (const preset of lightingPresets) {
        const colors = presetColors(preset, model.id, variant);
        assert.equal(colors.length, 6);
        assert.ok(colors.every(row => row.length === 21 && row.every(color => /^#[0-9a-f]{6}$/.test(color))));
        colors[0][0] = "#ff8800";
        assert.notEqual(presetColors(preset, model.id, variant)[0][0], "#ff8800");
      }
    }
  }
  assert.equal(presetColors(wootilityPresets.find(preset => preset.name === "Seawave"), "80")[0][0], "#0000ff");
});

test("Wykt stays dark blue and purple across every spacebar LED and survives RGB565 conversion", () => {
  const preset = studioPresets.find(preset => preset.id === "wykt");
  for (const model of models.filter(model => model.rgb !== false)) {
    for (const variant of model.layouts) {
      const colors = presetColors(preset, model.id, variant);
      for (const hex of colors.flat()) {
        const red = parseInt(hex.slice(1, 3), 16), green = parseInt(hex.slice(3, 5), 16), blue = parseInt(hex.slice(5), 16);
        assert.ok(blue > red && blue > green && Math.max(red, green, blue) <= 102);
        assert.ok((colorWord(hex) & 31) > 0);
      }
      for (const key of layout(model.id, variant).flat().filter(key => key.code === "Space")) {
        assert.ok(rgbPositions(key, model.id, variant).every(([row, col]) => colors[row][col] === colors[key.row][key.col]));
      }
    }
  }
});

test("normal onboard save writes all five spacebar LEDs and clears the wave before persistence", async () => {
  const model = getModel("80");
  const session = new KeyboardSession({ collections: [{ usagePage: 0xff55, usage: 1 }] }, model);
  session.profileEditing = true;
  const original = makeDemo("80", "ANSI");
  const core = join([field(1, field(1, 255)), field(4, field(1, field(1, field(2, 16))))]);
  const page = rows => join(rows.map(row => {
    const words = join(row.map(color => varint(colorWord(color))));
    return field(1, field(1, words));
  }));
  original.lighting = lightingSettings(core);
  original.effectEditing = true;
  original.wire = { core, upper: page(original.colors.slice(0, 3)), lower: page(original.colors.slice(3)) };
  const draft = structuredClone(original);
  const space = layout("80").flat().find(key => key.code === "Space");
  paintKey(draft.colors, space, "#141d66", "80", "ANSI");
  draft.lighting = { ...original.lighting, effect: "static", clearEffects: true };
  const current = structuredClone(original);
  const writes = [];
  session.activeSlot = async () => 0;
  session.restoreLighting = async () => {};
  session.read = async () => structuredClone(current);
  session.put = async (command, slot, payload) => {
    const key = new Map([[0x0e, "upper"], [0x0f, "lower"], [0x16, "core"]]).get(command);
    current.wire[key] = payload;
    writes.push(command);
  };
  session.command = async command => {
    const key = new Map([[0x23, "upper"], [0x24, "lower"], [0x32, "core"]]).get(command);
    const payload = key ? current.wire[key] : new Uint8Array();
    return Uint8Array.from([0xd1, 0xda, command, 0x88, payload.length & 255, payload.length >>> 8, ...payload]);
  };
  await session.save(original, draft, ["colors", "lighting"]);
  const row = integers(blobs(current.wire.lower, 1)[2], 1);
  assert.deepEqual(row.slice(4, 9), Array(5).fill(colorWord("#141d66")));
  assert.equal(blobs(current.wire.core, 4).length, 0);
  assert.deepEqual(writes, [0x0f, 0x16]);
});
