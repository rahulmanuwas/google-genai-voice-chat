/**
 * Data channel tool bridge for robot participants.
 *
 * When a robot participant (identity starting with "robot") is in the room,
 * tool calls with the `livekit-data://` endpoint marker are routed through
 * LiveKit data channel instead of HTTP.
 *
 * Protocol:
 *   Agent → Robot: { "type": "tool_call", "id": "abc123", "name": "robot_dance", "args": { ... } }
 *   Robot → Agent: { "type": "tool_result", "id": "abc123", "result": "..." }
 */

import type { JobContext } from '@livekit/agents';
import type { RoomServiceClient } from 'livekit-server-sdk';
import crypto from 'node:crypto';

const ROBOT_IDENTITY_PREFIX = 'robot';
const DEFAULT_TIMEOUT_MS = 30_000;

interface PendingResult {
  resolve: (result: string) => void;
  timer: ReturnType<typeof setTimeout>;
  toolName: string;
  args: Record<string, unknown>;
  startedAt: number;
}

/** Callback invoked after a data channel tool execution completes */
export type OnToolExecuted = (
  toolName: string,
  args: Record<string, unknown>,
  result: string,
  durationMs: number,
  status: 'success' | 'timeout' | 'error',
) => void;

interface ChunkBuffer {
  chunks: Map<number, string>;
  total: number;
}

export class DataChannelToolBridge {
  private pendingResults = new Map<string, PendingResult>();
  private chunkBuffers = new Map<string, ChunkBuffer>();
  private listening = false;

  constructor(
    private ctx: JobContext,
    private roomService: RoomServiceClient,
    private onToolExecuted?: OnToolExecuted,
  ) {}

  /**
   * Start listening for data channel messages (tool results from robot).
   * Safe to call multiple times — only attaches listeners once.
   */
  startListening(): void {
    if (this.listening) return;
    this.listening = true;

    const room = this.ctx.room as any;

    room.on('dataReceived', (payload: Uint8Array, _participant: any) => {
      this.handleDataReceived(payload);
    });

    room.on('participantConnected', (participant: any) => {
      if (participant.identity?.startsWith(ROBOT_IDENTITY_PREFIX)) {
        console.log(`[data-channel-tools] Robot connected: ${participant.identity}`);
      }
    });

    room.on('participantDisconnected', (participant: any) => {
      if (participant.identity?.startsWith(ROBOT_IDENTITY_PREFIX)) {
        console.log(`[data-channel-tools] Robot disconnected: ${participant.identity}`);
      }
    });

    const existing = this.findRobotParticipant();
    if (existing) {
      console.log(`[data-channel-tools] Robot already in room: ${existing.identity}`);
    } else {
      console.log('[data-channel-tools] Waiting for robot to join...');
    }
  }

  /**
   * Send a tool call to the robot and wait for the result.
   */
  async sendToolCall(
    toolName: string,
    args: Record<string, unknown>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<string> {
    const callId = crypto.randomUUID().slice(0, 8);
    const startedAt = Date.now();

    const robot = this.findRobotParticipant();
    if (!robot) {
      const result = 'Error: Robot is not connected to the room';
      this.notifyExecuted(toolName, args, result, startedAt, 'error');
      return result;
    }

    const roomName = this.ctx.room.name;
    if (!roomName) {
      const result = 'Error: Room name not available';
      this.notifyExecuted(toolName, args, result, startedAt, 'error');
      return result;
    }

    const message = JSON.stringify({
      type: 'tool_call',
      id: callId,
      name: toolName,
      args,
    });

    const data = new TextEncoder().encode(message);

    console.log(`[data-channel-tools] Sending tool call: ${toolName}(${JSON.stringify(args)}) id=${callId}`);

    // Create promise that resolves when robot sends back result
    const resultPromise = new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingResults.delete(callId);
        const result = `Error: Tool call '${toolName}' timed out after ${timeoutMs / 1000}s`;
        this.notifyExecuted(toolName, args, result, startedAt, 'timeout');
        resolve(result);
      }, timeoutMs);

      this.pendingResults.set(callId, { resolve, timer, toolName, args, startedAt });
    });

    // Send via LiveKit server API (bypasses client-side protobuf issues)
    try {
      await this.roomService.sendData(roomName, data, 1 /* RELIABLE */, {
        destinationIdentities: [robot.identity],
        topic: 'robot-tools',
      });
      console.log(`[data-channel-tools] Sent tool call via server API to ${robot.identity}`);
    } catch (err) {
      console.error(`[data-channel-tools] Failed to send data to robot:`, err);
      this.pendingResults.delete(callId);
      const result = `Error: Failed to send command to robot: ${err}`;
      this.notifyExecuted(toolName, args, result, startedAt, 'error');
      return result;
    }

    return resultPromise;
  }

  /**
   * Check if a robot participant is in the room.
   */
  hasRobotParticipant(): boolean {
    return this.findRobotParticipant() !== null;
  }

  private findRobotParticipant(): { identity: string } | null {
    const room = this.ctx.room as any;
    if (room.remoteParticipants) {
      for (const [, participant] of room.remoteParticipants) {
        if (participant.identity?.startsWith(ROBOT_IDENTITY_PREFIX)) {
          return participant;
        }
      }
    }
    return null;
  }

  private handleDataReceived(payload: Uint8Array): void {
    try {
      const json = new TextDecoder().decode(payload);
      const message = JSON.parse(json);

      if (message.type === 'tool_result' && message.id) {
        const pending = this.pendingResults.get(message.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingResults.delete(message.id);
          const result = message.result ?? 'Action completed';
          const logResult = result.length > 200 ? `${result.slice(0, 200)}... (${result.length} chars)` : result;
          console.log(`[data-channel-tools] Received result for ${message.id}: ${logResult}`);
          this.notifyExecuted(pending.toolName, pending.args, result, pending.startedAt, 'success');
          pending.resolve(result);
        }
      } else if (message.type === 'tool_result_chunk' && message.id) {
        // Chunked result — buffer until all chunks received
        const { id, index, total, data } = message;
        let buffer = this.chunkBuffers.get(id);
        if (!buffer) {
          buffer = { chunks: new Map(), total };
          this.chunkBuffers.set(id, buffer);
        }
        buffer.chunks.set(index, data);

        if (buffer.chunks.size === buffer.total) {
          // All chunks received — reassemble in order
          const parts: string[] = [];
          for (let i = 0; i < buffer.total; i++) {
            parts.push(buffer.chunks.get(i) ?? '');
          }
          const result = parts.join('');
          this.chunkBuffers.delete(id);

          console.log(`[data-channel-tools] Reassembled ${buffer.total} chunks for ${id} (${result.length} chars)`);

          const pending = this.pendingResults.get(id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingResults.delete(id);
            this.notifyExecuted(pending.toolName, pending.args, result, pending.startedAt, 'success');
            pending.resolve(result);
          }
        } else {
          console.log(`[data-channel-tools] Chunk ${index + 1}/${total} for ${id}`);
        }
      }
    } catch (err) {
      console.error('[data-channel-tools] Failed to parse data message:', err);
    }
  }

  /** Best-effort notification — never throws */
  private notifyExecuted(
    toolName: string,
    args: Record<string, unknown>,
    result: string,
    startedAt: number,
    status: 'success' | 'timeout' | 'error',
  ): void {
    if (!this.onToolExecuted) return;
    try {
      this.onToolExecuted(toolName, args, result, Date.now() - startedAt, status);
    } catch (err) {
      console.warn('[data-channel-tools] onToolExecuted callback error:', err);
    }
  }
}
