#!/usr/bin/env bun
/*
 * One-off (rerunnable) generator: derives an approximate terrain heightmap
 * from public/minimap.webp's own pixel colors, for the 3D replay viewer's
 * ground displacement. This is NOT Valve's real terrain mesh, just a coarse
 * visual approximation from the 2D map art: cliffs/rock render as
 * desaturated grey/tan against saturated green grass and blue/teal water.
 *
 * Rerun with: bun run apps/web/scripts/generate-terrain-heightmap.ts
 * Requires `dwebp` (libwebp) on PATH to decode the source image.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SOURCE = join(import.meta.dirname, '../public/minimap.webp')
const OUT = join(import.meta.dirname, '../public/models/terrain_heightmap.json')
const GRID = 64 // cells per axis, matches the ground plane's segment count

function decodeToPpm(webpPath: string): { width: number; height: number; rgb: Buffer } {
  const ppmPath = join(tmpdir(), `terrain-heightmap-${Date.now()}.ppm`)
  try {
    execFileSync('dwebp', [webpPath, '-ppm', '-o', ppmPath], { stdio: 'pipe' })
    const buf = readFileSync(ppmPath)
    // P6 header: "P6\n<width> <height>\n255\n" then raw RGB triples.
    const headerMatch = /^P6\s+(\d+)\s+(\d+)\s+255\s/.exec(buf.toString('latin1', 0, 32))
    if (!headerMatch) throw new Error('unexpected ppm header from dwebp')
    const width = Number(headerMatch[1])
    const height = Number(headerMatch[2])
    const dataStart = headerMatch[0].length
    return { width, height, rgb: buf.subarray(dataStart) }
  } finally {
    rmSync(ppmPath, { force: true })
  }
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

// Elevation heuristic: water and saturated green (grass/forest) stay at
// ground level; desaturated, brighter grey/tan reads as raised rock.
function elevationScore(h: number, s: number, l: number): number {
  const isWater = h >= 150 && h <= 260 && s > 0.2
  const isGreenGround = h >= 70 && h <= 165 && s > 0.15
  if (isWater || isGreenGround) return 0
  const desaturation = Math.max(0, 1 - s - 0.3)
  return Math.max(0, Math.min(1, desaturation * l))
}

function boxBlur(values: Float64Array, size: number, passes: number): Float64Array {
  let src = values
  for (let p = 0; p < passes; p++) {
    const dst = new Float64Array(size * size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let sum = 0
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue
            sum += src[ny * size + nx] ?? 0
            count++
          }
        }
        dst[y * size + x] = sum / count
      }
    }
    src = dst
  }
  return src
}

const { width, height, rgb } = decodeToPpm(SOURCE)
const raw = new Float64Array(GRID * GRID)

for (let gy = 0; gy < GRID; gy++) {
  for (let gx = 0; gx < GRID; gx++) {
    const x0 = Math.floor((gx / GRID) * width)
    const x1 = Math.floor(((gx + 1) / GRID) * width)
    const y0 = Math.floor((gy / GRID) * height)
    const y1 = Math.floor(((gy + 1) / GRID) * height)
    let rSum = 0
    let gSum = 0
    let bSum = 0
    let n = 0
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * width + px) * 3
        rSum += rgb[i] ?? 0
        gSum += rgb[i + 1] ?? 0
        bSum += rgb[i + 2] ?? 0
        n++
      }
    }
    const { h, s, l } = rgbToHsl(rSum / n, gSum / n, bSum / n)
    raw[gy * GRID + gx] = elevationScore(h, s, l)
  }
}

const smoothed = boxBlur(raw, GRID, 3)
const max = Math.max(...smoothed, 1e-6)
const normalized = Array.from(smoothed, (v) => v / max)

mkdirSync(join(import.meta.dirname, '../public/models'), { recursive: true })
writeFileSync(OUT, JSON.stringify({ size: GRID, heights: normalized }))
console.log(`wrote ${OUT} (${GRID}x${GRID})`)
