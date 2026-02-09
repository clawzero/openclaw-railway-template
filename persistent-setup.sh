#!/bin/bash
# Setup script to initialize persistent tools

# Create persistent directories
mkdir -p /data/.openclaw/skills
mkdir -p /data/.doppler

# Symlink for skills
ln -sf /data/.openclaw/skills /root/.openclaw/skills 2>/dev/null || true

# Symlink for Doppler
ln -sf /data/.doppler /root/.local/share/doppler 2>/dev/null || true

echo "Persistent directories initialized at /data/.openclaw"
