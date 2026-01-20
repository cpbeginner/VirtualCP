import type { Response } from "express";

type Subscriber = Response;

function writeEvent(res: Subscriber, eventName: string, data: unknown): void {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function createRealtimeHub() {
  const subsByUserId = new Map<string, Set<Subscriber>>();

  function subscribeUser(userId: string, res: Subscriber): () => void {
    let set = subsByUserId.get(userId);
    if (!set) {
      set = new Set();
      subsByUserId.set(userId, set);
    }
    set.add(res);

    return () => {
      const existing = subsByUserId.get(userId);
      if (!existing) return;
      existing.delete(res);
      if (existing.size === 0) subsByUserId.delete(userId);
    };
  }

  function publishToUser(userId: string, eventName: string, data: unknown): void {
    const set = subsByUserId.get(userId);
    if (!set) return;
    for (const res of [...set]) {
      try {
        writeEvent(res, eventName, data);
      } catch {
        set.delete(res);
      }
    }
    if (set.size === 0) subsByUserId.delete(userId);
  }

  function publishToUsers(userIds: string[], eventName: string, data: unknown): void {
    const unique = new Set(userIds);
    for (const userId of unique) publishToUser(userId, eventName, data);
  }

  return { subscribeUser, publishToUser, publishToUsers };
}

