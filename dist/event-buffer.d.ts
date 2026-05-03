/**
 * Event Buffer
 * Buffers events to disk during daemon outages.
 */
export declare function bufferEvent(event: Record<string, unknown>): Promise<void>;
export declare function flushEventBuffer(): Promise<void>;
export declare function getBufferedEventCount(): Promise<number>;
//# sourceMappingURL=event-buffer.d.ts.map