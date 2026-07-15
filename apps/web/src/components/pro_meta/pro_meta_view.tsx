import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { ProMetaHeroRow, ProMetaWinrateCell } from 'types'
import { Badge } from '@/components/ui/badge'
import { SortHeader } from '@/components/ui/sort_header'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LANES, ROLE_OPTIONS } from '@/lib/lane_roles'
import { opendota } from '@/lib/opendota'
import { fetchProMeta } from '@/lib/pro_meta'
import { applySort, useSort } from '@/lib/sortable'
import { usePageTitle } from '@/lib/title'
import { heroIconUrl, heroSlug } from '@/lib/utils'

// Pro-match volume per patch is far lower than public matches (meta_view.tsx
// uses 100 as its floor there); 10 matches is enough to not be pure noise
// while still surfacing heroes early in a fresh patch.
const MIN_SAMPLE = 10

type HeroSortKey =
  | 'picks'
  | 'bans'
  | 'pickBanRate'
  | 'winrate'
  | 'radiant'
  | 'dire'
  | 'firstPick'
  | 'secondPick'

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

function StatBar({
  label,
  cell,
  variant,
}: {
  label: string
  cell: ProMetaWinrateCell
  variant: 'radiant' | 'dire'
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[13px] uppercase text-muted">{label}</span>
      <span
        className={`font-dota text-[15px] ${variant === 'radiant' ? 'text-radiant' : 'text-dire'}`}
      >
        {pct(cell.winrate)} <span className="text-muted text-[11px]">({cell.sample})</span>
      </span>
    </div>
  )
}

function ComboGrid({
  radiantFirst,
  radiantSecond,
  direFirst,
  direSecond,
}: {
  radiantFirst: ProMetaWinrateCell
  radiantSecond: ProMetaWinrateCell
  direFirst: ProMetaWinrateCell
  direSecond: ProMetaWinrateCell
}) {
  const cells: { label: string; cell: ProMetaWinrateCell; variant: 'radiant' | 'dire' }[] = [
    { label: 'Radiant + First Pick', cell: radiantFirst, variant: 'radiant' },
    { label: 'Radiant + Second Pick', cell: radiantSecond, variant: 'radiant' },
    { label: 'Dire + First Pick', cell: direFirst, variant: 'dire' },
    { label: 'Dire + Second Pick', cell: direSecond, variant: 'dire' },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {cells.map((c) => (
        <div
          key={c.label}
          className="border border-border p-3"
          style={{ background: 'rgba(12,11,14,0.72)' }}
        >
          <div className="text-[12px] uppercase text-muted mb-1">{c.label}</div>
          <div
            className={`font-dota text-[20px] ${c.variant === 'radiant' ? 'text-radiant' : 'text-dire'}`}
          >
            {pct(c.cell.winrate)}
          </div>
          <div className="text-[11px] text-muted">{c.cell.sample} matches</div>
        </div>
      ))}
    </div>
  )
}

function winCellText(cell: ProMetaWinrateCell): string {
  return cell.sample >= MIN_SAMPLE ? pct(cell.winrate) : '—'
}

function HeroTable({ heroes }: { heroes: ProMetaHeroRow[] }) {
  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
    staleTime: 5 * 60 * 1000,
  })
  const heroById = useMemo(
    () => new Map((heroStats.data ?? []).map((h) => [h.id, h])),
    [heroStats.data],
  )

  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]['key']>('all')
  const lane = role === 'all' ? null : (LANES.find((l) => l.pos === role) ?? null)
  const roleFiltered = useMemo(() => {
    if (!lane) return heroes
    return heroes.filter((h) => {
      const hero = heroById.get(h.heroId)
      return hero ? lane.filter(hero) : false
    })
  }, [heroes, lane, heroById])

  const { key, dir, onSort } = useSort<HeroSortKey>('picks')
  const cmp: Record<HeroSortKey, (a: ProMetaHeroRow, b: ProMetaHeroRow) => number> = {
    picks: (a, b) => a.picks - b.picks,
    bans: (a, b) => a.bans - b.bans,
    pickBanRate: (a, b) => a.pickBanRate - b.pickBanRate,
    winrate: (a, b) => a.winrate - b.winrate,
    radiant: (a, b) => a.radiant.winrate - b.radiant.winrate,
    dire: (a, b) => a.dire.winrate - b.dire.winrate,
    firstPick: (a, b) => a.firstPick.winrate - b.firstPick.winrate,
    secondPick: (a, b) => a.secondPick.winrate - b.secondPick.winrate,
  }
  const sorted = applySort(roleFiltered, dir, cmp[key])

  if (heroStats.isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1 font-dota" role="tablist">
        {ROLE_OPTIONS.map((r) => {
          const active = role === r.key
          return (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-current={active ? 'page' : undefined}
              onClick={() => setRole(r.key)}
              className={`min-h-11 flex cursor-pointer items-center px-3 py-1.5 text-[12px] uppercase tracking-[1px] border ${
                active ? 'bg-border border-gold text-foreground' : 'border-border text-muted'
              }`}
              style={{ background: active ? undefined : 'rgba(12,11,14,0.72)' }}
            >
              {r.label}
            </button>
          )
        })}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hero</TableHead>
            <TableHead>
              <SortHeader
                label="Picks"
                sortKey="picks"
                active={key === 'picks'}
                dir={dir}
                onClick={onSort}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Bans"
                sortKey="bans"
                active={key === 'bans'}
                dir={dir}
                onClick={onSort}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Pick+Ban%"
                sortKey="pickBanRate"
                active={key === 'pickBanRate'}
                dir={dir}
                onClick={onSort}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Winrate"
                sortKey="winrate"
                active={key === 'winrate'}
                dir={dir}
                onClick={onSort}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Radiant WR"
                sortKey="radiant"
                active={key === 'radiant'}
                dir={dir}
                onClick={onSort}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Dire WR"
                sortKey="dire"
                active={key === 'dire'}
                dir={dir}
                onClick={onSort}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="1st Pick WR"
                sortKey="firstPick"
                active={key === 'firstPick'}
                dir={dir}
                onClick={onSort}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="2nd Pick WR"
                sortKey="secondPick"
                active={key === 'secondPick'}
                dir={dir}
                onClick={onSort}
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((h) => {
            const hero = heroById.get(h.heroId)
            return (
              <TableRow key={h.heroId}>
                <TableCell>
                  {hero ? (
                    <Link
                      to="/hero/$heroName"
                      params={{ heroName: heroSlug(hero.localized_name) }}
                      className="flex items-center gap-2 hover:text-gold"
                    >
                      <img src={heroIconUrl(hero.name)} alt="" className="h-6 w-10 object-cover" />
                      {hero.localized_name}
                    </Link>
                  ) : (
                    `Hero #${h.heroId}`
                  )}
                </TableCell>
                <TableCell>{h.picks}</TableCell>
                <TableCell>{h.bans}</TableCell>
                <TableCell>{pct(h.pickBanRate)}</TableCell>
                <TableCell>{winCellText({ winrate: h.winrate, sample: h.picks })}</TableCell>
                <TableCell>{winCellText(h.radiant)}</TableCell>
                <TableCell>{winCellText(h.dire)}</TableCell>
                <TableCell>{winCellText(h.firstPick)}</TableCell>
                <TableCell>{winCellText(h.secondPick)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function ProMetaView() {
  usePageTitle('Pro Meta')
  const query = useQuery({
    queryKey: ['pro-meta'],
    queryFn: fetchProMeta,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  if (query.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="py-20 text-center text-muted">
        Pro meta stats are still being computed for the current patch. Check back shortly.
      </div>
    )
  }

  const data = query.data
  if (!data) return null
  if (data.totalMatches === 0) {
    return (
      <div className="py-20 text-center text-muted">
        Not enough tournament matches recorded yet for patch {data.patch.name}.
      </div>
    )
  }

  return (
    <div className="space-y-6 py-4" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
      <div className="flex flex-wrap items-center gap-3 font-dota">
        <Badge variant="pro">Patch {data.patch.name}</Badge>
        <span className="text-[13px] text-muted">
          {data.totalMatches} pro matches sampled
          {data.truncated ? ' (sample capped)' : ''}
        </span>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-6 border border-border p-4"
        style={{ background: 'rgba(12,11,14,0.72)' }}
      >
        <div>
          <StatBar
            label="Radiant Winrate"
            cell={{ winrate: data.aggregate.radiantWinrate, sample: data.totalMatches }}
            variant="radiant"
          />
          <StatBar
            label="Dire Winrate"
            cell={{ winrate: data.aggregate.direWinrate, sample: data.totalMatches }}
            variant="dire"
          />
        </div>
        <div>
          <StatBar
            label="First Pick Winrate"
            cell={{
              winrate: data.aggregate.firstPickWinrate,
              sample: data.aggregate.draftedMatches,
            }}
            variant="radiant"
          />
          <StatBar
            label="Second Pick Winrate"
            cell={{
              winrate: data.aggregate.secondPickWinrate,
              sample: data.aggregate.draftedMatches,
            }}
            variant="dire"
          />
        </div>
      </div>

      <ComboGrid {...data.combination} />

      <HeroTable heroes={data.heroes} />
    </div>
  )
}
