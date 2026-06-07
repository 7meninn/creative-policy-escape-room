import { spawnSync } from "node:child_process";
import { runSafetyScan } from "./safety";

const commands = [
  ["npm", ["run", "lint"]],
  ["npm", ["run", "test"]],
  ["npm", ["run", "build"]]
] as const;

const safety = await runSafetyScan();
const blocking = safety.safetyFindings.filter(
  (finding) => !finding.approved && finding.severity !== "info"
);

console.log(`Safety checks: ${safety.status}`);
if (blocking.length > 0) {
  console.error(`Evaluation stopped: ${blocking.length} blocking safety findings.`);
  process.exit(1);
}

for (const [command, args] of commands) {
  const executable = process.platform === "win32" ? "cmd.exe" : command;
  const commandArgs = process.platform === "win32"
    ? ["/c", command, ...args]
    : args;
  console.log(`Running ${command} ${args.join(" ")}...`);
  const result = spawnSync(executable, commandArgs, {
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Evaluation run passed: safety scan, lint, tests, and build are green.");
