import { runAgentClient } from "./client.js";
import { aggressiveDecision } from "./aggressiveDecision.js";

const url = process.argv[2] ?? "ws://localhost:8080";
const name = process.argv[3] ?? "Aggressive-Client";

await runAgentClient({ url, agentName: name, decide: aggressiveDecision });
