import { BadRequestException } from '@nestjs/common';

import {
  MAX_NEWSROOM_IMAGE_BYTES,
  verifyNewsroomImage,
} from '../src/modules/media/newsroom-image-validation.js';

function file(originalname: string, mimetype: string, buffer: Buffer) {
  return { originalname, mimetype, buffer };
}

function png(): Buffer {
  const value = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(value);
  value.writeUInt32BE(640, 16);
  value.writeUInt32BE(360, 20);
  return value;
}

function jpeg(): Buffer {
  const value = Buffer.alloc(12);
  value.set([0xff, 0xd8, 0xff, 0xc0]);
  value.writeUInt16BE(7, 4);
  value.writeUInt16BE(360, 7);
  value.writeUInt16BE(640, 9);
  return value;
}

function webp(): Buffer {
  const value = Buffer.alloc(30);
  value.write('RIFF', 0, 'ascii');
  value.write('WEBP', 8, 'ascii');
  value.write('VP8X', 12, 'ascii');
  value.writeUIntLE(639, 24, 3);
  value.writeUIntLE(359, 27, 3);
  return value;
}

describe('newsroom image validation', () => {
  it.each([
    ['photo.jpg', 'image/jpeg', jpeg()],
    ['graphic.png', 'image/png', png()],
    ['picture.webp', 'image/webp', webp()],
  ])('accepts a valid %s image', (name, mimeType, buffer) => {
    const result = verifyNewsroomImage(file(name, mimeType, buffer));
    expect(result).toMatchObject({ mimeType, width: 640, height: 360 });
    expect(result.storageKey).toMatch(/^newsroom\/images\/\d{4}\/\d{2}\/[0-9a-f-]+$/);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a mismatched MIME type or spoofed extension', () => {
    expect(() => verifyNewsroomImage(file('photo.png', 'image/png', jpeg()))).toThrow(
      BadRequestException,
    );
    expect(() => verifyNewsroomImage(file('photo.exe', 'image/jpeg', jpeg()))).toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid signatures and oversized images', () => {
    expect(() =>
      verifyNewsroomImage(file('photo.jpg', 'image/jpeg', Buffer.from('not-image'))),
    ).toThrow(BadRequestException);
    expect(() =>
      verifyNewsroomImage(
        file('photo.jpg', 'image/jpeg', Buffer.alloc(MAX_NEWSROOM_IMAGE_BYTES + 1, 1)),
      ),
    ).toThrow(BadRequestException);
  });
});
