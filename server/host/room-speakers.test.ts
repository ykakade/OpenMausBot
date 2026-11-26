import { describe, expect, it } from "vitest";

import { createRoomThreadWorking, type RoomSpeaker, type RoomThreadWorkingDeps } from "./room-speakers.ts";

const ada: RoomSpeaker = { botId: "bot-ada", name: "Ada", color: "#123456", since: 1 };

function room(over: Partial<RoomThreadWorkingDeps> = {}) {
  const speakers = new Map<string, RoomSpeaker>([["t-room", ada]]);
  const cleared: string[] = [], logs: string[] = [];
  const working = createRoomThreadWorking({
    speakers, operation: () => false, engineTurn: () => false, botBusy: () => false,
    cleared: (groupId) => cleared.push(groupId), log: (line) => logs.push(line), ...over,
  });
  return { working, speakers, cleared, logs };
}

describe("whether a room thread has a turn", () => {
  it("keeps a speaker while an engine has the turn, or its end settles", () => {
    const { working, speakers, cleared } = room({ engineTurn: (threadId) => threadId === "t-room" });
    expect(working("room-1", "t-room")).toBe(true);
    expect(speakers.get("t-room")).toBe(ada);
    expect(cleared).toEqual([]);
  });

  it("keeps a speaker whose bot is still marked busy, as it is during setup", () => {
    const { working, speakers } = room({ botBusy: (botId) => botId === "bot-ada" });
    expect(working("room-1", "t-room")).toBe(true);
    expect(speakers.has("t-room")).toBe(true);
  });

  it("is working while a room turn operation runs on the thread, and leaves its speaker alone", () => {
    const { working, speakers } = room({ operation: (groupId, threadId) => groupId === "room-1" && threadId === "t-room" });
    expect(working("room-1", "t-room")).toBe(true);
    expect(speakers.has("t-room")).toBe(true);
  });

  it("clears a speaker with no turn behind it, once, records the room and says who", () => {
    const { working, speakers, cleared, logs } = room();
    expect(working("room-1", "t-room")).toBe(false);
    expect(speakers.has("t-room")).toBe(false);
    expect(cleared).toEqual(["room-1"]);
    expect(logs).toEqual(["[rooms] cleared Ada (bot-ada) as the speaker in room room-1 thread t-room: no turn runs there"]);
    expect(working("room-1", "t-room")).toBe(false);
    expect(cleared).toEqual(["room-1"]);
    expect(logs).toHaveLength(1);
  });

  it("leaves other threads' speakers in place", () => {
    const { working, speakers } = room();
    speakers.set("t-other", { ...ada, botId: "bot-bo", name: "Bo" });
    expect(working("room-1", "t-room")).toBe(false);
    expect(speakers.get("t-other")?.name).toBe("Bo");
  });

  it("is idle for a thread nobody speaks in", () => {
    const { working, cleared } = room();
    expect(working("room-1", "t-quiet")).toBe(false);
    expect(cleared).toEqual([]);
  });
});
