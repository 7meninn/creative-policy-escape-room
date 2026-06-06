import { config as loadEnv } from "dotenv";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { foundryApiPort } from "./foundry/config";
import {
  type FoundryRetrievalOptions,
  retrievalRequestSchema,
  retrieveWithFoundryFallback
} from "./foundry/retrieval";

const BODY_LIMIT_BYTES = 64 * 1024;

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

export function createFoundryApiServer(options: FoundryRetrievalOptions = {}) {
  return createServer(async (request, response) => {
    applyCors(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "GET" && request.url === "/healthz") {
      sendJson(response, 200, { ok: true, service: "foundry-iq-proxy" });
      return;
    }

    if (
      request.method === "POST" &&
      request.url === "/api/retrieve-policy-evidence"
    ) {
      await handleRetrieve(request, response, options);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  });
}

if (isMainEntry()) {
  const server = createFoundryApiServer();
  server.listen(foundryApiPort(), () => {
    console.log(
      `Foundry IQ retrieval proxy listening on http://localhost:${foundryApiPort()}`
    );
  });
}

async function handleRetrieve(
  request: IncomingMessage,
  response: ServerResponse,
  options: FoundryRetrievalOptions
) {
  try {
    const rawBody = await readBody(request);
    const body = parseJsonBody(rawBody, response);

    if (body === null) {
      return;
    }

    const parsed = retrievalRequestSchema.safeParse(body);

    if (!parsed.success) {
      sendJson(response, 400, {
        error: "Invalid retrieval request",
        issues: parsed.error.issues.map((issue) => issue.message)
      });
      return;
    }

    sendJson(response, 200, await retrieveWithFoundryFallback(parsed.data, options));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    sendJson(response, 500, { error: message });
  }
}

function parseJsonBody(rawBody: string, response: ServerResponse) {
  try {
    return JSON.parse(rawBody || "{}") as unknown;
  } catch {
    sendJson(response, 400, { error: "Invalid JSON request body" });
    return null;
  }
}

function applyCors(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";

    request.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
      if (Buffer.byteLength(body, "utf8") > BODY_LIMIT_BYTES) {
        request.destroy(new Error("Request body too large."));
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function isMainEntry() {
  return process.argv[1]?.replaceAll("\\", "/").endsWith("/server/foundryApi.ts");
}
