import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  service: 'garkuwa-api';
  timestamp: string;
}

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'garkuwa-api',
      timestamp: new Date().toISOString(),
    };
  }
}
