import { config as loadEnv } from "dotenv";
import { verifyLiveFoundryIq } from "./iqVerify";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

try {
  const result = await verifyLiveFoundryIq();

  console.log("Live Foundry IQ verification passed.");
  console.log(`Query: ${result.request.query}`);
  console.log(`Retrieval status: ${result.trace.retrievalStatus}`);
  console.log(`Mapped citations: ${result.citationMappingCount}`);
  console.log(`Latency: ${result.latencyMs} ms`);

  for (const citation of result.citations) {
    console.log(
      `- ${citation.sourceId}#${citation.sectionId}: ${citation.label}`
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown IQ error.";
  console.error("Live Foundry IQ verification failed.");
  console.error(message);
  process.exit(1);
}
