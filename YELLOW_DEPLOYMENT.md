# Yellow Deployment on Railway - Best Practices

## The Right Way: Doppler → Railway Sync

**Only ONE environment variable needed in Railway: `DOPPLER_TOKEN`**

All other secrets sync automatically from Doppler!

## How It Works

```
Doppler (secrets) ←→ Railway (environment variables)
     ↓
   Doppler CLI authenticates with DOPPLER_TOKEN
     ↓
   All other secrets sync automatically
```

## Setup (One-Time)

### 1. Connect Doppler to Railway

**In Doppler Dashboard:**
1. Go to your project → Integrations → Railway
2. Add Railway API Token (get from railway.app/account/tokens)
3. Select your Yellow Railway project
4. Select `dev_yellow` config to sync
5. Enable "Redeploy on secret change"

### 2. Set ONE env var in Railway Dashboard

```
DOPPLER_TOKEN=dp.st.your_doppler_service_token
```

**That's it!** All other secrets sync automatically from Doppler.

## Secrets That Sync

From `yellow-claw` project / `dev_yellow` config:

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

**Baked into Dockerfile** so it's always available:

```dockerfile
# Runtime image
RUN curl -Ls https://cli.doppler.com/install.sh | sh
```

**Authenticate with:**

```bash
export DOPPLER_TOKEN=dp.st.your_token
doppler login --token $DOPPLER_TOKEN
```

### Other Tools

**Also baked into Dockerfile:**

```dockerfile
RUN apt-get install -y \
    curl \
    wget \
    git \
    gnupg \
    lsb-release
```

## Skills Persistence

Skills are installed to `/data/.openclaw/skills` (persistent volume).

### Install a Skill

```bash
npx clawhub install skill-name
cp -r /data/workspace/skills/skill-name /data/.openclaw/skills/
```

### Available Skills

See Yellow's skill documentation:
https://github.com/clawzero/claw-skills/tree/main/yellow

## deploy-yellow Branch

**Branch:** `develop-yellow`

**What it includes:**
- Dockerfile with Doppler CLI + tools baked in
- Railway.toml with volume mount
- Best practices documentation

## Workflow

### 1. Add a new secret

```bash
# In Doppler dashboard:
# yellow-claw project → dev_yellow config → Add SECRET

# Or via CLI:
doppler secrets set NEW_SECRET=value --project yellow-claw --config dev_yellow
```

Doppler syncs to Railway → Service redeploys automatically ✓

### 2. Add a new skill

```bash
# Install
npx clawhub install skill-name

# Make persistent
cp -r /data/workspace/skills/skill-name /data/.openclaw/skills/

# Document
# Update yellow/SKILL.md in claw-skills repo
```

### 3. Add a new tool

```bash
# In develop-yellow branch → Update Dockerfile
# Commit → Push → Railway redeploys automatically
```

## Environment Variables

### In Doppler (auto-syncs to Railway)

| Secret | Purpose |
|--------|---------|
| GITHUB_TOKEN | GitHub API |
| ANTHROPIC_SETUP_TOKEN | Claude models |
| TELEGRAM_BOT_TOKEN | Telegram bot |
| NATIONAL_RAIL_TOKEN | UK Trains API |
| HYPERLIQUID_ADDRESS | Hyperliquid (read-only) |
| HYPERLIQUID_PRIVATE_KEY | Hyperliquid (trading) |
| MATON_API_KEY | Gmail API |

### In Dockerfile (baked into image)

| Tool | Purpose |
|------|---------|
| Doppler CLI | Secrets management |
| curl | HTTP requests |
| wget | Downloads |
| git | Version control |
| gnupg | GPG signing |
| lsb-release | System info |

## Troubleshooting

### "Doppler not authenticated"
→ Check `DOPPLER_TOKEN` is set in Railway

### "Secret not found"
→ Verify secret exists in Doppler dashboard
→ Check correct project/config: `yellow-claw` / `dev_yellow`

### "Skill not loading"
→ Check skill is in `/data/.openclaw/skills/`
→ Restart gateway if needed

### "Permission denied"
→ Check GitHub token has correct scopes
→ Verify SSH keys in Doppler

## Quick Reference

| What | Where |
|------|-------|
| Secrets | Doppler (auto-syncs) |
| Doppler CLI | Dockerfile (baked) |
| Tools | Dockerfile (baked) |
| Skills | `/data/.openclaw/skills/` |
| Env vars in Railway | `DOPPLER_TOKEN` only |

## References

- Doppler Railway Integration: https://docs.doppler.com/docs/railway
- Doppler Dockerfile: https://docs.doppler.com/docs/dockerfile
- Yellow Skills: https://github.com/clawzero/claw-skills/tree/main/yellow
- OpenClaw Skills: https://github.com/openclaw/skills

---

## ⚠️ Important: Use Service Tokens

**For CLI/production use, always use a Service Token, NOT your personal token.**

### Why Service Tokens?

| | Service Token | Personal Token |
|---|-------------|---------------|
| Access | Read-only | Full write access |
| Scope | Single config | All configs |
| Safety | ✅ Safe for production | ❌ Don't use |

### Create Service Token

**Dashboard:**
1. Go to Doppler → yellow-claw project → dev_yellow config
2. Click "Access" tab
3. Click "Generate"
4. Name: "Railway-CLI"
5. Copy token (shown once!)

**CLI:**
```bash
doppler configs tokens create railway-cli --project yellow-claw --config dev_yellow --plain
```

### Set in Railway

```
DOPPLER_TOKEN=dp.st.your_service_token_here
```

### ⚠️ Security Reminder

**Never commit tokens!**
- Service Tokens → Environment variables only
- Personal Tokens → Only for local development
- Use Doppler dashboard for secrets management
