import { createAppState, createServerForState } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
// Bind IPv4 0.0.0.0 by default so container/cloud port-forwarders that only
// detect IPv4 listeners can reach the server. Override with HOST if needed.
const host = process.env.HOST ?? "0.0.0.0";
const state = createAppState();
const server = createServerForState(state);

server.listen(port, host, () => {
  console.log(`EMS API listening on http://${host}:${port}`);
  console.log("Headers: X-Role: enduser | installer | system");
});
