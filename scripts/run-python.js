#!/usr/bin/env node
// Cross-platform launcher for the project's virtualenv Python interpreter.
//
// `npm run` scripts run `python …` by default, but on Windows that resolves to
// the system Python (no packages). This launcher prefers the venv interpreter:
//   .venv/Scripts/python.exe   (Windows)
//   .venv/bin/python           (macOS / Linux)
// and falls back to `python`/`python3` if no venv exists.
//
// Usage: node scripts/run-python.js -m backend.api.main

const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const isWin = process.platform === "win32"

const candidates = isWin
  ? [path.join(root, ".venv", "Scripts", "python.exe"), "python"]
  : [path.join(root, ".venv", "bin", "python"), "python3", "python"]

const exe = candidates.find((c) => !path.isAbsolute(c) || fs.existsSync(c)) ?? "python"

const res = spawnSync(exe, process.argv.slice(2), { stdio: "inherit" })
process.exit(res.status ?? (res.error ? 1 : 0))