#!/bin/bash
# Clean Next.js build cache and node_modules cache
echo "[v0] Cleaning Next.js cache..."
rm -rf /vercel/share/v0-project/.next/cache
echo "[v0] Cache cleaned successfully!"
