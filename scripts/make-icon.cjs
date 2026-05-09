// Generates tizen/icon.png — red apple with "ADAM'S APPLE" text, green leaf.
const fs = require('fs');
const zlib = require('zlib');

const W = 512, H = 512;
const raw = Buffer.alloc(W * H * 4 + H);
for (let y = 0; y < H; y++) raw[y * (W * 4 + 1)] = 0; // filter byte = 0

function px(x, y, r, g, b, a) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = y * (W * 4 + 1) + 1 + x * 4;
  raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
}

// Apple body: two lobes on top + lower oval
function appleShape(x, y) {
  const cx = W / 2, cy = H / 2 + 30;
  const dx = x - cx, dy = y - cy;
  const lobeR = 170;
  const dxL = x - (cx - 75), dyTop = y - (cy - 30);
  const dxR = x - (cx + 75);
  const inLeft = Math.sqrt(dxL * dxL + dyTop * dyTop) <= lobeR;
  const inRight = Math.sqrt(dxR * dxR + dyTop * dyTop) <= lobeR;
  const inBot = (dx * dx) / (210 * 210) + ((dy - 50) * (dy - 50)) / (200 * 200) <= 1;
  return inLeft || inRight || inBot;
}

// Glossy highlight
function highlight(x, y) {
  const dx = x - (W / 2 - 100), dy = y - (H / 2 - 30);
  return (dx * dx) / (40 * 40) + (dy * dy) / (90 * 90) <= 1;
}

// Fill apple body
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!appleShape(x, y)) continue;
    const cy = H / 2 + 30;
    const dy = y - cy;
    const t = Math.max(0, Math.min(1, (dy + 200) / 400));
    // Bright red gradient (top brighter, bottom slightly darker)
    const r = Math.round(230 - t * 30);
    const g = Math.round(40 + t * 10);
    const b = Math.round(50 + t * 5);
    px(x, y, r, g, b, 255);
    if (highlight(x, y)) px(x, y, 255, 210, 210, 255);
  }
}

// Dark red outline
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!appleShape(x, y)) continue;
    let edge = false;
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
      if (!appleShape(x + dx, y + dy)) { edge = true; break; }
    }
    if (edge) px(x, y, 110, 15, 20, 255);
  }
}

// Stem
for (let y = 70; y < 175; y++) {
  for (let x = 240; x < 295; x++) {
    const dx = x - 268, dy = y - 122;
    if ((dx * dx) / (12 * 12) + (dy * dy) / (55 * 55) <= 1) px(x, y, 90, 55, 30, 255);
  }
}

// Leaf — green oval, tilted
for (let y = 70; y < 175; y++) {
  for (let x = 270; x < 400; x++) {
    const lx = x - 330, ly = y - 115;
    // rotate 25deg
    const a = -Math.PI / 7;
    const rx = lx * Math.cos(a) - ly * Math.sin(a);
    const ry = lx * Math.sin(a) + ly * Math.cos(a);
    if ((rx * rx) / (60 * 60) + (ry * ry) / (22 * 22) <= 1) {
      px(x, y, 40, 165, 70, 255);
      // leaf vein
      if (Math.abs(ry) < 2) px(x, y, 25, 110, 45, 255);
    }
  }
}

// 5x7 pixel font with each glyph as array of strings
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  "'": ['00100', '00100', '00100', '00000', '00000', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function drawText(text, startX, startY, scale, color) {
  let cx = startX;
  for (const ch of text) {
    const g = FONT[ch] || FONT[' '];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (g[r][c] === '1') {
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              px(cx + c * scale + dx, startY + r * scale + dy, color[0], color[1], color[2], 255);
            }
          }
        }
      }
    }
    cx += 6 * scale;
  }
}

// Center the text horizontally:
// "ADAM'S" = 6 chars * 6 * scale  (last char no trailing gap, but we keep formula simple)
// "APPLE"  = 5 chars * 6 * scale
const SCALE = 9;
const adamsW = 6 * 6 * SCALE; // 324
const appleW = 5 * 6 * SCALE; // 270
drawText("ADAM'S", Math.round(W / 2 - adamsW / 2 + 8), 235, SCALE, [255, 255, 255]);
drawText("APPLE",  Math.round(W / 2 - appleW / 2 + 8), 320, SCALE, [255, 255, 255]);

// PNG encode
function crc32(buf) {
  let c = ~0 >>> 0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const tag = Buffer.from(type);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([len, tag, data, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA

const idat = zlib.deflateSync(raw);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync('tizen/icon.png', png);
console.log('wrote tizen/icon.png', png.length, 'bytes');
