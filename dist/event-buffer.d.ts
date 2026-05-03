/**
 * Event Buffer
 * Buffers sanitized events to disk before daemon ingestion.
 * PostToolBatch and terminal hooks flush the buffer to /v1/events/batch.
 */
export type BufferEventResult = {
    status: 'buffered';
    file: string;
} | {
    status: 'failed';
    file: string;
    error: string;
};
export type FlushEventBufferResult = {
    status: 'intentionally_skipped';
    reason: 'empty_buffer';
} | {
    status: 'sent_to_daemon';
    workspaceCount: number;
    eventCount: number;
} | {
    status: 'failed';
    workspaceCount: number;
    eventCount: number;
    error: string;
};
export declare function bufferEvent(event: Record<string, unknown>): Promise<BufferEventResult>;
export declare function flushEventBuffer(): Promise<FlushEventBufferResult>;
export declare function getBufferedEventCount(): Promise<number>;
//# sourceMappingURL=event-buffer.d.ts.map