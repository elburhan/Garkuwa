import { createHash, randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';

import { BadRequestException } from '@nestjs/common';

export const MAX_NEWSROOM_IMAGE_BYTES = 8 * 1024 * 1024;
const mimeByExtension: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function detectedMime(buffer: Buffer): string | null {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
    return 'image/png';
  if (buffer.length >= 10 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return 'image/jpeg';
  if (
    buffer.length >= 30 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

function jpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1]!;
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (length < 2) return null;
    offset += length + 2;
  }
  return null;
}

function dimensions(mimeType: string, buffer: Buffer): { width: number; height: number } | null {
  if (mimeType === 'image/png')
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (mimeType === 'image/jpeg') return jpegDimensions(buffer);
  if (mimeType === 'image/webp' && buffer.toString('ascii', 12, 16) === 'VP8X') {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  return null;
}

export function verifyNewsroomImage(
  file: Pick<Express.Multer.File, 'buffer' | 'originalname' | 'mimetype'>,
) {
  if (!file.buffer.length) throw new BadRequestException('The image file is empty.');
  if (file.buffer.length > MAX_NEWSROOM_IMAGE_BYTES)
    throw new BadRequestException('The image exceeds the 8 MiB limit.');
  const mimeType = detectedMime(file.buffer);
  const normalizedFilename = basename(file.originalname).normalize('NFKC');
  const filename = Array.from(normalizedFilename)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join('')
    .trim()
    .slice(0, 255);
  if (
    !mimeType ||
    file.mimetype !== mimeType ||
    mimeByExtension[extname(filename).toLowerCase()] !== mimeType
  ) {
    throw new BadRequestException('Image type, filename, and file signature must match.');
  }
  const imageSize = dimensions(mimeType, file.buffer);
  if (
    !imageSize ||
    imageSize.width < 1 ||
    imageSize.height < 1 ||
    imageSize.width > 12_000 ||
    imageSize.height > 12_000
  ) {
    throw new BadRequestException('Image dimensions are invalid or unsupported.');
  }
  const now = new Date();
  return {
    body: file.buffer,
    originalFilename: filename || 'image',
    mimeType,
    sizeBytes: file.buffer.length,
    width: imageSize.width,
    height: imageSize.height,
    sha256: createHash('sha256').update(file.buffer).digest('hex'),
    storageKey: `newsroom/images/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`,
  };
}
