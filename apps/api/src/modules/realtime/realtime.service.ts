import { Injectable, type MessageEvent } from "@nestjs/common";
import { Observable, Subject, filter, map, merge, of } from "rxjs";

export type RealtimeEventType =
  | "connected"
  | "monitor.changed"
  | "monitor.deleted"
  | "check.created"
  | "incident.changed";

interface RealtimeEvent {
  type: RealtimeEventType;
  userId: string;
  data: object;
}

@Injectable()
export class RealtimeService {
  private readonly events = new Subject<RealtimeEvent>();

  subscribe(userId: string): Observable<MessageEvent> {
    const connectedEvent = of<MessageEvent>({
      type: "connected",
      data: { connected: true }
    });
    const userEvents = this.events.asObservable().pipe(
      filter((event) => event.userId === userId),
      map((event) => ({
        type: event.type,
        data: event.data
      }))
    );

    return merge(connectedEvent, userEvents);
  }

  emitMonitorChanged(userId: string, monitor: object) {
    this.emit("monitor.changed", userId, { monitor });
  }

  emitMonitorDeleted(userId: string, monitorId: string) {
    this.emit("monitor.deleted", userId, { monitorId });
  }

  emitCheckCreated(userId: string, payload: object) {
    this.emit("check.created", userId, payload);
  }

  emitIncidentChanged(userId: string, incident: object) {
    this.emit("incident.changed", userId, { incident });
  }

  private emit(type: RealtimeEventType, userId: string, data: object) {
    this.events.next({ type, userId, data });
  }
}
