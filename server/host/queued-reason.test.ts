import { describe, expect, it } from "vitest";

import type { HandoffView } from "../coordinator.ts";
import { createQueuedReason, type QueuedReasonDeps } from "./queued-reason.ts";

const node = (over: Partial<HandoffView> = {}) => ({ id: "h-1", rootId: "h-0", parentId: "h-0", threadId: "t-new", botId: "bot-ops", status: "queued", ...over }) as HandoffView;
const busy = [{ threadId: "t-a", title: "Weekly report" }, { threadId: "t-b", title: "Fix login" }];
const reason = (over: Partial<QueuedReasonDeps> = {}) => createQueuedReason({
  botName: () => "Ops", waitsForComputer: () => false, threadBusy: () => false,
  slots: () => ({ busy, limit: 2 }), groupTurn: () => false, behindPerson: () => undefined, roomHold: () => undefined, ...over,
});
const full = "waiting for a free thread slot: Ops is already running 2 of 2 threads at once";

describe("why a queued handoff has not started", () => {
  it("names a full thread list with its count, and the busy threads only to a caller allowed to see them", () => {
    expect(reason()(node())).toBe(full);
    expect(reason()(node(), () => true)).toBe(`${full}: "Weekly report", "Fix login"`);
    expect(reason()(node(), (threadId) => threadId === "t-b")).toBe(`${full}: "Fix login"`);
    expect(reason()(node(), () => false)).toBe(full);
  });

  it("keeps the person's open card first, as before", () => {
    expect(reason({ behindPerson: () => ({ kind: "question", title: "Pick a date" }) })(node()))
      .toBe('waiting for a free slot: that teammate is waiting on the person\'s answer in its thread "Pick a date"; tell the person to open it');
  });

  it("says when it waits for a computer, an earlier turn in its thread, or a room turn", () => {
    expect(reason({ waitsForComputer: () => true })(node())).toBe("waiting for the computer it needs, which another turn or a person is using");
    expect(reason({ threadBusy: (_bot, threadId) => threadId === "t-new" })(node())).toBe("waiting for an earlier turn in that thread to finish");
    expect(reason({ slots: () => ({ busy: [], limit: 2 }), groupTurn: () => true })(node())).toBe("waiting for Ops to finish its turn in a room");
  });

  it("falls back to the plain line when nothing explains it, and for a room's handoff", () => {
    expect(reason({ slots: () => ({ busy: [], limit: 2 }) })(node())).toBe("waiting for that teammate to be free");
    expect(reason()(node({ groupId: "room-1" }))).toBe("waiting for that teammate to be free");
  });

  it("names what holds a room's handoff: the member speaking in its room thread, a turn there, or its member's turn elsewhere", () => {
    const room = node({ groupId: "room-1" });
    expect(reason({ roomHold: () => ({ on: "thread", speaker: "Ada" }) })(room)).toBe("waiting for Ada to finish speaking in that room thread");
    expect(reason({ roomHold: () => ({ on: "thread" }) })(room)).toBe("waiting for the turn already running in that room thread to finish");
    expect(reason({ roomHold: () => ({ on: "member" }) })(room)).toBe("waiting for Ops to finish its turn in another thread");
    expect(reason({ roomHold: () => ({ on: "member" }), groupTurn: () => true })(room)).toBe("waiting for Ops to finish its turn in a room");
    expect(reason({ roomHold: () => ({ on: "member" }), slots: () => ({ busy, limit: 1 }) })(room)).toBe("waiting for Ops to finish its turn in another thread");
  });

  it("puts a room's handoff behind the computer it needs, and behind the person's open card first", () => {
    const room = node({ groupId: "room-1" });
    expect(reason({ waitsForComputer: () => true, roomHold: () => ({ on: "thread", speaker: "Ada" }) })(room)).toBe("waiting for the computer it needs, which another turn or a person is using");
    expect(reason({ behindPerson: () => ({ kind: "question", title: "Pick a date" }), roomHold: () => ({ on: "member" }) })(room))
      .toBe('waiting for a free slot: that teammate is waiting on the person\'s answer in its thread "Pick a date"; tell the person to open it');
  });
});
