import { createAppState, createServerForState } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const state = createAppState();
const server = createServerForState(state);

server.listen(port, () => {
  console.log(`EMS API listening on http://127.0.0.1:${port}`);
  console.log("Headers: X-Role: enduser | installer | system");
});
