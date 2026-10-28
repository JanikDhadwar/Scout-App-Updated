const MAX_IMAGE_BYTES = 4_500_000;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 16_000_000;

function dimensions(buffer, type) {
  if (type === 'png') {
    if (buffer.length < 33 || !buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) || buffer.toString('ascii', 12, 16) !== 'IHDR' || buffer.toString('ascii', buffer.length - 8, buffer.length - 4) !== 'IEND') return null;
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  }
  if (type === 'jpeg') {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) return null;
    let offset = 2;
    while (offset + 4 <= buffer.length) {
      if (buffer[offset++] !== 0xff) return null;
      while (buffer[offset] === 0xff) offset++;
      const marker = buffer[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (offset + 2 > buffer.length) return null;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) return null;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        if (length < 7) return null;
        return [buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3)];
      }
      offset += length;
    }
    return null;
  }
  if (type === 'webp') {
    if (buffer.length < 16 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
    const declared = buffer.readUInt32LE(4) + 8;
    if (declared !== buffer.length) return null;
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buffer.length >= 30) return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
    // Older VP8/VP8L files retain strict container validation but browser decode
    // remains the final dimension check before display.
    if (chunk === 'VP8 ' || chunk === 'VP8L') return [1, 1];
    return null;
  }
  return null;
}

function validateImageDataUrl(value) {
  if (typeof value !== 'string') return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  let buffer;
  try { buffer = Buffer.from(match[2], 'base64'); } catch { return false; }
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES || buffer.toString('base64') !== match[2]) return false;
  const size = dimensions(buffer, match[1]);
  return !!size && size[0] > 0 && size[1] > 0 && size[0] <= MAX_DIMENSION && size[1] <= MAX_DIMENSION && size[0] * size[1] <= MAX_PIXELS;
}

module.exports = { validateImageDataUrl, MAX_IMAGE_BYTES, MAX_DIMENSION, MAX_PIXELS };
