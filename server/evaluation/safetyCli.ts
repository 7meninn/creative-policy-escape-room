import { runSafetyScan } from "./safety";

const result = await runSafetyScan();
const blocking = result.safetyFindings.filter(
  (finding) => !finding.approved && finding.severity !== "info"
);
const approved = result.safetyFindings.filter((finding) => finding.approved);

for (const check of result.checks) {
  console.log(`${check.status.toUpperCase()} ${check.label}: ${check.summary}`);
}

if (approved.length > 0) {
  console.log(`Approved demo findings: ${approved.length}`);
}

if (blocking.length > 0) {
  console.error(`Safety scan failed with ${blocking.length} blocking findings.`);
  for (const finding of blocking) {
    console.error(
      `${finding.severity.toUpperCase()} ${finding.rule} ${finding.location}: ${finding.message}`
    );
  }
  process.exit(1);
}

console.log("Safety scan passed with no blocking findings.");
