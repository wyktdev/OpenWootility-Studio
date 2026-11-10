import assert from "node:assert/strict";
import test from "node:test";
import { calibratedTravel, decodeAnalogReport } from "../docs/analog.js";
import { colorHex, colorWord } from "../docs/device.js";
import { decodeLightbarColors, defaultLightbar, patchLightbar, readLightbar } from "../docs/lightbar.js";
import { blobs, field, integer, join } from "../docs/proto.js";

test("modern reports retain 10-bit depth, actuation and physical position", () => {
  const data = Uint8Array.of(0, 0, 0x81, 0x80, 97, 4, 0x40, 0x40, 97, 7, 0xd8, 0xff, 98, 5, 0, 0, 99);
  const readings = decodeAnalogReport(new DataView(data.buffer), 0xff53);
  assert.deepEqual([...readings.values()], [
    { index: 0, fraction: 514 / 1023, actuated: true },
    { index: 97, fraction: 257 / 1023, actuated: false },
  ]);
});

test("legacy reports retain both usage bytes and normalized travel", () => {
  const data = Uint8Array.of(2, 4, 128, 0, 6, 255, 0, 8, 0);
  const readings = decodeAnalogReport(new DataView(data.buffer), 0xff54);
  assert.deepEqual([...readings.values()], [
    { usage: 0x0204, fraction: 128 / 255 },
    { usage: 0x0006, fraction: 1 },
  ]);
});

test("physical travel uses per-key switch and spacer data", () => {
  const config = join([
    field(2, field(1, 0)),
    field(1, field(1, join([field(1, 97), field(2, join([field(1, 3), field(3, 2)]))]))),
    field(1, field(1, join([field(1, 98), field(2, field(1, 6))]))),
  ]);
  const types = [
    join([field(1, 0), field(2, 20), field(4, 80)]),
    join([field(1, 3), field(2, 20), field(4, 68)]),
  ];
  const travel = calibratedTravel(config, types, [{ id: 96 }, { id: 97 }, { id: 98 }]);
  assert.deepEqual([...travel], [[96, 4], [97, 3.3], [98, undefined]]);
});

test("lightbar segments and independent brightness preserve the device's conditional layer", () => {
  const indicator = join([field(1, field(1, 1)), field(6, field(1, 123))]);
  const original = join([field(1, 1), field(2, indicator), field(3, 0), field(19, 13)]);
  const before = readLightbar(original, colorHex);
  const segments = ["#e0e0e0", ...Array(9).fill("#0011ff")];
  const draft = { ...before, linked: false, brightness: 35, mode: "segments", segments };
  const edited = patchLightbar(original, before, draft, colorWord);
  assert.deepEqual(readLightbar(edited, colorHex), draft);
  assert.deepEqual(blobs(edited, 2).at(-1), indicator);
  assert.equal(integer(edited, 19), 13);
  const restored = patchLightbar(edited, draft, before, colorWord);
  assert.deepEqual(blobs(restored, 2), [indicator]);
  assert.deepEqual(readLightbar(restored, colorHex), before);
});

test("lightbar pulse retains both colors and its timing after RGB565 encoding", () => {
  const state = defaultLightbar();
  const edited = patchLightbar(new Uint8Array(), state,
    { ...state, mode: "pulse", color: "#ff0000", secondary: "#0000ff", duration: 2100 }, colorWord);
  const actual = readLightbar(edited, colorHex);
  assert.equal(actual.mode, "pulse");
  assert.equal(actual.color, "#ff0000");
  assert.equal(actual.secondary, "#0000ff");
  assert.equal(actual.duration, 2100);
});

test("live lightbar frames preserve LED order, full RGB values and unlit segments", () => {
  const captured = "0a0808ff01100018ff010a0808ff01100018ff010a0808ff0110d401185c0a0808ff0110d401185c" +
    "0a0808ff01100018ff01".repeat(6);
  assert.deepEqual(decodeLightbarColors(Buffer.from(captured, "hex")),
    ["#ff00ff", "#ff00ff", "#ffd45c", "#ffd45c", ...Array(6).fill("#ff00ff")]);
  assert.deepEqual(decodeLightbarColors(join(Array.from({ length: 10 }, () => field(1, new Uint8Array())))),
    Array(10).fill("#000000"));
  assert.throws(() => decodeLightbarColors(field(1, new Uint8Array())), /ten lightbar colors/);
});
