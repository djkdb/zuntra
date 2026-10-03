import "server-only";
import type { MockHandler } from "../providers/mock";
import { PLANNER_SCHEMA_NAME } from "../prompts/planner";
import { mockPlan } from "./planner";
import { RESCHEDULER_SCHEMA_NAME } from "../prompts/rescheduler";
import { mockReschedule } from "./rescheduler";
import { COMPANION_SCHEMA_NAME } from "../prompts/companion";
import { mockCompanion } from "./companion";
import { PACKING_SCHEMA_NAME } from "../prompts/packing";
import { mockPacking } from "./packing";

/** schemaName → deterministic handler. Every AI feature registers one. */
export const mockHandlers: Record<string, MockHandler> = {
  [PLANNER_SCHEMA_NAME]: mockPlan as MockHandler,
  [RESCHEDULER_SCHEMA_NAME]: mockReschedule as MockHandler,
  [COMPANION_SCHEMA_NAME]: mockCompanion as MockHandler,
  [PACKING_SCHEMA_NAME]: mockPacking as MockHandler,
};
