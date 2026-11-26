import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
try {
  loadEnvFile(".env.local");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const frontendPort = Number(process.env.FRONTEND_PORT || 3000);
let backendPort = Number(process.env.BACKEND_PORT || (frontendPort === 3001 ? 3002 : 3001));
const children = [];
let stopped = false;
function stop(code = 0) {
  if (stopped) return;
  stopped = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
async function available(value, host = "0.0.0.0") {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        new Error(
          `Port ${value} is occupied. Stop the process using that port, then run demo again.`,
        ),
      ),
    );
    probe.listen(value, host, () => probe.close(resolve));
  });
}
function launch(args, env = {}) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, ...env },
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopped) {
      console.error(`QueueCare process stopped (${code ?? "signal"}).`);
      stop(code || 1);
    }
  });
  return child;
}
async function ready(url, health = false) {
  const end = Date.now() + 60000;
  while (!stopped && Date.now() < end) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(health ? 2000 : 30000) });
      if (response.ok && (!health || (await response.json()).status === "ok")) return;
    } catch {
      /* Retry while the server starts. */
    }
    await delay(300);
  }
  throw new Error(`Unable to start ${url}. See the server output above.`);
}
try {
  while (backendPort <= 3020) {
    try {
      await available(backendPort, "127.0.0.1");
      break;
    } catch {
      backendPort++;
    }
  }
  process.env.APP_URL = `http://localhost:${frontendPort}`;
  process.env.BACKEND_PORT = String(backendPort);
  launch(["--env-file-if-exists=.env.local", "server/index.ts"], {
    PORT: String(backendPort),
    APP_URL: `http://localhost:${frontendPort}`,
  });
  await ready(`http://127.0.0.1:${backendPort}/api/health`, true);
  launch(
    [
      fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)),
      "dev",
      "--port",
      String(frontendPort),
      "--host",
      "0.0.0.0",
    ],
    {
      BACKEND_PORT: String(backendPort),
      PORT: String(frontendPort),
    },
  );
  await ready(`http://127.0.0.1:${frontendPort}/login`);
  console.log(
    `\nApp: http://localhost:${frontendPort}\nPublic display: http://localhost:${frontendPort}/public-display`,
  );
} catch (error) {
  console.error(error.message);
  stop(1);
}
