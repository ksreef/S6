// Generates the jumpscare ghost sprite procedurally and writes it as a
// real PNG, so the repo ships no third-party artwork and no image deps.
// Run once: deno run --allow-write scripts/make-ghost.ts

const SIZE = 512;
const CX = 256;
const HEAD_CY = 235;
const HEAD_R = 150;
const OUT_PATH = new URL("../src/assets/ghost.png", import.meta.url);

function main(): void {
  const rgba = rasterizeGhost();
  addGlow(rgba);
  const png = encodePng(SIZE, SIZE, rgba);
  Deno.writeFileSync(OUT_PATH, png);
  console.log(`Wrote ${OUT_PATH.href} (${png.length} bytes)`);
}

/** True when the point lies inside the ghost's body silhouette. */
function insideGhost(x: number, y: number): boolean {
  const dx = x - CX;
  const dy = y - HEAD_CY;
  if (dx * dx + dy * dy <= HEAD_R * HEAD_R) {
    return true; // dome-shaped head
  }
  if (y < HEAD_CY) {
    return false;
  }
  const t = Math.min(1, (y - HEAD_CY) / 235);
  if (Math.abs(dx) > HEAD_R - 32 * t * t) {
    return false; // skirt tapers toward the hem
  }
  const hem = 470 + 20 * Math.sin((x - CX) * ((2 * Math.PI) / 120));
  return y <= hem; // tattered wavy bottom
}

function insideEllipse(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): boolean {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return nx * nx + ny * ny <= 1;
}

/** Hollow eyes and a screaming mouth. */
function insideDark(x: number, y: number): boolean {
  return insideEllipse(x, y, 196, 232, 27, 36) ||
    insideEllipse(x, y, 316, 232, 27, 36) ||
    insideEllipse(x, y, 256, 322, 30, 38);
}

/** Rasterize with 3x3 supersampling for smooth edges. */
function rasterizeGhost(): Uint8Array {
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      let bodyHits = 0;
      let darkHits = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const x = px + (sx + 0.5) / 3;
          const y = py + (sy + 0.5) / 3;
          if (!insideGhost(x, y)) {
            continue;
          }
          bodyHits += 1;
          if (insideDark(x, y)) {
            darkHits += 1;
          }
        }
      }
      const bodyAlpha = bodyHits / 9;
      const darkAlpha = darkHits / 9;
      const index = (py * SIZE + px) * 4;
      if (darkAlpha > 0.45 && bodyAlpha > 0.3) {
        rgba[index] = 10;
        rgba[index + 1] = 10;
        rgba[index + 2] = 22;
        rgba[index + 3] = 235;
      } else if (bodyAlpha > 0) {
        rgba[index] = 240;
        rgba[index + 1] = 244;
        rgba[index + 2] = 255;
        rgba[index + 3] = Math.round(238 * bodyAlpha);
      }
    }
  }
  return rgba;
}

/** Soft pale-blue aura around the silhouette. */
function addGlow(rgba: Uint8Array): void {
  const alpha = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = rgba[i * 4 + 3]!;
  }
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const index = (py * SIZE + px) * 4;
      if (rgba[index + 3]! > 0) {
        continue; // glow only outside the body
      }
      let sum = 0;
      let samples = 0;
      for (let oy = -2; oy <= 2; oy++) {
        const yy = py + oy;
        if (yy < 0 || yy >= SIZE) {
          continue;
        }
        for (let ox = -2; ox <= 2; ox++) {
          const xx = px + ox;
          if (xx < 0 || xx >= SIZE) {
            continue;
          }
          sum += alpha[yy * SIZE + xx]!;
          samples += 1;
        }
      }
      const blurred = sum / Math.max(1, samples);
      if (blurred >= 6) {
        rgba[index] = 150;
        rgba[index + 1] = 172;
        rgba[index + 2] = 255;
        rgba[index + 3] = Math.min(110, Math.round(blurred * 2));
      }
    }
  }
}

// --- Minimal PNG encoder (RGBA, no compression beyond stored blocks) -------

function encodePng(
  width: number,
  height: number,
  rgba: Uint8Array,
): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // Raw scanlines: each row prefixed with filter byte 0 (None).
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    raw.set(
      rgba.subarray(y * width * 4, (y + 1) * width * 4),
      y * (1 + width * 4) + 1,
    );
  }
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = pngChunk("IHDR", ihdr);
  const idatChunk = pngChunk("IDAT", zlibStored(raw));
  const iendChunk = pngChunk("IEND", new Uint8Array(0));
  const total = signature.length + ihdrChunk.length + idatChunk.length +
    iendChunk.length;
  const png = new Uint8Array(total);
  let offset = 0;
  for (const part of [signature, ihdrChunk, idatChunk, iendChunk]) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

/** zlib stream made of stored (uncompressed) deflate blocks. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const maxBlock = 65535;
  const blockCount = Math.max(1, Math.ceil(raw.length / maxBlock));
  const out = new Uint8Array(2 + raw.length + blockCount * 5 + 4);
  let offset = 0;
  out[offset++] = 0x78;
  out[offset++] = 0x01;
  for (let i = 0; i < blockCount; i++) {
    const start = i * maxBlock;
    const size = Math.min(maxBlock, raw.length - start);
    out[offset++] = i === blockCount - 1 ? 1 : 0; // BFINAL + BTYPE=00
    out[offset++] = size & 0xff;
    out[offset++] = (size >> 8) & 0xff;
    out[offset++] = ~size & 0xff;
    out[offset++] = (~size >> 8) & 0xff;
    out.set(raw.subarray(start, start + size), offset);
    offset += size;
  }
  const adler = adler32(raw);
  out[offset++] = (adler >>> 24) & 0xff;
  out[offset++] = (adler >>> 16) & 0xff;
  out[offset++] = (adler >>> 8) & 0xff;
  out[offset++] = adler & 0xff;
  return out.subarray(0, offset);
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return (((b << 16) | a) >>> 0) % 4294967296;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

main();
