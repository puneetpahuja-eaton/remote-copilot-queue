const { existsSync, readFileSync } = require("node:fs");
const { spawn } = require("node:child_process");
const path = require("node:path");

// Load local .env file if present
const envFile = path.resolve(__dirname, ".env");
if (existsSync(envFile)) {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envFile);
  } else {
    for (const line of readFileSync(envFile, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

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
const command = process.env.CLI_COMMAND || process.env.COPILOT_COMMAND || (
  process.platform === "win32" && existsSync(windowsLoader) ? process.execPath : "copilot"
);
const commandPrefix = process.platform === "win32" && existsSync(windowsLoader) && !process.env.CLI_COMMAND
  ? [windowsLoader]
  : [];
// Everything below lets you point this worker at a different CLI (e.g. an "antigravity" CLI on
// another machine) purely via environment variables, without touching this file:
//   CLI_COMMAND            executable name/path (default: "copilot")
//   CLI_WORKSPACE_FLAG     flag used to set the working directory (default: "-C"); set to "" to omit
//   CLI_PROMPT_FLAG        flag used to pass the prompt text (default: "-p")
//   CLI_EXTRA_ARGS         extra space-separated args appended after prompt (default: Copilot's
//                          "--allow-all-tools --allow-all-paths"); set to "" to omit entirely
//   CLI_REASONING_EFFORT_FLAG  flag name for reasoning effort (default: "--reasoning-effort");
//                              set to "" to skip passing effort/model flags for CLIs that don't support them
const workspaceFlag = process.env.CLI_WORKSPACE_FLAG ?? "-C";
const promptFlag = process.env.CLI_PROMPT_FLAG ?? "-p";
const extraArgs = (process.env.CLI_EXTRA_ARGS ?? "--allow-all-tools --allow-all-paths")
  .split(" ")
  .filter(Boolean);
const reasoningEffortFlag = process.env.CLI_REASONING_EFFORT_FLAG ?? "--reasoning-effort";
const modelFlag = process.env.CLI_MODEL_FLAG ?? "--model";
// Lower reasoning effort trades some depth for significantly faster, cheaper responses.
// Override with COPILOT_REASONING_EFFORT=high (etc.) for tasks that need deeper reasoning.
const reasoningEffort = process.env.COPILOT_REASONING_EFFORT || "low";
const model = process.env.COPILOT_MODEL; // optional; unset lets the CLI pick its default

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const apiRetries = Number(process.env.COPILOT_API_RETRIES || 3);
const apiRetryDelayMs = Number(process.env.COPILOT_API_RETRY_DELAY_MS || 1000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiOnce(route, options) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${route}`, {
    ...options,
    // Disable keep-alive reuse: on some corporate networks proxies/firewalls
    // silently drop idle pooled connections, which surfaces as ETIMEDOUT/ECONNRESET
    // on the next reused request instead of opening a fresh connection.
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      connection: "close",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`${options.method || "GET"} ${route}: ${await response.text()}`);
  return response.status === 204 ? undefined : response.json();
}

async function api(route, options = {}) {
  for (let attempt = 1; attempt <= apiRetries; attempt++) {
    try {
      return await apiOnce(route, options);
    } catch (error) {
      const isNetworkError = error instanceof TypeError && error.cause;
      if (!isNetworkError || attempt === apiRetries) throw error;
      await sleep(apiRetryDelayMs * attempt);
    }
  }
}

const streamMs = Number(process.env.COPILOT_STREAM_MS || 2000);

function execute(prompt, onOutput) {
  return new Promise((resolve) => {
    const args = [
      ...commandPrefix,
      ...(workspaceFlag ? [workspaceFlag, workspace] : []),
      ...(promptFlag ? [promptFlag, prompt] : [prompt]),
      ...extraArgs,
      ...(reasoningEffortFlag ? [reasoningEffortFlag, reasoningEffort] : []),
      ...(model && modelFlag ? [modelFlag, model] : []),
    ];
    const child = spawn(command, args, { cwd: workspace, env: process.env, windowsHide: true });
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
      resolve({ exitCode: 1, output: `Unable to start CLI (${command}): ${error.message}` });
    });
    child.on("close", (exitCode) => {
      clearInterval(streamTimer);
      resolve({ exitCode, output: output.trim() || "(CLI returned no output.)" });
    });
  });
}

async function poll() {
  let jobHandled = false;
  try {
    const commands = await api("rpc/claim_copilot_command", { method: "POST", body: "{}" });
    const job = commands[0];
    if (job) {
      jobHandled = true;
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
    // Re-check immediately after finishing a job (in case more are queued);
    // only wait the full poll interval when the queue was empty.
    setTimeout(poll, jobHandled ? 0 : pollMs);
  }
}

console.log(`Remote Copilot worker started. Workspace: ${workspace}`);
poll();
