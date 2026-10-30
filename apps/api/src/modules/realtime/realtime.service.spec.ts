import { firstValueFrom, skip, take, toArray } from "rxjs";
import { RealtimeService } from "./realtime.service";

describe("RealtimeService", () => {
  let service: RealtimeService;

  beforeEach(() => {
    service = new RealtimeService();
  });

  it("should emit a connected event immediately on subscription", async () => {
    const event = await firstValueFrom(service.subscribe("user-1"));

    expect(event).toEqual({
      type: "connected",
      data: { connected: true }
    });
  });

  it("should deliver events only to the matching user", async () => {
    const eventPromise = firstValueFrom(
      service.subscribe("user-1").pipe(skip(1), take(1))
    );

    service.emitMonitorChanged("user-2", { id: "monitor-2" });
    service.emitMonitorChanged("user-1", { id: "monitor-1" });

    const event = await eventPromise;

    expect(event).toEqual({
      type: "monitor.changed",
      data: { monitor: { id: "monitor-1" } }
    });
  });

  it("should emit all supported event types with the expected payloads", async () => {
    const eventsPromise = firstValueFrom(
      service.subscribe("user-1").pipe(skip(1), take(4), toArray())
    );

    service.emitMonitorChanged("user-1", { id: "monitor-1" });
    service.emitMonitorDeleted("user-1", "monitor-2");
    service.emitCheckCreated("user-1", { id: "check-1" });
    service.emitIncidentChanged("user-1", { id: "incident-1" });

    const events = await eventsPromise;

    expect(events).toEqual([
      {
        type: "monitor.changed",
        data: { monitor: { id: "monitor-1" } }
      },
      {
        type: "monitor.deleted",
        data: { monitorId: "monitor-2" }
      },
      {
        type: "check.created",
        data: { id: "check-1" }
      },
      {
        type: "incident.changed",
        data: { incident: { id: "incident-1" } }
      }
    ]);
  });

  it("should not deliver events emitted before subscription", async () => {
    service.emitMonitorChanged("user-1", { id: "old-monitor" });

    const event = await firstValueFrom(service.subscribe("user-1"));

    expect(event).toEqual({
      type: "connected",
      data: { connected: true }
    });
  });

  it("should allow multiple subscribers for the same user", async () => {
    const firstPromise = firstValueFrom(
      service.subscribe("user-1").pipe(skip(1), take(1))
    );

    const secondPromise = firstValueFrom(
      service.subscribe("user-1").pipe(skip(1), take(1))
    );

    service.emitCheckCreated("user-1", { id: "check-1" });

    const [firstEvent, secondEvent] = await Promise.all([
      firstPromise,
      secondPromise
    ]);

    expect(firstEvent).toEqual({
      type: "check.created",
      data: { id: "check-1" }
    });

    expect(secondEvent).toEqual(firstEvent);
  });
});