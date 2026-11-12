// Rasterize the Monero mark for Android's app icon, without external services.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const size = 1024;
const scanlines = Buffer.alloc((size * 4 + 1) * size);
const whiteMark = [
  [0, 15.825], [4.195, 15.825], [4.195, 5.729], [12, 13.545],
  [19.805, 5.730], [19.805, 15.825], [24, 15.825], [24, 18.236],
  [17.205, 18.236], [17.205, 11.885], [12.031, 17.096],
  [6.795, 11.886], [6.795, 18.237], [0, 18.237],
];
function inside(x, y) {
  let result = false;
  for (let i = 0, j = whiteMark.length - 1; i < whiteMark.length; j = i++) {
    const [xi, yi] = whiteMark[i], [xj, yj] = whiteMark[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result;
  }
  return result;
}
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const a = (x + 0.5 - 128) / 32, b = (y + 0.5 - 128) / 32;
  let color = [17, 17, 17];
  if ((a - 12) ** 2 + (b - 12) ** 2 <= 144) {
    color = b < 18.236 ? [255, 102, 0] : [76, 76, 76];
    if (inside(a, b)) color = [255, 255, 255];
  }
  const offset = y * (size * 4 + 1) + 1 + x * 4;
  scanlines.set([...color, 255], offset);
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, bytes) {
  const type = Buffer.from(name);
  const len = Buffer.alloc(4); len.writeUInt32BE(bytes.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, bytes])));
  return Buffer.concat([len, type, bytes, crc]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
header[8] = 8; header[9] = 6;
writeFileSync('artifacts/monero2014/assets/images/icon.png', Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0)),
]));
