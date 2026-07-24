export interface IncidentAttachmentScanner {
  scan(input: {
    objectKey: string;
    verifiedMimeType: string;
    sizeBytes: number;
    sha256: string;
  }): Promise<{
    result: 'CLEAN' | 'INFECTED' | 'ERROR';
    engine: string;
    engineVersion?: string;
    signature?: string;
  }>;
}

// This is an integration boundary only. No scanner provider or automatic CLEAN
// implementation is registered in the application.
