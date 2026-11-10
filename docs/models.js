const ansiIso = ["ANSI", "ISO"];
const splitLayouts = [...ansiIso, "ANSI Split", "ISO Split"];
const wideLayouts = [...ansiIso, "JIS"];

// USB product IDs use their low nibble for operating mode variants.
// Original One and Two boards also shipped under the Atmel USB vendor ID.
export const models = [
  { id: "one", name: "Wooting One", shape: "tkl", layouts: ansiIso, pid: 0x1100, legacyPid: 0xff01, tech: "Flaretech" },
  { id: "two", name: "Wooting Two", shape: "full", layouts: ansiIso, pid: 0x1200, legacyPid: 0xff02, tech: "Flaretech" },
  { id: "lekker", name: "Wooting Two Lekker Edition", shape: "full", layouts: ansiIso, pid: 0x1210 },
  { id: "two-he", name: "Wooting Two HE (AVR)", shape: "full", layouts: ansiIso, pid: 0x1220 },
  { id: "two-he-arm", name: "Wooting Two HE (ARM)", shape: "full", layouts: ansiIso, pid: 0x1230, arm: true },
  { id: "60-avr", name: "Wooting 60HE (AVR)", shape: "compact", layouts: ansiIso, pid: 0x1300 },
  { id: "60-arm", name: "Wooting 60HE (ARM)", shape: "compact", layouts: ansiIso, pid: 0x1310, arm: true },
  { id: "60-plus", name: "Wooting 60HE+", shape: "compact", layouts: ansiIso, pid: 0x1320, arm: true },
  { id: "60", name: "Wooting 60HE v2", shape: "compact", layouts: splitLayouts, pid: 0x1340, arm: true },
  { id: "80", name: "Wooting 80HE", shape: "80", layouts: wideLayouts, pid: 0x1400, arm: true, lightbar: true },
  { id: "80-plus", name: "Wooting 80HE+", shape: "80", layouts: splitLayouts, pid: 0x1410, arm: true, lightbar: true },
  { id: "uwu", name: "Wooting UwU", shape: "pad", layouts: ["Keypad"], pid: 0x1500, arm: true, rgb: false },
  { id: "uwu-rgb", name: "Wooting UwU RGB", shape: "pad", layouts: ["Keypad"], pid: 0x1510, arm: true },
];

export const getModel = id => models.find(model => model.id === id);
export const layoutName = (model, value) => model.shape === "pad" ? "Keypad" :
  ["ANSI", "ISO", "JIS", "ANSI Split", "ISO Split"][value];

export function identifyModel(device) {
  if (device.vendorId === 0x31e3) return models.find(model => model.pid === (device.productId & 0xfff0));
  if (device.vendorId === 0x03eb) return models.find(model => model.legacyPid === device.productId);
}
