import { spawnSync } from "node:child_process";

const commands = [
  ["npm", ["run", "lint"]],
  ["npm", ["run", "test"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "safety:scan"]],
  ["npm", ["run", "eval:run"]],
  ["npm", ["audit", "--audit-level=moderate"]],
  ["npm", ["run", "iq:verify"]]
] as const;

for (const [command, args] of commands) {
  const executable = process.platform === "win32" ? "cmd.exe" : command;
  const commandArgs =
    process.platform === "win32" ? ["/c", command, ...args] : args;

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

console.log("Submission check passed, including live Foundry IQ verification.");
