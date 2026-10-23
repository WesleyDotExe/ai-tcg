// The worker thread's entry: plain JavaScript, so Node can start it before
// any TypeScript loader exists in the thread. It registers tsx (the server
// itself runs under tsx) and then loads the TypeScript job.
import { register } from "tsx/esm/api";

register();
await import("./job.ts");
