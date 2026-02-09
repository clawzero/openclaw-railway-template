# Yellow Deployment on Railway - Best Practices

## Problem Statement

Yellow runs on Railway with ephemeral containers. When the container restarts:
- Doppler CLI disappears
- Installed tools get lost
- Skills need reinstallation
- Environment variables reset

## Solutions

### 1. Bake Tools into Dockerfile

Add tools during build so they're always available:

```dockerfile
# In Dockerfile, add after FROM node:
RUN apt-get install -y curl wget git

# Install Doppler CLI
RUN curl -Ls https://cli.doppler.com/install.sh | sh
```

### 2. Use Doppler for Secrets

All secrets stored in Doppler:
```
yellow-claw project / dev_yellow config
```

Access via:
```bash
doppler secrets get SECRET_NAME --project yellow-claw --config dev_yellow --raw
```

### 3. Symlink to Persistent Volume

The `/data` directory persists. Symlink tools there:

```bash
# In server.js or setup script:
mkdir -p /data/.doppler
mkdir -p /data/.npm
mkdir -p /data/.openclaw/skills

ln -sf /data/.doppler ~/.doppler
ln -sf /data/.npm ~/.npm
ln -sf /data/.openclaw/skills ~/.openclaw/skills
```

### 4. Set Environment Variables in Railway Dashboard

Never rely on container startup. Set in Railway:
```
NATIONAL_RAIL_TOKEN=...
HYPERLIQUID_ADDRESS=...
HYPERLIQUID_PRIVATE_KEY=...
```

### 5. Skills Installation

Skills should be:
- Installed to `/data/.openclaw/skills` (persistent)
- OR baked into Dockerfile
- Documented in `yellow/SKILL.md`

## Yellow Branch Structure

```
develop-yellow/
├── Dockerfile          # Includes tools (Doppler, etc.)
├── server.js          # Symlinks to /data for persistence
├── railway.toml        # Volume mount: /data
└── skills/            # Pre-installed skills (optional)
```

## Deployment Checklist

### 1. Add Tools to Dockerfile
```dockerfile
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*
```

### 2. Set Environment Variables in Railway Dashboard
```
DOPPLER_TOKEN=dp.st.your_token
NATIONAL_RAIL_TOKEN=...
HYPERLIQUID_ADDRESS=...
HYPERLIQUID_PRIVATE_KEY=...
```

### 3. Configure Volume Mount
In `railway.toml`:
```toml
[mounts]
  source = "openclaw-data"
  target = "/data"
```

### 4. Update server.js for Symlinks
Add before gateway starts:
```javascript
// Create symlinks to persistent volume
const paths = [
  { from: '/data/.doppler', to: '/root/.doppler' },
  { from: '/data/.npm', to: '/root/.npm' },
  { from: '/data/.openclaw/skills', to: '/root/.openclaw/skills' }
];
```

## Environment Variables to Set in Railway

Required:
```
DOPPLER_TOKEN=dp.st....        # For Doppler CLI access
NATIONAL_RAIL_TOKEN=...        # UK Train API
```

Optional (for Hyperliquid):
```
HYPERLIQUID_ADDRESS=0x...
HYPERLIQUID_PRIVATE_KEY=0x...
```

## Skills Persistence

### Option A: Install to /data (Recommended)
```bash
# Install skill
npx clawhub install skill-name

# Copy to persistent volume
cp -r /data/workspace/skills/skill-name /data/.openclaw/skills/
```

### Option B: Bake into Dockerfile
```dockerfile
RUN npx clawhub install skill-name && \
    cp -r skills/skill-name /data/.openclaw/skills/
```

## Workflow

### 1. Develop locally
```bash
# Test skills
npx clawhub install skill-name
./skill-name/scripts/run.sh
```

### 2. Commit to develop-yellow
```bash
git add .
git commit -m "feat: Add new skill"
git push origin develop-yellow
```

### 3. Deploy from Railway
- Connect `develop-yellow` branch in Railway
- Set environment variables in Railway dashboard
- Deploy

### 4. Verify
```bash
# SSH into Railway container
# Check tools exist
which doppler
doppler --version

# Check skills
ls /data/.openclaw/skills/
```

## Troubleshooting

### "Doppler not found"
→ Set `DOPPLER_TOKEN` in Railway dashboard

### "Skill not loading"
→ Check skill is in `/data/.openclaw/skills/`

### "Environment variable not set"
→ Set in Railway dashboard, not in container

### "Permission denied"
→ Check SSH keys in Doppler are valid

## Maintenance

### Weekly
- [ ] Review Doppler tokens
- [ ] Check skill versions
- [ ] Verify environment variables

### Monthly
- [ ] Update tools in Dockerfile
- [ ] Review security (rotate tokens)
- [ ] Backup configurations

## References

- Railway Docs: https://railway.app/docs
- Doppler CLI: https://docs.doppler.com/docs/cli
- OpenClaw Skills: https://github.com/openclaw/skills
