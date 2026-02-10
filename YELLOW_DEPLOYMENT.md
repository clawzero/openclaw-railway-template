# Yellow Deployment on Railway - Best Practices

## The Right Way: Doppler → Railway Sync

**Only `DOPPLER_TOKEN` needed in Railway!**

All other secrets sync automatically from Doppler!

## How It Works

```
Doppler (secrets) ──────→ Railway (environment variables)
     ↑
     │  Railway API Token
     └─────────────────────
```

## Setup (One-Time)

### 1. Create Railway API Token

Go to: https://railway.app/account/tokens
- Click "Create Token"
- Name: "Doppler Integration"
- Copy the token

### 2. Add to Doppler

**In Doppler Dashboard:**
1. Go to yellow-claw project → Integrations → Railway
2. Paste Railway API Token
3. Connect to your Yellow Railway project

### 3. Set ONE env var in Railway

```
DOPPLER_TOKEN=dp.st.your_doppler_service_token
```

**This `DOPPLER_TOKEN` is for the CLI to authenticate.**

## Secrets That Sync

From Doppler `yellow-claw` project / `dev_yellow` config:

```
GITHUB_TOKEN
ANTHROPIC_SETUP_TOKEN
TELEGRAM_BOT_TOKEN
NATIONAL_RAIL_TOKEN
HYPERLIQUID_ADDRESS
HYPERLIQUID_PRIVATE_KEY
MATON_API_KEY
```

## Tools Persistence

### Doppler CLI

**Baked into Dockerfile:**

```dockerfile
RUN curl -Ls https://cli.doppler.com/install.sh | sh
```

**Authenticate with:**

```bash
export DOPPLER_TOKEN=dp.st.your_service_token
doppler login --token $DOPPLER_TOKEN
```

### Other Tools

**Also baked in:**

```dockerfile
RUN apt-get install -y curl wget git gnupg lsb-release
```

## Skills Persistence

Skills installed to `/data/.openclaw/skills` (persistent volume).

## Quick Reference

| What | Where |
|------|--------|
| Most secrets | Doppler (auto-syncs to Railway) |
| CLI auth token | Railway (`DOPPLER_TOKEN`) |
| Railway API token | Doppler (for sync) |

## References

- Doppler Railway: https://docs.doppler.com/docs/railway
- Doppler CLI: https://docs.doppler.com/docs/cli
- Yellow Skills: https://github.com/clawzero/claw-skills/tree/main/yellow
