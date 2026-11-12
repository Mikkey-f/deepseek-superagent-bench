import type { SubjectAdapter } from "../types.js";
import { FixtureAdapter } from "./fixture.js";
import { LofisuAdapter } from "./lofisu.js";
import { NegativeFixtureAdapter } from "./negative-fixture.js";
import { OpenSuperAgentAdapter } from "./opensuperagent.js";

export const ADAPTER_IDS = [
  "fixture",
  "opensuperagent",
  "lofisu",
  "fixture-double-work",
  "fixture-replay-restart",
  "fixture-unauthorized-work",
] as const;

export function createAdapter(id: string): SubjectAdapter {
  switch (id) {
    case "fixture":
      return new FixtureAdapter();
    case "opensuperagent":
      return new OpenSuperAgentAdapter();
    case "lofisu":
      return new LofisuAdapter();
    case "fixture-double-work":
      return new NegativeFixtureAdapter("double-work");
    case "fixture-replay-restart":
      return new NegativeFixtureAdapter("replay-restart");
    case "fixture-unauthorized-work":
      return new NegativeFixtureAdapter("unauthorized-work");
    default:
      throw new Error(`unknown subject adapter: ${id}`);
  }
}
