const { existsSync } = require("node:fs");
const { spawn } = require("node:child_process");
const path = require("node:path");

const supabaseUrl = required("SUPABASE_URL");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const workspace = process.env.COPILOT_WORKSPACE || path.resolve(__dirname, "..", "..", "..");
const pollMs = Number(process.env.COPILOT_QUEUE_POLL_MS || 5000);
const windowsLoader = path.join(
  process.env.APPDATA || "",
  "npm",
  "node_modules",
  "@github",
  "copilot",
  "npm-loader.js"
);
const command = process.env.COPILOT_COMMAND || (
  process.platform === "win32" && existsSync(windowsLoader) ? process.execPath : "copilot"
);
const commandPrefix = process.platform === "win32" && existsSync(windowsLoader)
  ? [windowsLoader]
  : [];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function api(route, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${route}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`${options.method || "GET"} ${route}: ${await response.text()}`);
  return response.status === 204 ? undefined : response.json();
}

const streamMs = Number(process.env.COPILOT_STREAM_MS || 2000);

function execute(prompt, onOutput) {
  return new Promise((resolve) => {
    const child = spawn(command, [
      ...commandPrefix,
      "-C", workspace,
      "-p", prompt,
      "--allow-all-tools",
      "--allow-all-paths",
    ], { cwd: workspace, env: process.env, windowsHide: true });
    let output = "";
    let dirty = false;
    const flush = () => {
      if (!dirty) return;
      dirty = false;
      onOutput(output);
    };
    const streamTimer = setInterval(flush, streamMs);
    child.stdout.on("data", (chunk) => { output += chunk; dirty = true; });
    child.stderr.on("data", (chunk) => { output += chunk; dirty = true; });
    child.on("error", (error) => {
      clearInterval(streamTimer);
      resolve({ exitCode: 1, output: `Unable to start Copilot CLI: ${error.message}` });
    });
    child.on("close", (exitCode) => {
      clearInterval(streamTimer);
      resolve({ exitCode, output: output.trim() || "(Copilot returned no output.)" });
    });
  });
}

async function poll() {
  try {
    const commands = await api("rpc/claim_copilot_command", { method: "POST", body: "{}" });
    const job = commands[0];
    if (job) {
      console.log(`Running command ${job.id}`);
      const pushOutput = (output) => {
        api(`copilot_commands?id=eq.${job.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ output }),
        }).catch((error) => console.error(`Live update failed: ${error.message}`));
      };
      const result = await execute(job.prompt, pushOutput);
      await api(`copilot_commands?id=eq.${job.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: result.exitCode === 0 ? "completed" : "failed",
          output: result.output,
          exit_code: result.exitCode,
          completed_at: new Date().toISOString(),
        }),
      });
    }
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error
      ? ` (${error.cause.code || "network error"}: ${error.cause.message})`
      : "";
    console.error(`${error.message}${cause}`);
  } finally {
    setTimeout(poll, pollMs);
  }
}

console.log(`Remote Copilot worker started. Workspace: ${workspace}`);
poll();
