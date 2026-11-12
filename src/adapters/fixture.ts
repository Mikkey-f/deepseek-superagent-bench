import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  BenchContext,
  BenchEvent,
  Capability,
  Outbound,
  StateSnapshot,
  SubjectAdapter,
} from "../types.js";

interface FixtureTicket {
  id: string;
  threadKey: string;
  status: "open" | "ended";
}

interface FixtureState {
  seen: string[];
  tickets: FixtureTicket[];
  outbound: Outbound[];
}

const STATE_FILE = "fixture-state.json";

function emptyState(): FixtureState {
  return { seen: [], tickets: [], outbound: [] };
}

/**
 * A deliberately minimal in-process subject. It exists only to validate the
 * evaluator; it is not a benchmark subject and must not be presented as one.
 */
export class FixtureAdapter implements SubjectAdapter {
  readonly id = "fixture";
  readonly version = "1.0.0";
  readonly commit = "fixture";
  readonly mode = "fixture" as const;
  readonly capabilities: ReadonlySet<Capability> = new Set<Capability>([
    "event-injection",
    "outbound-capture",
    "authorization",
    "state-snapshot",
    "ticket-count",
    "eval-count",
    "restart",
  ]);

  private state: FixtureState = emptyState();
  private statePath = "";
  private allowedActors = new Set<string>();
  private ticketSeq = 0;
  private outboundSeq = 0;

  async start(ctx: BenchContext): Promise<void> {
    await mkdir(ctx.workDir, { recursive: true });
    this.statePath = join(ctx.workDir, STATE_FILE);
    this.allowedActors = new Set(ctx.scenario.policy?.allowedActors ?? []);
    try {
      const raw = await readFile(this.statePath, "utf8");
      this.state = JSON.parse(raw) as FixtureState;
    } catch {
      this.state = emptyState();
    }
    this.ticketSeq = this.state.tickets.length;
    this.outboundSeq = this.state.outbound.length;
  }

  async inject(events: BenchEvent[]): Promise<void> {
    for (const event of events) {
      if (this.state.seen.includes(event.id)) {
        await this.persist();
        continue;
      }
      this.state.seen.push(event.id);

      const allowed = this.allowedActors.size === 0 || this.allowedActors.has(event.actor);
      if (!allowed || !event.mentionsAgent) {
        await this.persist();
        continue;
      }

      let ticket = this.state.tickets.find(
        (candidate) => candidate.threadKey === event.threadKey && candidate.status === "open",
      );
      if (!ticket) {
        this.ticketSeq += 1;
        ticket = {
          id: `fixture-ticket-${this.ticketSeq}`,
          threadKey: event.threadKey,
          status: "open",
        };
        this.state.tickets.push(ticket);
      }

      const body = `Acknowledged request on ${event.threadKey}: ${event.text}`;
      const duplicate = this.state.outbound.some(
        (message) => message.threadKey === event.threadKey && message.body === body,
      );
      if (!duplicate) {
        this.outboundSeq += 1;
        this.state.outbound.push({
          id: `fixture-out-${this.outboundSeq}`,
          threadKey: event.threadKey,
          body,
          createdAt: new Date().toISOString(),
        });
      }
      await this.persist();
    }
    await this.persist();
  }

  async outbound(): Promise<Outbound[]> {
    return this.state.outbound.map((message) => ({ ...message }));
  }

  async snapshot(): Promise<StateSnapshot> {
    return {
      tickets: this.state.tickets.length,
      openTickets: this.state.tickets.filter((ticket) => ticket.status === "open").length,
      endedTickets: this.state.tickets.filter((ticket) => ticket.status === "ended").length,
      outbound: this.state.outbound.length,
    };
  }

  async restart(): Promise<void> {
    try {
      const raw = await readFile(this.statePath, "utf8");
      this.state = JSON.parse(raw) as FixtureState;
    } catch {
      this.state = emptyState();
    }
    this.ticketSeq = this.state.tickets.length;
    this.outboundSeq = this.state.outbound.length;
  }

  async stop(): Promise<void> {
    await this.persist();
  }

  private async persist(): Promise<void> {
    if (!this.statePath) return;
    await writeFile(this.statePath, JSON.stringify(this.state, null, 2), "utf8");
  }
}
