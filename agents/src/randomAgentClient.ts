import { runAgentClient } from "./client.js";
import { makeRandomDecision } from "./randomDecision.js";

const url = process.argv[2] ?? "ws://localhost:8080";
const name = process.argv[3] ?? "Random-Client";
const seed = Number(process.argv[4] ?? 1);

await runAgentClient({ url, agentName: name, decide: makeRandomDecision(seed) });
