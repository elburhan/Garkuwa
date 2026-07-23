import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordHasherService {
  private readonly dummyHash = this.hash('not-a-staff-password-dummy-value');

  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  async verifyAgainstHashOrDummy(
    passwordHash: string | undefined,
    password: string,
  ): Promise<boolean> {
    return this.verify(passwordHash ?? (await this.dummyHash), password);
  }
}
