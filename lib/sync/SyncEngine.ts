// Minimal SyncEngine stub - TODO: Implement proper offline sync
export class SyncEngine {
  constructor() {
    // Stub implementation
  }

  public dispose(): void {
    // Stub implementation
  }
}

export interface SyncQueueItem {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  data: any;
  localId?: string;
  retryCount: number;
  lastAttempt?: Date;
  createdAt: Date;
}

export interface SyncCursor {
  table: string;
  lastSyncedAt?: Date;
  lastToken?: string;
}

export interface SyncConflict {
  table: string;
  localRecord: any;
  remoteRecord: any;
  conflictType: 'update_conflict' | 'delete_conflict' | 'create_conflict';
  resolvedData?: any;
}