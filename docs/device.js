import { blobs, field, integer, integers, join, replaceField, varint } from "./proto.js";
import { identifyModel, layoutName } from "./models.js";
import { advancedSettings, lightingSettings, patchAdvanced, patchLighting } from "./customizations.js";
import { layout } from "./layout.js";
import { analogPages, calibratedTravel, decodeAnalogReport } from "./analog.js";
import { decodeLightbarColors, lightbarFingerprint, patchLightbar, readLightbar } from "./lightbar.js";

// Public SDK RGB/analog wire formats, plus documented ARM configuration packets.
// See the interoperability references in the README.
const configPages = [0xff55, 0x1337];
const magic = [0xd1, 0xda];
const textDecoder = new TextDecoder();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const equal = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
const config = device => device.collections.find(item => configPages.includes(item.usagePage) && item.usage === 1);
const analog = device => device.collections.some(item => analogPages.includes(item.usagePage));
// Constant HID items are padding. Firmware dispatches by the usable capacity of each report ID.
const reportSize = report => report.items.filter(item => !item.isConstant)
  .reduce((sum, item) => sum + item.reportCount * item.reportSize, 0) / 8;
const rawMm = value => Math.round(16384 + 4096 * value);
const mm = value => Math.round((value - 16384) / 4096 * 100) / 100;
const dimensions = (rows, count, width = 21) => rows.length === count && rows.every(row => row?.length === width);
const padded = (rows, blank) => Array.from({ length: 6 }, (_, row) =>
  Array.from({ length: 21 }, (_, col) => rows[row]?.[col] ?? blank));

export function colorWord(hex) {
  const color = parseInt(hex.slice(1), 16);
  return ((color >>> 19) << 11) | (((color >>> 10) & 63) << 5) | ((color >>> 3) & 31);
}

export function colorHex(value) {
  const red = Math.round((value >>> 11) * 255 / 31);
  const green = Math.round(((value >>> 5) & 63) * 255 / 63);
  const blue = Math.round((value & 31) * 255 / 31);
  return "#" + [red, green, blue].map(channel => channel.toString(16).padStart(2, "0")).join("");
}

function body(reply) {
  const length = reply[4] | (reply[5] << 8);
  if (reply.length < 6 || length > reply.length - 6) throw new Error("The keyboard returned a truncated profile.");
  return reply.subarray(6, 6 + length);
}

function decodeBase(bytes) {
  const [base] = blobs(bytes, 1);
  const actuation = base && integer(base, 1);
  if (actuation === undefined || mm(actuation) < 0 || mm(actuation) > 4) {
    throw new Error("This firmware returned an unsupported actuation profile.");
  }
  const sensitivity = integer(base, 4);
  const release = integer(base, 8);
  return {
    actuation: mm(actuation),
    enabled: integer(base, 3) === 1,
    sensitivity: sensitivity !== undefined && mm(sensitivity) > 0 && mm(sensitivity) <= 4 ? mm(sensitivity) : .2,
    ...(release !== undefined && mm(release) > 0 && mm(release) <= 4 ? { secondary: mm(release) } : {}),
  };
}

function decodeActuation(bytes) {
  const [packed] = blobs(bytes, 4);
  return Object.fromEntries(packed ? integers(packed, 1)
    .map(value => [value & 0xffff, mm(Math.floor(value / 65536))]) : []);
}

function decodeRapid(bytes) {
  const overrides = {};
  for (const group of blobs(bytes, 1)) {
    const [config] = blobs(group, 2);
    const enabled = integer(group, 3);
    const sensitivity = config && integer(config, 1);
    const secondary = config && integer(config, 2);
    for (const key of integers(group, 1)) {
      if (sensitivity !== undefined) {
        overrides[key] = { sensitivity: mm(sensitivity), continuous: integer(config, 3) === 1,
          ...(secondary === undefined ? {} : { secondary: mm(secondary) }) };
      } else if (enabled === 0) {
        overrides[key] = { off: true };
      }
    }
  }
  return overrides;
}

function decodeColorPage(bytes, pad = false, upper = true) {
  const rows = blobs(bytes, 1).map(row => integers(row, 1));
  if ((!dimensions(rows, 3) && !(pad && dimensions(rows, upper ? 3 : 2, 7))) ||
      rows.some(row => row.some(color => color > 0xffff))) {
    throw new Error("This firmware returned an unsupported RGB page.");
  }
  return rows;
}

function decodeMap(bytes, pad = false) {
  const rows = blobs(bytes, 1).map(row => blobs(row, 1)[0]);
  if (!dimensions(rows, 6) && !(pad && dimensions(rows, 5, 7))) throw new Error("Unsupported keymap dimensions.");
  return rows.map(row => [...row]);
}

function updateRows(bytes, rows, encode) {
  const oldRows = blobs(bytes, 1);
  if (rows.length !== oldRows.length) throw new Error("Profile rows changed size.");
  return replaceField(bytes, 1, oldRows.map((oldRow, index) => replaceField(oldRow, 1, [encode(rows[index])])));
}

export async function connectKeyboard(hid, { reuse = false, configurationOnly = false, modelId } = {}) {
  const pages = configurationOnly ? configPages : [...configPages, ...analogPages];
  const filters = [0x31e3, 0x03eb].flatMap(vendorId =>
    pages.map(usagePage => ({ vendorId, usagePage, usage: 1 })));
  const choices = reuse ? await hid.getDevices() : await hid.requestDevice({ filters });
  if (!choices.length) return;
  const known = choices.filter(choice => {
    const model = identifyModel(choice);
    return model && (!modelId || model.id === modelId);
  });
  const keyboards = known.filter(choice => config(choice));
  if (reuse && keyboards.length !== 1) return;
  const device = keyboards[0] || (!configurationOnly && known.find(analog));
  if (!device) throw new Error("Choose a Wooting keyboard from the browser’s device list.");
  const model = identifyModel(device);
  const session = new KeyboardSession(device, model);
  try {
    await device.open();
    if (session.collection) {
      const version = await session.command(0x01).catch(() => null);
      const versionBytes = version && (session.arm ? body(version) : version.subarray(4, 7));
      if (versionBytes?.length >= 3 && versionBytes.slice(0, 3).some(Boolean)) {
        session.firmware = [...versionBytes.subarray(0, 3)].join(".");
        session.profileEditing = session.arm && (versionBytes[0] > 2 ||
          (versionBytes[0] === 2 && versionBytes[1] >= 10));
      }
      const info = await session.command(0x13).catch(() => null);
      const reported = layoutName(model, info?.[device.vendorId === 0x03eb ? 8 : 9]);
      if (model.layouts.includes(reported)) session.variant = reported;
      else if (session.arm) session.profileEditing = false;
    }
    const devices = [...new Set([...choices, ...await hid.getDevices()])];
    for (const page of analogPages) {
      const siblings = devices.filter(item => item.vendorId === device.vendorId && item.productId === device.productId &&
        item.collections.some(collection => collection.usagePage === page));
      if (siblings.length !== 1) continue;
      session.analogDevice = siblings[0];
      session.analogPage = page;
      break;
    }
    return session;
  } catch (error) {
    if (device.opened) await device.close();
    throw error;
  }
}

export class KeyboardSession {
  constructor(device, model) {
    this.device = device;
    this.model = model;
    this.name = model.name;
    this.family = model.id;
    this.variant = model.layouts[0];
    this.firmware = "Unknown";
    this.profileEditing = false;
    this.previewing = false;
    this.collection = config(device);
    this.arm = this.collection?.usagePage === 0xff55;
    this.marker = this.arm ? 0xd1 : 0xd0;
    this.reports = (this.collection?.outputReports || []).map(report => ({ id: report.reportId, size: reportSize(report) }))
      .filter(report => Number.isInteger(report.size) && report.size >= 32).sort((a, b) => a.size - b.size);
    this.previewAvailable = Boolean(this.collection && model.rgb !== false &&
      (device.vendorId === 0x03eb || this.reports.some(report => this.arm ? report.size >= 255 :
        report.id === 0 && [64, 256].includes(report.size))));
  }

  async command(command, slot = 0, layer = 0, parameters) {
    let timeout;
    let listen;
    const response = new Promise((resolve, reject) => {
      listen = event => {
        const data = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
        if (data.length < 4 || data[0] !== this.marker || data[1] !== magic[1] || data[2] !== command) return;
        if (data[3] !== 0x88) reject(new Error(`Keyboard declined command 0x${command.toString(16)}.`));
        else resolve(data.slice());
      };
      this.device.addEventListener("inputreport", listen);
      timeout = setTimeout(() => reject(new Error(`Keyboard did not answer command 0x${command.toString(16)}.`)), 1000);
    });
    try {
      const [, reply] = await Promise.all([
        this.device.sendFeatureReport(this.arm ? 1 : 0, Uint8Array.of(this.marker, magic[1], command,
          ...(parameters || (this.arm ? [slot, 0, layer, 0] : [0, 0, 0, slot])))), response,
      ]);
      return reply;
    } finally {
      clearTimeout(timeout);
      this.device.removeEventListener("inputreport", listen);
    }
  }

  async output(bytes, preferred) {
    const report = this.reports.find(item => item.id === preferred && item.size >= bytes.length) ||
      this.reports.find(item => item.size >= bytes.length);
    if (!report) throw new Error("This keyboard has no output report large enough for the profile.");
    const padded = new Uint8Array(report.size);
    padded.set(bytes);
    await this.device.sendReport(report.id, padded);
  }

  async put(command, slot, payload, { save = true, layer, flags, preferred } = {}) {
    const header = [...magic, command, flags ?? ((slot << 1) | Number(save))];
    if (layer !== undefined) header.push(layer, 0, 0);
    header.push(payload.length & 255, payload.length >>> 8);
    await this.output(join([Uint8Array.from(header), payload]), preferred);
  }

  async activeSlot() {
    const reply = await this.command(0x0b);
    if (reply.length < 7 || reply[6] > 3) throw new Error("The active profile is outside the four onboard slots.");
    return reply[6];
  }

  async readLightbarColors() {
    return decodeLightbarColors(body(await this.command(0x44)));
  }

  async profiles() {
    const active = await this.activeSlot();
    const names = [];
    for (let slot = 0; slot < 4; slot++) {
      try {
        const bytes = body(await this.command(0x37, slot));
        const [name] = blobs(bytes, 1);
        names.push(bytes.length ? (name ? textDecoder.decode(name) : `Slot ${slot + 1}`) : null);
      } catch {
        names.push(slot === active ? `Slot ${slot + 1}` : null);
      }
    }
    return { active, names };
  }

  async activate(slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 3) throw new Error("Invalid onboard slot.");
    await this.restoreLighting();
    await this.command(0x21);
    try {
      await this.command(0x17, slot);
      await pause(100);
      await this.command(0x26, slot);
      await pause(120);
      if (await this.activeSlot() !== slot) throw new Error("The keyboard did not switch to that slot.");
    } finally {
      await this.command(0x20);
    }
  }

  async read(slot, layer = 0) {
    const pad = this.model.shape === "pad";
    const rgb = this.model.rgb !== false;
    const base = body(await this.command(0x27, slot));
    const actuation = body(await this.command(0x31, slot));
    const rapid = body(await this.command(0x3d, slot));
    const upper = rgb ? body(await this.command(0x23, slot)) : new Uint8Array();
    const lower = rgb ? body(await this.command(0x24, slot)) : new Uint8Array();
    let map = body(await this.command(0x30, slot, layer));
    const sharedMap = !map.length && slot !== 0;
    if (sharedMap) map = body(await this.command(0x30, 0, layer));
    const optional = command => this.command(command, slot).then(body).catch(() => new Uint8Array());
    const core = rgb ? await optional(0x32) : new Uint8Array();
    const akc = slot === 0 ? await optional(0x34) : new Uint8Array();
    let lightbar;
    if (this.model.lightbar) {
      lightbar = await this.command(0x42, slot).then(body).catch(() => undefined);
    }
    const colorRows = rgb ? [...decodeColorPage(upper, pad), ...decodeColorPage(lower, pad, false)] : [];
    const mapRows = map.length ? decodeMap(map, pad) : null;
    const physical = layout(this.family, this.variant).flat().filter(key => !key.gap);
    if (physical.some(({ row, col }) => (mapRows && mapRows[row]?.[col] === undefined) ||
      (rgb && colorRows[row]?.[col] === undefined))) throw new Error("The returned profile does not cover this layout.");
    return {
      slot, layer, sharedMap,
      tune: decodeBase(base),
      actuation: decodeActuation(actuation),
      rapid: decodeRapid(rapid),
      colors: padded(colorRows, 0).map(row => row.map(colorHex)),
      map: mapRows && padded(mapRows, 255),
      lighting: lightingSettings(core),
      advanced: advancedSettings(akc),
      effectEditing: slot === 0 && Boolean(blobs(core, 1).length),
      advancedEditing: Boolean(akc.length) && (integer(akc, 3) ?? 0) <= blobs(akc, 1).length,
      lightbar: this.model.lightbar ? readLightbar(lightbar ?? new Uint8Array(), colorHex) : null,
      lightbarEditing: lightbar !== undefined,
      wire: { base, actuation, rapid, upper, lower, map, core, akc, lightbar },
    };
  }

  async save(original, draft, groups) {
    if (!this.profileEditing) throw new Error("Onboard profile editing is unavailable on this connection.");
    const { slot, layer } = original;
    const pad = this.model.shape === "pad";
    await this.restoreLighting();
    if (await this.activeSlot() !== slot) throw new Error("Activate the edited slot before saving.");
    const current = await this.read(slot, layer);
    const steps = [];
    const check = key => {
      if (!equal(current.wire[key], original.wire[key])) {
        throw new Error("The keyboard profile changed since it was read. Refresh it before saving.");
      }
    };
    const step = (key, command, read, payload, options) => {
      check(key);
      steps.push({ key, command, read, payload, options });
    };

    if (groups.includes("tune")) {
      const [base] = blobs(current.wire.base, 1);
      let edited = base;
      for (const [name, number, encode] of [["actuation", 1, rawMm], ["enabled", 3, Number], ["sensitivity", 4, rawMm],
        ["secondary", 8, rawMm]]) {
        const value = draft.tune[name];
        if (value !== original.tune[name]) edited = replaceField(edited, number, value === undefined ? [] : [encode(value)]);
      }
      step("base", 0x11, 0x27, replaceField(current.wire.base, 1, [edited]));
    }
    if (groups.includes("actuation")) {
      const [old = new Uint8Array()] = blobs(current.wire.actuation, 4);
      const values = Object.entries(draft.actuation).map(([key, value]) => rawMm(value) * 65536 + Number(key));
      const edited = replaceField(old, 1, values);
      step("actuation", 0x15, 0x31, replaceField(current.wire.actuation, 4, edited.length ? [edited] : []));
    }
    if (groups.includes("rapid")) {
      const bySetting = new Map();
      const changed = new Set([...Object.keys(original.rapid), ...Object.keys(draft.rapid)]
        .filter(key => JSON.stringify(original.rapid[key]) !== JSON.stringify(draft.rapid[key])).map(Number));
      const untouched = [];
      for (const old of blobs(current.wire.rapid, 1)) {
        const keys = integers(old, 1);
        const left = keys.filter(key => !changed.has(key));
        if (left.length) untouched.push(left.length === keys.length ? old : replaceField(old, 1, left));
      }
      for (const key of changed) {
        const value = draft.rapid[key];
        if (!value) continue;
        const signature = JSON.stringify(value);
        if (!bySetting.has(signature)) bySetting.set(signature, []);
        bySetting.get(signature).push(key);
      }
      const changedGroups = [];
      for (const [signature, keys] of bySetting) {
        const setting = JSON.parse(signature);
        const settings = setting.off ? [] : [field(1, rawMm(setting.sensitivity)), field(3, Number(setting.continuous))];
        if (setting.secondary !== undefined) settings.push(field(2, rawMm(setting.secondary)));
        const value = setting.off ? field(3, 0) : field(2, join(settings));
        for (let offset = 0; offset < keys.length; offset += 10) {
          changedGroups.push(join([...keys.slice(offset, offset + 10).map(key => field(1, key)), value]));
        }
      }
      const limit = Number(this.firmware.split(".")[1]) >= 13 ? 30 : 10;
      if (untouched.length + changedGroups.length > limit) throw new Error(`This firmware supports up to ${limit} Rapid Trigger groups.`);
      step("rapid", 0x1d, 0x3d, replaceField(current.wire.rapid, 1, [...untouched, ...changedGroups]));
    }
    if (groups.includes("map")) {
      if (current.sharedMap || !current.map) throw new Error("Open the slot that owns this layer before saving its keymap.");
      const rows = decodeMap(current.wire.map, pad).map((old, index) => draft.map[index].slice(0, old.length));
      step("map", 0x14, 0x30, updateRows(current.wire.map, rows, row => Uint8Array.from(row)), { layer });
    }
    if (groups.includes("colors")) {
      if (this.model.rgb === false) throw new Error("This keyboard does not have RGB lighting.");
      const rows = draft.colors.map(row => row.map(colorWord));
      const packRow = row => join(row.map(varint));
      for (const [key, command, read, offset] of [["upper", 0x0e, 0x23, 0], ["lower", 0x0f, 0x24, 3]]) {
        const oldRows = decodeColorPage(current.wire[key], pad, offset === 0);
        const newRows = oldRows.map((old, index) => rows[offset + index].slice(0, old.length));
        if (JSON.stringify(newRows) !== JSON.stringify(oldRows)) {
          step(key, command, read, updateRows(current.wire[key], newRows, packRow));
        }
      }
    }
    if (groups.includes("lighting")) {
      const payload = patchLighting(current.wire.core, draft.lighting, original.lighting);
      if (!current.effectEditing || payload.length > 56) throw new Error("This lighting stack exceeds the supported onboard format.");
      step("core", 0x16, 0x32, payload, { flags: 0, preferred: 2 });
    }
    if (groups.includes("lightbar")) {
      if (!current.lightbarEditing || !original.lightbarEditing) throw new Error("This device did not provide its lightbar profile.");
      const payload = patchLightbar(current.wire.lightbar, original.lightbar, draft.lightbar, colorWord);
      step("lightbar", 0x20, 0x42, payload);
    }
    if (groups.includes("advanced")) {
      const payload = patchAdvanced(current.wire.akc, original.advanced, draft.advanced);
      if (!current.advancedEditing || payload.length > 56) {
        throw new Error("This advanced configuration exceeds the supported onboard format.");
      }
      step("akc", 0x18, 0x34, payload, { flags: 0, preferred: 2 });
    }

    const completed = [];
    try {
      for (const { key, command, read, payload, options } of steps) {
        await this.put(command, slot, payload, options);
        await pause(100);
        if (key === "akc") await this.command(0x35, slot);
        const actual = body(await this.command(read, slot, options?.layer));
        const normalize = { base: decodeBase, actuation: decodeActuation, rapid: decodeRapid,
          upper: bytes => decodeColorPage(bytes, pad), lower: bytes => decodeColorPage(bytes, pad, false),
          map: bytes => decodeMap(bytes, pad), lightbar: bytes => lightbarFingerprint(bytes, colorHex) }[key];
        const canonical = bytes => JSON.stringify(normalize(bytes));
        const matches = normalize ? canonical(actual) === canonical(payload) : equal(actual, payload);
        if (!matches) throw new Error(`Read-back did not match for ${key}.`);
        completed.push(key);
      }
      if (completed.some(key => key === "upper" || key === "lower" || key === "core")) {
        await this.command(0x08, slot);
      }
    } catch (error) {
      throw new Error(`${error.message} ${completed.length} of ${steps.length} blocks matched read-back. Refresh before retrying.`);
    }
    return this.read(slot, layer);
  }

  async previewLighting(colors) {
    if (!this.previewAvailable) throw new Error("Live lighting is unavailable on this connection.");
    if (!this.previewing) {
      await this.command(0x21);
      this.previewing = true;
    }
    if (this.device.vendorId === 0x03eb) {
      await this.previewOriginalRgb(colors);
      return;
    }
    const packet = new Uint8Array(this.arm ? 255 : 256);
    packet.set([this.marker, magic[1], 0x0b]);
    const view = new DataView(packet.buffer);
    colors.flat().forEach((hex, index) => view.setUint16(3 + index * 2, colorWord(hex), true));
    if (this.arm) await this.output(packet, 5);
    else {
      const size = this.reports.some(report => report.id === 0 && report.size === 256) ? 256 : 64;
      for (let offset = 0; offset < packet.length; offset += size) {
        await this.device.sendReport(0, packet.subarray(offset, offset + size));
      }
    }
  }

  async previewOriginalRgb(colors) {
    // LED addresses of the original Atmel One and Two controllers.
    const addresses = [
      [0,-1,11,12,23,24,36,47,85,84,49,48,59,61,73,81,80,113,114,115,116],
      [2,1,14,13,26,25,35,38,37,87,86,95,51,63,75,72,74,96,97,98,99],
      [3,4,15,16,27,28,39,42,40,88,89,52,53,71,76,83,77,102,103,104,100],
      [5,6,17,18,29,30,41,46,44,90,93,54,57,65,-1,-1,-1,105,106,107,-1],
      [9,8,19,20,31,34,32,45,43,91,92,55,-1,66,-1,78,-1,108,109,110,101],
      [10,22,21,-1,-1,-1,33,-1,-1,-1,94,58,67,68,70,79,82,-1,111,112,-1],
    ];
    const limit = this.model.id === "one" ? 95 : 116;
    for (const [row, leds] of addresses.entries()) {
      for (const [col, led] of leds.entries()) {
        if (led < 0 || led > limit) continue;
        const value = parseInt(colors[row][col].slice(1), 16);
        const channels = [value & 255, (value >>> 8) & 255, value >>> 16];
        await this.command(0x1e, 0, 0, [...channels, led]);
        const alternate = led === 9 ? 7 : led === 65 ? 62 : null;
        if (alternate !== null) await this.command(0x1e, 0, 0, [...channels, alternate]);
      }
    }
  }

  async restoreLighting() {
    if (!this.previewing) return;
    await this.command(0x20);
    this.previewing = false;
  }

  async startMonitor(callback) {
    const device = this.analogDevice;
    if (!device) throw new Error("Reconnect and allow the keyboard’s analog interface to use the monitor.");
    const shouldClose = !device.opened;
    if (shouldClose) await device.open();
    this.travel = new Map();
    if (this.arm && this.analogPage === 0xff53) {
      this.travel = await this.readCalibration().catch(() => new Map());
    }
    const listener = event => {
      callback(decodeAnalogReport(event.data, this.analogPage));
    };
    device.addEventListener("inputreport", listener);
    return async () => {
      device.removeEventListener("inputreport", listener);
      if (shouldClose && device.opened) await device.close();
    };
  }

  async readCalibration() {
    let config = body(await this.command(0x52));
    if (!blobs(config, 2).length) config = body(await this.command(0x52, 1));
    if (!blobs(config, 2).length) return new Map();
    const first = body(await this.command(0x53));
    const switches = blobs(first, 1);
    const total = integer(first, 2) ?? switches.length;
    if (total > 255) return new Map();
    while (switches.length < total) {
      const next = blobs(body(await this.command(0x53, switches.length)), 1);
      if (!next.length) break;
      switches.push(...next);
    }
    return calibratedTravel(config, switches, layout(this.family, this.variant).flat().filter(key => !key.gap));
  }

  async close() {
    try {
      await this.restoreLighting();
    } finally {
      if (this.device.opened) await this.device.close();
    }
  }
}
