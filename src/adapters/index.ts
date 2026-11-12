import type { SubjectAdapter } from "../types.js";
import { FixtureAdapter } from "./fixture.js";
import { LofisuAdapter } from "./lofisu.js";
import { OpenSuperAgentAdapter } from "./opensuperagent.js";

export const ADAPTER_IDS = ["fixture", "opensuperagent", "lofisu"] as const;

export function createAdapter(id: string): SubjectAdapter {
  switch (id) {
    case "fixture":
      return new FixtureAdapter();
    case "opensuperagent":
      return new OpenSuperAgentAdapter();
    case "lofisu":
      return new LofisuAdapter();
    default:
      throw new Error(`unknown subject adapter: ${id}`);
  }
}
