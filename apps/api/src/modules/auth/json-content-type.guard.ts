import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import type { StaffAuthRequest } from './auth.types.js';

@Injectable()
export class JsonContentTypeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<StaffAuthRequest>();
    const contentType = request.headers['content-type'];
    if (typeof contentType !== 'string' || !/^application\/json(?:\s*;|$)/i.test(contentType)) {
      throw new UnsupportedMediaTypeException('Content-Type must be application/json.');
    }
    return true;
  }
}
