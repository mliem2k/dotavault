#!/usr/bin/env node

// Usage: node scripts/screenshot.mjs [local|dota2|both] [scroll-y]
// Examples:
//   node scripts/screenshot.mjs both
//   node scripts/screenshot.mjs local 900
//   node scripts/screenshot.mjs dota2 800

import { mkdirSync } from 'fs'
import { resolve } from 'path'
import { chromium } from '/private/tmp/claude-501/-Users-mliem-Documents-GitHub/3dfb37f3-ac0a-4ee9-8b9c-a4c0cf9a980e/scratchpad/node_modules/playwright/index.mjs'

const REFS = resolve(import.meta.dirname, '../references')
mkdirSync(REFS, { recursive: true })

const URLS = {
  local: 'http://localhost:5174/hero/axe',
  dota2: 'https://www.dota2.com/hero/axe',
}

const target = process.argv[2] ?? 'local'
const scrollY = Number(process.argv[3] ?? 800)

const browser = await chromium.launch({ headless: true })

async function shot(name, url) {
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1400, height: 900 })
  console.log(`Loading ${url}...`)
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.evaluate(() =>
    document.querySelectorAll('video').forEach((v) => {
      v.pause()
    }),
  )
  await page.evaluate((y) => window.scrollTo(0, y), scrollY)
  await page.waitForTimeout(600)
  await page.evaluate(() =>
    document.querySelectorAll('video').forEach((v) => {
      v.pause()
    }),
  )
  const path = `${REFS}/${name}_axe_abilities.png`
  await page.screenshot({ path })
  console.log(`Saved: ${path}`)
  await page.close()
}

const targets = target === 'both' ? ['local', 'dota2'] : [target]
for (const t of targets) {
  await shot(t === 'local' ? 'dotavault' : 'dota2', URLS[t])
}

await browser.close()
console.log('Done')
