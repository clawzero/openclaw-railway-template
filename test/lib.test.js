import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  resolvePaths,
  configPath,
  isConfigured,
  resolveGatewayToken,
  buildOnboardArgs,
  parseBasicAuth,
  makeSetupAuth,
  clawArgs,
} from "../src/lib.js";

// ---------- resolvePaths ----------

describe("resolvePaths", () => {
  it("uses env variables when set", () => {
    const env = {
      OPENCLAW_STATE_DIR: "/custom/state",
      OPENCLAW_WORKSPACE_DIR: "/custom/workspace",
    };
    const p = resolvePaths(env);
    expect(p.stateDir).toBe("/custom/state");
    expect(p.workspaceDir).toBe("/custom/workspace");
    expect(p.skillsDir).toBe("/custom/state/skills");
    expect(p.toolsDir).toBe("/custom/state/tools");
  });

  it("falls back to homedir defaults when env is empty", () => {
    const p = resolvePaths({});
    const expected = path.join(os.homedir(), ".openclaw");
    expect(p.stateDir).toBe(expected);
    expect(p.workspaceDir).toBe(path.join(expected, "workspace"));
  });

  it("trims whitespace from env values", () => {
    const p = resolvePaths({
      OPENCLAW_STATE_DIR: "  /trimmed  ",
      OPENCLAW_WORKSPACE_DIR: "  /ws  ",
    });
    expect(p.stateDir).toBe("/trimmed");
    expect(p.workspaceDir).toBe("/ws");
  });
});

// ---------- configPath ----------

describe("configPath", () => {
  it("returns env override when set", () => {
    expect(configPath({ OPENCLAW_CONFIG_PATH: "/my/config.json" }, "/state"))
      .toBe("/my/config.json");
  });

  it("falls back to stateDir/openclaw.json", () => {
    expect(configPath({}, "/state")).toBe("/state/openclaw.json");
  });

  it("trims whitespace from env value", () => {
    expect(configPath({ OPENCLAW_CONFIG_PATH: "  /trimmed.json  " }, "/s"))
      .toBe("/trimmed.json");
  });
});

// ---------- isConfigured ----------

describe("isConfigured", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns true when config file exists", () => {
    const cfgPath = path.join(tmpDir, "openclaw.json");
    fs.writeFileSync(cfgPath, "{}");
    expect(isConfigured(cfgPath)).toBe(true);
  });

  it("returns false when config file does not exist", () => {
    expect(isConfigured(path.join(tmpDir, "nope.json"))).toBe(false);
  });

  it("returns false for invalid path", () => {
    expect(isConfigured("")).toBe(false);
  });
});

// ---------- resolveGatewayToken ----------

describe("resolveGatewayToken", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-token-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns env token with highest priority", () => {
    const result = resolveGatewayToken({
      env: { OPENCLAW_GATEWAY_TOKEN: "env-token-123" },
      stateDir: tmpDir,
    });
    expect(result.token).toBe("env-token-123");
    expect(result.source).toBe("env");
  });

  it("trims whitespace from env token", () => {
    const result = resolveGatewayToken({
      env: { OPENCLAW_GATEWAY_TOKEN: "  spaced  " },
      stateDir: tmpDir,
    });
    expect(result.token).toBe("spaced");
    expect(result.source).toBe("env");
  });

  it("returns persisted file token when env is not set", () => {
    fs.writeFileSync(path.join(tmpDir, "gateway.token"), "file-token-456");
    const result = resolveGatewayToken({ env: {}, stateDir: tmpDir });
    expect(result.token).toBe("file-token-456");
    expect(result.source).toBe("file");
  });

  it("trims persisted file token", () => {
    fs.writeFileSync(path.join(tmpDir, "gateway.token"), "  padded-token  \n");
    const result = resolveGatewayToken({ env: {}, stateDir: tmpDir });
    expect(result.token).toBe("padded-token");
  });

  it("generates and persists a new token when none exists", () => {
    const result = resolveGatewayToken({ env: {}, stateDir: tmpDir });
    expect(result.source).toBe("generated");
    expect(result.token).toHaveLength(64); // 32 bytes hex
    // Verify it was persisted
    const persisted = fs.readFileSync(path.join(tmpDir, "gateway.token"), "utf8");
    expect(persisted).toBe(result.token);
  });

  it("sets file permissions to 0o600 on generated token", () => {
    resolveGatewayToken({ env: {}, stateDir: tmpDir });
    const stat = fs.statSync(path.join(tmpDir, "gateway.token"));
    // Check owner-only read/write (0o600 = 384 decimal, mode includes file type bits)
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it("env token takes priority over persisted file", () => {
    fs.writeFileSync(path.join(tmpDir, "gateway.token"), "file-token");
    const result = resolveGatewayToken({
      env: { OPENCLAW_GATEWAY_TOKEN: "env-wins" },
      stateDir: tmpDir,
    });
    expect(result.token).toBe("env-wins");
    expect(result.source).toBe("env");
  });

  it("skips empty env token", () => {
    const result = resolveGatewayToken({
      env: { OPENCLAW_GATEWAY_TOKEN: "   " },
      stateDir: tmpDir,
    });
    // Empty after trim, so should fall through
    expect(result.source).not.toBe("env");
  });

  it("skips empty persisted file", () => {
    fs.writeFileSync(path.join(tmpDir, "gateway.token"), "  \n");
    const result = resolveGatewayToken({ env: {}, stateDir: tmpDir });
    expect(result.source).toBe("generated");
  });

  it("calls debugFn when provided", () => {
    const logs = [];
    resolveGatewayToken({
      env: {},
      stateDir: tmpDir,
      debugFn: (...args) => logs.push(args.join(" ")),
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes("[token]"))).toBe(true);
  });
});

// ---------- buildOnboardArgs ----------

describe("buildOnboardArgs", () => {
  const ctx = {
    workspaceDir: "/data/workspace",
    gatewayPort: 18789,
    gatewayToken: "test-token-abc",
  };

  it("includes all base flags", () => {
    const args = buildOnboardArgs({ flow: "quickstart" }, ctx);
    expect(args).toContain("onboard");
    expect(args).toContain("--non-interactive");
    expect(args).toContain("--accept-risk");
    expect(args).toContain("--json");
    expect(args).toContain("--no-install-daemon");
    expect(args).toContain("--skip-health");
    expect(args).toContain("--workspace");
    expect(args).toContain("/data/workspace");
    expect(args).toContain("--gateway-bind");
    expect(args).toContain("loopback");
    expect(args).toContain("--gateway-port");
    expect(args).toContain("18789");
    expect(args).toContain("--gateway-auth");
    expect(args).toContain("token");
    expect(args).toContain("--gateway-token");
    expect(args).toContain("test-token-abc");
    expect(args).toContain("--flow");
    expect(args).toContain("quickstart");
  });

  it("defaults flow to quickstart", () => {
    const args = buildOnboardArgs({}, ctx);
    const flowIdx = args.indexOf("--flow");
    expect(args[flowIdx + 1]).toBe("quickstart");
  });

  it("respects custom flow", () => {
    const args = buildOnboardArgs({ flow: "advanced" }, ctx);
    const flowIdx = args.indexOf("--flow");
    expect(args[flowIdx + 1]).toBe("advanced");
  });

  it("adds --auth-choice when provided", () => {
    const args = buildOnboardArgs({ authChoice: "openai-api-key" }, ctx);
    expect(args).toContain("--auth-choice");
    expect(args).toContain("openai-api-key");
  });

  it("maps openai-api-key secret to --openai-api-key flag", () => {
    const args = buildOnboardArgs(
      { authChoice: "openai-api-key", authSecret: "sk-123" },
      ctx,
    );
    expect(args).toContain("--openai-api-key");
    expect(args).toContain("sk-123");
  });

  it("maps apiKey (Anthropic) secret to --anthropic-api-key flag", () => {
    const args = buildOnboardArgs(
      { authChoice: "apiKey", authSecret: "ant-key" },
      ctx,
    );
    expect(args).toContain("--anthropic-api-key");
    expect(args).toContain("ant-key");
  });

  it("maps openrouter-api-key", () => {
    const args = buildOnboardArgs(
      { authChoice: "openrouter-api-key", authSecret: "or-key" },
      ctx,
    );
    expect(args).toContain("--openrouter-api-key");
    expect(args).toContain("or-key");
  });

  it("maps gemini-api-key", () => {
    const args = buildOnboardArgs(
      { authChoice: "gemini-api-key", authSecret: "gem-key" },
      ctx,
    );
    expect(args).toContain("--gemini-api-key");
  });

  it("maps minimax-api and minimax-api-lightning to same flag", () => {
    const a1 = buildOnboardArgs({ authChoice: "minimax-api", authSecret: "k" }, ctx);
    const a2 = buildOnboardArgs({ authChoice: "minimax-api-lightning", authSecret: "k" }, ctx);
    expect(a1).toContain("--minimax-api-key");
    expect(a2).toContain("--minimax-api-key");
  });

  it("does not add secret flag when secret is empty", () => {
    const args = buildOnboardArgs(
      { authChoice: "openai-api-key", authSecret: "" },
      ctx,
    );
    expect(args).not.toContain("--openai-api-key");
  });

  it("does not add secret flag when secret is whitespace-only", () => {
    const args = buildOnboardArgs(
      { authChoice: "openai-api-key", authSecret: "   " },
      ctx,
    );
    expect(args).not.toContain("--openai-api-key");
  });

  it("handles Anthropic setup-token flow", () => {
    const args = buildOnboardArgs(
      { authChoice: "token", authSecret: "setup-tok-xyz" },
      ctx,
    );
    expect(args).toContain("--token-provider");
    expect(args).toContain("anthropic");
    expect(args).toContain("--token");
    expect(args).toContain("setup-tok-xyz");
  });

  it("does not add token-provider for non-token auth choices", () => {
    const args = buildOnboardArgs(
      { authChoice: "openai-api-key", authSecret: "sk-123" },
      ctx,
    );
    expect(args).not.toContain("--token-provider");
  });

  it("handles auth choice with no matching secret map entry", () => {
    const args = buildOnboardArgs(
      { authChoice: "codex-cli", authSecret: "whatever" },
      ctx,
    );
    expect(args).toContain("--auth-choice");
    expect(args).toContain("codex-cli");
    // No mapped flag, so secret should not appear
    expect(args).not.toContain("whatever");
  });
});

// ---------- parseBasicAuth ----------

describe("parseBasicAuth", () => {
  function encode(user, pass) {
    return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  }

  it("returns password from valid Basic header", () => {
    expect(parseBasicAuth(encode("admin", "secret123"))).toBe("secret123");
  });

  it("returns empty string for empty password", () => {
    expect(parseBasicAuth(encode("admin", ""))).toBe("");
  });

  it("handles password containing colons", () => {
    expect(parseBasicAuth(encode("admin", "pass:with:colons"))).toBe("pass:with:colons");
  });

  it("returns null for missing header", () => {
    expect(parseBasicAuth(undefined)).toBe(null);
    expect(parseBasicAuth("")).toBe(null);
  });

  it("returns null for non-Basic scheme", () => {
    expect(parseBasicAuth("Bearer token123")).toBe(null);
  });

  it("returns null for Basic without encoded part", () => {
    expect(parseBasicAuth("Basic")).toBe(null);
  });
});

// ---------- makeSetupAuth ----------

describe("makeSetupAuth", () => {
  function mockReq(authHeader) {
    return { headers: { authorization: authHeader } };
  }

  function mockRes() {
    const res = {
      statusCode: 200,
      headers: {},
      body: "",
      status(code) { res.statusCode = code; return res; },
      type(t) { res.headers["content-type"] = t; return res; },
      send(b) { res.body = b; return res; },
      set(k, v) { res.headers[k] = v; return res; },
    };
    return res;
  }

  function encode(user, pass) {
    return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  }

  it("returns 500 when password is not set", () => {
    const auth = makeSetupAuth(undefined);
    const res = mockRes();
    auth(mockReq(), res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body).toContain("SETUP_PASSWORD is not set");
  });

  it("returns 401 when no auth header is provided", () => {
    const auth = makeSetupAuth("mypass");
    const res = mockRes();
    auth(mockReq(undefined), res, () => {});
    expect(res.statusCode).toBe(401);
    expect(res.headers["WWW-Authenticate"]).toContain("Basic");
  });

  it("returns 401 for wrong password", () => {
    const auth = makeSetupAuth("correct");
    const res = mockRes();
    auth(mockReq(encode("user", "wrong")), res, () => {});
    expect(res.statusCode).toBe(401);
  });

  it("calls next() for correct password", () => {
    const auth = makeSetupAuth("correct");
    const res = mockRes();
    let nextCalled = false;
    auth(mockReq(encode("user", "correct")), res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("accepts any username", () => {
    const auth = makeSetupAuth("pass");
    const res = mockRes();
    let nextCalled = false;
    auth(mockReq(encode("anything", "pass")), res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });
});

// ---------- clawArgs ----------

describe("clawArgs", () => {
  it("prepends entry to args", () => {
    expect(clawArgs("/openclaw/dist/entry.js", ["gateway", "run"]))
      .toEqual(["/openclaw/dist/entry.js", "gateway", "run"]);
  });

  it("returns just entry when args is empty", () => {
    expect(clawArgs("/entry.js", [])).toEqual(["/entry.js"]);
  });
});
