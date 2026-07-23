import { createHash, randomUUID } from 'node:crypto';
import { extname, basename } from 'node:path';

import { BadRequestException } from '@nestjs/common';

export const MAX_ATTACHMENT_FILES = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const mimeByExtension: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

export interface VerifiedAttachment {
  body: Buffer;
  originalFilename: string;
  verifiedMimeType: string;
  sizeBytes: number;
  sha256: string;
  width: number | null;
  height: number | null;
  pageCount: null;
  objectKey: string;
}

export function sanitizeOriginalFilename(value: string): string {
  const withoutControls = [...basename(value)]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    })
    .join('');
  const cleaned = withoutControls.normalize('NFKC').trim().slice(0, 255);
  return cleaned || 'attachment';
}

export function createAttachmentObjectKey(now = new Date(), id = randomUUID()): string {
  return `incidents/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}`;
}

function verifiedMime(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

function jpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1]!;
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker) && offset + 8 < buffer.length) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function imageDimensions(mime: string, buffer: Buffer): { width: number; height: number } | null {
  if (mime === 'image/png' && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mime === 'image/jpeg') return jpegDimensions(buffer);
  if (mime === 'image/webp' && buffer.length >= 30 && buffer.toString('ascii', 12, 16) === 'VP8X') {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  return null;
}

export function verifyAttachmentFile(input: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}): VerifiedAttachment {
  if (input.buffer.length === 0) throw new BadRequestException('Attachment files cannot be empty.');
  if (input.buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new BadRequestException('An attachment exceeds the 10 MiB limit.');
  }
  const mime = verifiedMime(input.buffer);
  if (!mime) throw new BadRequestException('Attachment content is unsupported or invalid.');
  const filename = sanitizeOriginalFilename(input.originalname);
  const extensionMime = mimeByExtension[extname(filename).toLowerCase()];
  if (extensionMime !== mime) {
    throw new BadRequestException('Attachment filename and content do not match.');
  }
  const dimensions = imageDimensions(mime, input.buffer);
  if (mime.startsWith('image/') && (!dimensions || dimensions.width < 1 || dimensions.height < 1)) {
    throw new BadRequestException('Image metadata is invalid or unsupported.');
  }
  return {
    body: input.buffer,
    originalFilename: filename,
    verifiedMimeType: mime,
    sizeBytes: input.buffer.length,
    sha256: createHash('sha256').update(input.buffer).digest('hex'),
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    pageCount: null,
    objectKey: createAttachmentObjectKey(),
  };
}

export function verifyAttachmentSet(files: Express.Multer.File[]): VerifiedAttachment[] {
  if (files.length < 1 || files.length > MAX_ATTACHMENT_FILES) {
    throw new BadRequestException('Submit between one and five attachments.');
  }
  const verified = files.map((file) =>
    verifyAttachmentFile({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    }),
  );
  if (verified.reduce((total, file) => total + file.sizeBytes, 0) > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new BadRequestException('Combined attachments exceed the 25 MiB limit.');
  }
  return verified;
}
