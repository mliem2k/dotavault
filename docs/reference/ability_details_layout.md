# Ability Details: dota2.com Reference Layout

Measured at 1568px viewport, scroll to ability section (pause videos first:
`document.querySelectorAll('video').forEach(v => v.pause())`).

## Two-column structure

```
[LEFT: video + selector]  [RIGHT: dark details panel]
```

### Left column (max ~700px)
- Video fills full width, 16:9 aspect ratio, background #08080a
- Below video: horizontal row of 64x64 ability icon buttons
  - Active: gold border #c9a94a, full opacity
  - Inactive: faint border rgba(255,255,255,0.08), 50% opacity
  - Gap 1 between icons, px-2 py-2 padding, background #0c0b0f

### Right column (flex-1, background #0c0b0f)

**Section 1: Icon + Name + Description** (border-bottom #1c1810, p-5)
- Ability icon: 84x84px, border #2a2620
- Name: UPPERCASE, Reaver 26px/700, #fff, letterSpacing 1px
- Description: 16px, Radiance, #c8c2b4

**Section 2: Type row** (grid-cols-2, border-bottom #1c1810, px-5 py-4)
- Label: 11px uppercase, #6a675e
- Value: 14px bold, #dcd6c8 (or colored: ability type #9fb8d8, dmg #e8a070, pierce green/grey)

**Section 3: Attributes** (border-bottom #1c1810, px-5 py-4)
- Each on its own line: "LABEL: value"
- Label: 12px uppercase, #6a675e
- Value: 15px bold tabular, #dcd6c8

**Section 4: Cooldown + Mana** (justify-between, px-5 py-4)
- Cooldown: icon + 16px bold #c9a94a
- Mana: icon + 16px bold #5a8fc2

**Section 5: Lore box** (px-5 py-4)
- 13px italic, #77715f
- Box: background rgba(255,255,255,0.03), border #1c1810, px-3 py-2

## Screenshot approach

Use Playwright (headless) to save directly to `references/`:

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers \
  ~/.nvm/versions/node/v24.13.1/bin/node --input-type=module << 'EOF'
import { chromium } from '/private/tmp/.../scratchpad/node_modules/playwright/index.mjs'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.setViewportSize({ width: 1800, height: 900 })
await page.goto('https://www.dota2.com/hero/axe', { waitUntil: 'networkidle' })
await page.evaluate(() => document.querySelectorAll('video').forEach(v => v.pause()))
await page.evaluate(() => window.scrollTo(0, 900))
await page.waitForTimeout(800)
await page.screenshot({ path: 'references/dota2_axe_abilities.png' })
await browser.close()
EOF
```

One-time setup: `PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers ~/.nvm/versions/node/v24.13.1/bin/npx playwright install chromium`
