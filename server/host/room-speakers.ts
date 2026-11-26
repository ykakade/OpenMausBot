export interface RoomSpeaker { botId: string; name: string; color: string; since?: number }

export interface RoomThreadWorkingDeps {
  /** Each room thread's speaking member, from its claim until its turn ends. */
  speakers: Map<string, RoomSpeaker>;
  /** A room turn operation, not cancelled, is setting up or running on the thread. */
  operation(groupId: string, threadId: string): boolean;
  /** An engine has the thread's turn, that turn has started and not ended, or its end is still settling. */
  engineTurn(threadId: string): boolean;
  /** The bot is marked busy: a room member is, from its claim until its turn ends. */
  botBusy(botId: string): boolean;
  /** The room lost a speaker: record whoever still speaks in it as its busy member. */
  cleared(groupId: string): void;
  log(line: string): void;
}

/** Whether a room thread has a turn. A speaker with no turn behind it holds every queued room node and message, and
 * no turn's end will ever free it, so it is cleared here. */
export function createRoomThreadWorking(deps: RoomThreadWorkingDeps) {
  return (groupId: string, threadId: string): boolean => {
    if (deps.operation(groupId, threadId)) return true;
    const speaker = deps.speakers.get(threadId);
    if (!speaker) return false;
    if (deps.engineTurn(threadId) || deps.botBusy(speaker.botId)) return true;
    deps.speakers.delete(threadId);
    deps.cleared(groupId);
    deps.log(`[rooms] cleared ${speaker.name} (${speaker.botId}) as the speaker in room ${groupId} thread ${threadId}: no turn runs there`);
    return false;
  };
}
