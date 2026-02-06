import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { createToken } from "./tokens";
import { logEvents } from "./events";
import { saveConversation } from "./conversations";
import { CORS_HEADERS } from "./helpers";

const http = httpRouter();

// CORS preflight handler
const handleOptions = httpAction(async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
});

// Token endpoint
http.route({
  path: "/api/token",
  method: "POST",
  handler: createToken,
});
http.route({
  path: "/api/token",
  method: "OPTIONS",
  handler: handleOptions,
});

// Events endpoint
http.route({
  path: "/api/events",
  method: "POST",
  handler: logEvents,
});
http.route({
  path: "/api/events",
  method: "OPTIONS",
  handler: handleOptions,
});

// Conversations endpoint
http.route({
  path: "/api/conversations",
  method: "POST",
  handler: saveConversation,
});
http.route({
  path: "/api/conversations",
  method: "OPTIONS",
  handler: handleOptions,
});

export default http;
