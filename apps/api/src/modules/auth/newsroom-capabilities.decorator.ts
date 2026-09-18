import type { NewsroomCapability } from '@garkuwa/contracts';
import { SetMetadata } from '@nestjs/common';

export const NEWSROOM_CAPABILITIES_METADATA = 'newsroom-capabilities';
export const NewsroomCapabilities = (...capabilities: readonly NewsroomCapability[]) =>
  SetMetadata(NEWSROOM_CAPABILITIES_METADATA, capabilities);
