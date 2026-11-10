// Minimal protobuf wire codec. Unedited fields are kept byte-for-byte.
export function join(parts) {
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function varint(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Invalid integer");
  const bytes = [];
  do {
    const part = value % 128;
    value = Math.floor(value / 128);
    bytes.push(part | (value ? 128 : 0));
  } while (value);
  return Uint8Array.from(bytes);
}

function readInteger(data, offset) {
  let value = 0;
  let multiplier = 1;
  while (offset < data.length && multiplier <= 2 ** 49) {
    const byte = data[offset++];
    value += (byte & 127) * multiplier;
    if (!(byte & 128) && Number.isSafeInteger(value)) return [value, offset];
    multiplier *= 128;
  }
  throw new Error("Invalid or truncated profile integer.");
}

export function fields(data) {
  const result = [];
  let offset = 0;
  while (offset < data.length) {
    const start = offset;
    const [tag, next] = readInteger(data, offset);
    const number = Math.floor(tag / 8);
    const wire = tag % 8;
    if (!number) throw new Error("Invalid profile field.");
    offset = next;
    let value;
    if (wire === 0) {
      [value, offset] = readInteger(data, offset);
    } else if (wire === 2) {
      const [length, bodyStart] = readInteger(data, offset);
      offset = bodyStart + length;
      value = data.subarray(bodyStart, offset);
    } else if (wire === 1 || wire === 5) {
      offset += wire === 1 ? 8 : 4;
    } else {
      throw new Error("Unsupported profile field encoding.");
    }
    if (offset > data.length) throw new Error("Truncated profile field.");
    result.push({ number, wire, value, bytes: data.subarray(start, offset) });
  }
  return result;
}

export function field(number, value) {
  if (value instanceof Uint8Array) {
    return join([varint(number * 8 + 2), varint(value.length), value]);
  }
  return join([varint(number * 8), varint(value)]);
}

export function replaceField(data, number, values) {
  const existing = fields(data);
  const output = [];
  let inserted = false;
  for (const entry of existing) {
    if (entry.number !== number) {
      output.push(entry.bytes);
    } else if (!inserted) {
      output.push(...values.map(value => field(number, value)));
      inserted = true;
    }
  }
  if (!inserted) output.push(...values.map(value => field(number, value)));
  return join(output);
}

export function integers(data, number) {
  const result = [];
  for (const entry of fields(data)) {
    if (entry.number !== number) continue;
    if (entry.wire === 0) result.push(entry.value);
    if (entry.wire !== 2) continue;
    for (let offset = 0; offset < entry.value.length;) {
      const [value, next] = readInteger(entry.value, offset);
      result.push(value);
      offset = next;
    }
  }
  return result;
}

export function blobs(data, number) {
  return fields(data).filter(entry => entry.number === number && entry.wire === 2)
    .map(entry => entry.value);
}

export function integer(data, number) {
  return fields(data).find(entry => entry.number === number && entry.wire === 0)?.value;
}
