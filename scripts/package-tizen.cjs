// Builds tizen/TVBudget.wgt — a zip of config.xml + icon.png.
// A .wgt is just a zip with a fixed structure. Tizen Studio will sign it later.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TIZEN_DIR = path.join(__dirname, '..', 'tizen');
const OUT = path.join(TIZEN_DIR, 'TVBudget.wgt');

const FILES = ['config.xml', 'icon.png'];

function crc32(buf) {
  let c = ~0 >>> 0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function dosTime(d = new Date()) {
  const time =
    ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  const date =
    (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

const localParts = [];
const central = [];
let offset = 0;
const { time, date } = dosTime();

for (const name of FILES) {
  const data = fs.readFileSync(path.join(TIZEN_DIR, name));
  const compressed = zlib.deflateRawSync(data);
  const crc = crc32(data);
  const nameBuf = Buffer.from(name, 'utf8');

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // local file header sig
  local.writeUInt16LE(20, 4); // version
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(8, 8); // method = deflate
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(date, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  localParts.push(local, nameBuf, compressed);

  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4);
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0, 8);
  cen.writeUInt16LE(8, 10);
  cen.writeUInt16LE(time, 12);
  cen.writeUInt16LE(date, 14);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(compressed.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(nameBuf.length, 28);
  cen.writeUInt16LE(0, 30);
  cen.writeUInt16LE(0, 32);
  cen.writeUInt16LE(0, 34);
  cen.writeUInt16LE(0, 36);
  cen.writeUInt32LE(0, 38);
  cen.writeUInt32LE(offset, 42);
  central.push(cen, nameBuf);

  offset += local.length + nameBuf.length + compressed.length;
}

const localBuf = Buffer.concat(localParts);
const centralBuf = Buffer.concat(central);

const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(FILES.length, 8);
end.writeUInt16LE(FILES.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(localBuf.length, 16);
end.writeUInt16LE(0, 20);

fs.writeFileSync(OUT, Buffer.concat([localBuf, centralBuf, end]));
console.log(`Wrote ${OUT} (${fs.statSync(OUT).size} bytes)`);
console.log('Next: import the tizen/ folder into Tizen Studio, sign, and install on your TV.');
console.log('See tizen/README.md for full steps.');
