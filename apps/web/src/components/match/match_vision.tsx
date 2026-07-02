import { useEffect, useRef } from 'react'
import type { HeroStat, MatchPlayer } from 'types'
import { heroIconUrl } from '@/lib/utils'

const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF', 1: '#66FFBF', 2: '#BF00BF', 3: '#F3F00B', 4: '#FF6600',
  128: '#FE87C4', 129: '#A1B477', 130: '#65D9F7', 131: '#007A00', 132: '#A46900',
}

const MAP_MIN = 0
const MAP_MAX = 127

function toCanvas(val: number, size: number): number {
  return ((val - MAP_MIN) / (MAP_MAX - MAP_MIN)) * size
}

export function MatchVision({
  players,
  heroStats,
}: {
  players: MatchPlayer[]
  heroStats: HeroStat[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapImgRef = useRef<HTMLImageElement | null>(null)

  const heroMap = new Map(heroStats.map((h) => [h.id, h]))

  const hasData = players.some(
    (p) => (p.obs_log?.length ?? 0) > 0 || (p.sen_log?.length ?? 0) > 0,
  )

  useEffect(() => {
    const img = new Image()
    img.src = '/minimap.webp'
    img.onload = () => {
      mapImgRef.current = img
      draw()
    }
  }, [])

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const size = canvas.width

    ctx.clearRect(0, 0, size, size)
    if (mapImgRef.current) {
      ctx.drawImage(mapImgRef.current, 0, 0, size, size)
    } else {
      ctx.fillStyle = '#0a1a0a'
      ctx.fillRect(0, 0, size, size)
    }

    for (const player of players) {
      const color = PLAYER_COLORS[player.player_slot] ?? '#888'

      for (const ward of player.obs_log ?? []) {
        const cx = toCanvas(ward.x, size)
        const cy = size - toCanvas(ward.y, size)
        ctx.beginPath()
        ctx.arc(cx, cy, 5, 0, Math.PI * 2)
        ctx.fillStyle = `${color}cc`
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1
        ctx.stroke()
        // eye icon: small dot inside
        ctx.beginPath()
        ctx.arc(cx, cy, 2, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
      }

      for (const ward of player.sen_log ?? []) {
        const cx = toCanvas(ward.x, size)
        const cy = size - toCanvas(ward.y, size)
        // Sentry: diamond shape
        ctx.beginPath()
        ctx.moveTo(cx, cy - 6)
        ctx.lineTo(cx + 5, cy)
        ctx.lineTo(cx, cy + 6)
        ctx.lineTo(cx - 5, cy)
        ctx.closePath()
        ctx.fillStyle = `${color}99`
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  }

  useEffect(() => {
    draw()
  })

  if (!hasData) {
    return <p className="px-4 pb-4 text-xs text-muted">No ward data available for this match.</p>
  }

  const obsTotal = players.reduce((s, p) => s + (p.obs_log?.length ?? 0), 0)
  const senTotal = players.reduce((s, p) => s + (p.sen_log?.length ?? 0), 0)

  return (
    <div className="space-y-3 px-4 pb-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>● Observer wards placed: <span className="text-foreground font-mono">{obsTotal}</span></span>
        <span>◆ Sentry wards placed: <span className="text-foreground font-mono">{senTotal}</span></span>
      </div>
      <div className="flex gap-4 flex-wrap">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="rounded-lg border border-border"
        />
        <div className="flex flex-col gap-1.5 text-[10px]">
          {players.map((p) => {
            const hero = heroMap.get(p.hero_id)
            const color = PLAYER_COLORS[p.player_slot] ?? '#888'
            const obs = p.obs_log?.length ?? 0
            const sen = p.sen_log?.length ?? 0
            if (obs === 0 && sen === 0) return null
            return (
              <div key={p.player_slot} className="flex items-center gap-1.5" style={{ color }}>
                {hero && <img src={heroIconUrl(hero.name)} alt="" className="h-4 w-4 rounded-sm" />}
                <span>{hero?.localized_name ?? `Slot ${p.player_slot}`}</span>
                {obs > 0 && <span className="text-muted">● {obs}</span>}
                {sen > 0 && <span className="text-muted">◆ {sen}</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
