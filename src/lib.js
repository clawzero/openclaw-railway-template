import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Resolve directory paths from env or defaults.
 */
export function resolvePaths(env = process.env) {
  const stateDir =
    env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), ".openclaw");
  const workspaceDir =
    env.OPENCLAW_WORKSPACE_DIR?.trim() || path.join(stateDir, "workspace");
  const skillsDir = path.join(stateDir, "skills");
  const toolsDir = path.join(stateDir, "tools");
  return { stateDir, workspaceDir, skillsDir, toolsDir };
}

/**
 * Resolve the openclaw.json config file path.
 */
export function configPath(env = process.env, stateDir) {
  return (
    env.OPENCLAW_CONFIG_PATH?.trim() || path.join(stateDir, "openclaw.json")
  );
}

/**
 * Check whether the system has been configured (openclaw.json exists).
 */
export function isConfigured(cfgPath) {
  try {
    return fs.existsSync(cfgPath);
  } catch {
    return false;
  }
}

/**
 * Resolve the gateway token from env, persisted file, or generate new.
 * Returns { token, source } where source is "env" | "file" | "generated".
 */
export function resolveGatewayToken({ env = process.env, stateDir, debugFn = () => {} } = {}) {
  const envTok = env.OPENCLAW_GATEWAY_TOKEN?.trim();

  if (envTok) {
    return { token: envTok, source: "env" };
  }

  const tokenPath = path.join(stateDir, "gateway.token");
  debugFn(`[token] Env variable not set, checking persisted file at ${tokenPath}`);

  try {
    const existing = fs.readFileSync(tokenPath, "utf8").trim();
    if (existing) {
      return { token: existing, source: "file" };
    }
  } catch (err) {
    debugFn(`[token] Could not read persisted file: ${err.message}`);
  }

  const generated = crypto.randomBytes(32).toString("hex");
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(tokenPath, generated, { encoding: "utf8", mode: 0o600 });
    debugFn(`[token] Persisted new token to ${tokenPath}`);
  } catch (err) {
    // Non-fatal: token still usable in memory
    debugFn(`[token] Could not persist token: ${err.message}`);
  }
  return { token: generated, source: "generated" };
}

/**
 * Build the CLI args array for `openclaw onboard --non-interactive`.
 */
export function buildOnboardArgs(payload, { workspaceDir, gatewayPort, gatewayToken }) {
  const args = [
    "onboard",
    "--non-interactive",
    "--accept-risk",
    "--json",
    "--no-install-daemon",
    "--skip-health",
    "--workspace",
    workspaceDir,
    "--gateway-bind",
    "loopback",
    "--gateway-port",
    String(gatewayPort),
    "--gateway-auth",
    "token",
    "--gateway-token",
    gatewayToken,
    "--flow",
    payload.flow || "quickstart",
  ];

  if (payload.authChoice) {
    args.push("--auth-choice", payload.authChoice);

    const secret = (payload.authSecret || "").trim();
    const map = {
      "openai-api-key": "--openai-api-key",
      apiKey: "--anthropic-api-key",
      "openrouter-api-key": "--openrouter-api-key",
      "ai-gateway-api-key": "--ai-gateway-api-key",
      "moonshot-api-key": "--moonshot-api-key",
      "kimi-code-api-key": "--kimi-code-api-key",
      "gemini-api-key": "--gemini-api-key",
      "zai-api-key": "--zai-api-key",
      "minimax-api": "--minimax-api-key",
      "minimax-api-lightning": "--minimax-api-key",
      "synthetic-api-key": "--synthetic-api-key",
      "opencode-zen": "--opencode-zen-api-key",
    };
    const flag = map[payload.authChoice];
    if (flag && secret) {
      args.push(flag, secret);
    }

    if (payload.authChoice === "token" && secret) {
      args.push("--token-provider", "anthropic", "--token", secret);
    }
  }

  return args;
}

/**
 * Parse a Basic auth header and return the password, or null if invalid.
 */
export function parseBasicAuth(header) {
  if (!header) return null;
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  return idx >= 0 ? decoded.slice(idx + 1) : "";
}

/**
 * Express middleware factory for Basic auth against a known password.
 */
export function makeSetupAuth(password) {
  return function requireSetupAuth(req, res, next) {
    if (!password) {
      return res
        .status(500)
        .type("text/plain")
        .send(
          "SETUP_PASSWORD is not set. Set it in Railway Variables before using /setup.",
        );
    }

    const pw = parseBasicAuth(req.headers.authorization);
    if (pw === null) {
      res.set("WWW-Authenticate", 'Basic realm="Openclaw Setup"');
      return res.status(401).send("Auth required");
    }
    if (pw !== password) {
      res.set("WWW-Authenticate", 'Basic realm="Openclaw Setup"');
      return res.status(401).send("Invalid password");
    }
    return next();
  };
}

/**
 * Prepend the OPENCLAW_ENTRY path to a list of CLI args.
 */
export function clawArgs(entry, args) {
  return [entry, ...args];
}
