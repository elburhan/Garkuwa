import { BadRequestException } from '@nestjs/common';

import {
  createAttachmentObjectKey,
  sanitizeOriginalFilename,
  verifyAttachmentFile,
  verifyAttachmentSet,
  MAX_ATTACHMENT_BYTES,
} from '../src/modules/incidents/attachments/attachment-file-validation.js';

function png(width = 2, height = 3): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buffer);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpeg(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x03, 0x00,
    0x02, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9,
  ]);
}

function webp(): Buffer {
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(22, 4);
  buffer.write('WEBPVP8X', 8, 'ascii');
  buffer.writeUIntLE(1, 24, 3);
  buffer.writeUIntLE(2, 27, 3);
  return buffer;
}

describe('incident attachment validation', () => {
  it.each([
    ['photo.png', 'image/png', png(), 'image/png', 2, 3],
    ['photo.jpg', 'image/jpeg', jpeg(), 'image/jpeg', 2, 3],
    ['photo.webp', 'image/webp', webp(), 'image/webp', 2, 3],
    [
      'document.pdf',
      'application/pdf',
      Buffer.from('%PDF-1.7\n%%EOF'),
      'application/pdf',
      null,
      null,
    ],
  ])('accepts verified %s content', (name, browserMime, body, expectedMime, width, height) => {
    const result = verifyAttachmentFile({
      buffer: body,
      originalname: name,
      mimetype: browserMime,
    });
    expect(result).toMatchObject({
      verifiedMimeType: expectedMime,
      sizeBytes: body.length,
      width,
      height,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(result.body.equals(body)).toBe(true);
    expect(result.objectKey).not.toContain(name);
  });

  it.each([
    ['image.svg', 'image/svg+xml', Buffer.from('<svg/>')],
    ['program.exe', 'application/octet-stream', Buffer.from('MZ executable')],
    ['wrong.pdf', 'application/pdf', png()],
    ['empty.png', 'image/png', Buffer.alloc(0)],
    ['short.png', 'image/png', Buffer.from('89504e47', 'hex')],
  ])('rejects unsafe or mismatched %s', (originalname, mimetype, buffer) => {
    expect(() => verifyAttachmentFile({ buffer, originalname, mimetype })).toThrow(
      BadRequestException,
    );
  });

  it('uses verified bytes rather than an inconsistent browser MIME claim', () => {
    expect(
      verifyAttachmentFile({
        buffer: png(),
        originalname: 'proof.png',
        mimetype: 'application/octet-stream',
      }).verifiedMimeType,
    ).toBe('image/png');
  });

  it('sanitizes display names and generates non-identifying object keys', () => {
    expect(sanitizeOriginalFilename('../../secret\u0000name.pdf')).toBe('secretname.pdf');
    expect(sanitizeOriginalFilename('\u0000')).toBe('attachment');
    expect(sanitizeOriginalFilename('x'.repeat(300))).toHaveLength(255);
    expect(
      createAttachmentObjectKey(
        new Date('2026-07-23T00:00:00.000Z'),
        '52fc7e20-ab06-4f7c-8d3c-15f075275fd3',
      ),
    ).toBe('incidents/2026/07/52fc7e20-ab06-4f7c-8d3c-15f075275fd3');
  });

  it('calculates the known SHA-256 over exact bytes', () => {
    const body = Buffer.from('%PDF-1.7\nabc');
    expect(
      verifyAttachmentFile({
        buffer: body,
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
      }).sha256,
    ).toBe('3c1dd4f09e8ea551683a8c93d934c49084c2407fe2213a20d2702bad0296be10');
  });

  it('enforces count, individual and combined size limits', () => {
    const file = (buffer: Buffer) =>
      ({
        buffer,
        originalname: 'proof.png',
        mimetype: 'image/png',
      }) as Express.Multer.File;
    expect(() => verifyAttachmentSet(Array.from({ length: 6 }, () => file(png())))).toThrow(
      BadRequestException,
    );

    const oversized = Buffer.alloc(MAX_ATTACHMENT_BYTES + 1);
    png().copy(oversized);
    expect(() => verifyAttachmentSet([file(oversized)])).toThrow(BadRequestException);

    const nineMiB = Buffer.alloc(9 * 1024 * 1024);
    png().copy(nineMiB);
    expect(() => verifyAttachmentSet([file(nineMiB), file(nineMiB), file(nineMiB)])).toThrow(
      BadRequestException,
    );
  });
});
