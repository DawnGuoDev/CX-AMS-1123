#!/usr/bin/env node
/**
 * Offline guard: fail if production source reaches out to the Java API, login/session storage,
 * external HTTP endpoints, or vue-router. package-lock is not scanned (registry metadata).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const scanRoots = ['src', 'mock']
const files = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.(vue|js|css|json|html)$/.test(name)) files.push(path)
  }
}
scanRoots.forEach(dir => walk(join(root, dir)))
files.push(join(root, 'index.html'))

const rules = [
  ['Java API', /\bfetch\s*\(|['"`]\/api(?:\/|['"`])|\/bootstrap\b/],
  ['login/session', /ams_java_token|sessionStorage|login-screen|登入/],
  ['HTTP(S) URL', /https?:\/\/(?!127\.0\.0\.1|localhost)[^\s'"`)<]+/],
  ['vue-router', /from\s+['"]vue-router['"]|createWebHashHistory/],
]
const violations = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const [label, pattern] of rules) {
    const match = text.match(pattern)
    if (match) violations.push(`${relative(root, file)}: ${label} -> ${match[0].slice(0, 80)}`)
  }
}
if (violations.length) {
  console.error(`OFFLINE CHECK FAILED (${violations.length})\n` + violations.join('\n'))
  process.exit(1)
}
console.log(`OFFLINE CHECK PASSED: ${files.length} files in src/, mock/, index.html; no API/login/HTTP/vue-router dependency.`)
