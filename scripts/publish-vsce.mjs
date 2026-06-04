#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { dotenv } from 'dotenv';
import { readdirSync } from 'fs'
import { join } from 'path';

dotenv.config({ path: '.env' })

const dir = join(process.cwd(), 'release', 'latest')
let files = []
try { files = readdirSync(dir).filter(f => f.toLowerCase().endsWith('.vsix')); }
catch (e) { console.error('No release/latest directory found'); process.exit(1); }

if (files.length === 0) { console.error('No .vsix found in release/latest'); process.exit(1); }
const file = join(dir, files[0]);

const token = process.env.VSCE_TOKEN
if (!token) { console.error('VSCE_TOKEN not set'); process.exit(1); }

const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = ['dlx', 'vsce', 'publish', '--pat', token, '--packagePath', file]

const r = spawnSync(cmd, args, { stdio: 'inherit' })
process.exit(r.status)
