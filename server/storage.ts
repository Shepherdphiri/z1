import { broadcasts, type Broadcast, type InsertBroadcast } from "@shared/schema";

export interface IStorage {
  createBroadcast(broadcast: InsertBroadcast): Promise<Broadcast>;
  stopBroadcast(broadcasterId: string): Promise<void>;
  getActiveBroadcasts(): Promise<Broadcast[]>;
}

export class MemStorage implements IStorage {
  private broadcasts: Map<number, Broadcast>;
  private currentId: number;

  constructor() {
    this.broadcasts = new Map();
    this.currentId = 1;
  }

  async createBroadcast(insertBroadcast: InsertBroadcast): Promise<Broadcast> {
    const id = this.currentId++;
    const broadcast: Broadcast = {
      id,
      broadcasterId: insertBroadcast.broadcasterId,
      isActive: insertBroadcast.isActive ?? true,
      startedAt: new Date(),
      endedAt: null
    };
    this.broadcasts.set(id, broadcast);
    return broadcast;
  }

  async stopBroadcast(broadcasterId: string): Promise<void> {
    for (const [id, broadcast] of Array.from(this.broadcasts.entries())) {
      if (broadcast.broadcasterId === broadcasterId && broadcast.isActive) {
        const updatedBroadcast = {
          ...broadcast,
          isActive: false,
          endedAt: new Date()
        };
        this.broadcasts.set(id, updatedBroadcast);
        break;
      }
    }
  }

  async getActiveBroadcasts(): Promise<Broadcast[]> {
    return Array.from(this.broadcasts.values()).filter(b => b.isActive);
  }
}

export const storage = new MemStorage();
