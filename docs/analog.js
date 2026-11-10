import { blobs, integer, integers } from "./proto.js";

export const analogPages = [0xff53, 0xff54];

export function decodeAnalogReport(data, page) {
  const readings = new Map();
  const auxiliary = new Map();
  const physical = page === 0xff53;
  const size = physical ? 4 : 3;
  for (let offset = 0; offset + size <= data.byteLength; offset += size) {
    if (physical) {
      const index = data.getUint8(offset);
      const packed = data.getUint8(offset + 2);
      const depth = (data.getUint8(offset + 3) << 2) | (packed >>> 6);
      const namespace = (packed >>> 2) & 15;
      if (!depth || ![0, 3, 4, 5, 6].includes(namespace)) continue;
      const target = namespace === 6 ? auxiliary : readings;
      const prior = target.get(index);
      target.set(index, { index, fraction: Math.max(depth / 1023, prior?.fraction ?? 0),
        actuated: Boolean(packed & 1) || Boolean(prior?.actuated) });
    } else {
      const usage = data.getUint16(offset);
      const depth = data.getUint8(offset + 2);
      if (usage && depth) readings.set(`usage/${usage}`, { usage, fraction: depth / 255 });
    }
  }
  for (const [index, reading] of auxiliary) if (!readings.has(index)) readings.set(index, reading);
  return readings;
}

export function calibratedTravel(config, switches, keys) {
  const limits = new Map();
  for (const entry of switches) {
    const steps = integer(entry, 2);
    const max = integer(entry, 4);
    if (steps > 0 && max > 0) limits.set(integer(entry, 1) ?? 0, { steps, max });
  }
  const distance = entry => {
    if (!entry) return undefined;
    const type = limits.get(integer(entry, 1) ?? 0);
    if (!type) return undefined;
    const travel = (type.max - (integer(entry, 3) ?? 0)) / type.steps;
    return travel > 0 && travel <= 6 ? travel : undefined;
  };
  const base = distance(blobs(config, 2)[0]);
  const byKey = new Map(keys.map(key => [key.id, base]));
  for (const sensor of blobs(config, 1)) {
    for (const group of blobs(sensor, 1)) {
      const override = distance(blobs(group, 2)[0]);
      for (const id of integers(group, 1)) if (byKey.has(id)) byKey.set(id, override);
    }
  }
  return byKey;
}
