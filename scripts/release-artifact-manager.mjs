import { renameSync, readdirSync, existsSync, readFileSync, writeFileSync, statSync, mkdirSync } from "fs"
import { join, basename, extname, dirname } from "path"
import { createHash } from "crypto"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const genDir = join(__dirname, "../apps/client")
const distPath = join(__dirname, "../release")
const latestDir = join(__dirname, "../release/latest")
const archiveDir = join(__dirname, "../release/archive")
const manifestPath = join(__dirname, "../release/manifest.json")

function sha256File(path) {
  const data = readFileSync(path)
  return createHash("sha256").update(data).digest("hex")
}

function ensureDirs() {
  mkdirSync(latestDir, {recursive: true })
  mkdirSync(archiveDir, {recursive: true })
}

function findVsixIn(dir) {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
  return files.find(f => f.toLowerCase().endsWith(".vsix")) || null
}

function extractVersionFromFilename(name) {
  const m = name.match(/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/)
  return m ? m[1] : null
}

function loadManifest() {
  if (!existsSync(manifestPath)) return { latest: null, archive: [] }
  try {
    const raw = readFileSync(manifestPath, "utf8")
    return JSON.parse(raw)
  } catch (err) {
    console.warn("⚠️ invalid manifest.json, re-create:", err.message)
    return { latest: null, archive: [] }
  }
}

function saveManifest(manifest) {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8")
}

function moveFile(src, dest) {
  renameSync(src, dest)
}

function isoNow() {
  return new Date().toISOString()
}

function main() {
  try {
    ensureDirs()

    // Find vsix in `apps/client`
    const vsixFile = findVsixIn(genDir)
    if (!vsixFile) {
      console.error("❌ No .vsix file found to move in", genDir)
      process.exit(1)
    }
    const srcPath = join(genDir, vsixFile)

    // if have `.vsix` in `release/latest` archive-it
    const existingLatest = findVsixIn(latestDir)
    if (existingLatest) {
      const existingPath = join(latestDir, existingLatest)
      const archivePath = join(archiveDir, existingLatest)
      moveFile(existingPath, archivePath)
      console.log (`📦 Archived previous latest: ${existingLatest} -> archive/${existingLatest}`)
    }

    // Move new .vsix to latest
    const destPath = join(latestDir, vsixFile)
    moveFile(srcPath, destPath)
    console.log(`✅ Moved ${vsixFile} to ${latestDir}`)

    const fileSha = sha256File(destPath)
    const fileStat = statSync(destPath)
    const ver = extractVersionFromFilename(vsixFile)
    const manifest = loadManifest()

    const entry = {
      filename: vsixFile,
      path: `latest/${vsixFile}`,
      version: ver,
      sha256: fileSha,
      size: fileStat.size,
      date: isoNow(),
      tag: process.env.TAG || null,
      commit: process.env.COMMIT_SHA || null
    }

    // Update Manifest
    if (manifest.latest) {
      manifest.archive = manifest.archive || []
      manifest.archive.unshift(manifest.latest)
    }

    manifest.latest = entry

    saveManifest(manifest)
    console.log(`📝 Updated manifest at ${manifestPath}`)
    console.log(`   version: ${ver || "unknown"}, sha256: ${fileSha}`)
  } catch (err) {
    console.error("❌ mover.js failed:", err)
    process.exit(1)
  }
}

main()
