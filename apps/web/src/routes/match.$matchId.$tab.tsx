import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { DraftPanel } from '@/components/match/draft_panel'
import { MatchActions } from '@/components/match/match_actions'
import { MatchBuildings } from '@/components/match/match_buildings'
import { MatchCasts } from '@/components/match/match_casts'
import { MatchChat } from '@/components/match/match_chat'
import { MatchCombat } from '@/components/match/match_combat'
import { MatchCosmetics } from '@/components/match/match_cosmetics'
import { MatchDamage } from '@/components/match/match_damage'
import { MatchFantasy } from '@/components/match/match_fantasy'
import { MatchFarm } from '@/components/match/match_farm'
import { MatchGraphs } from '@/components/match/match_graphs'
import { MatchLaning } from '@/components/match/match_laning'
import { MatchLog } from '@/components/match/match_log'
import { MatchObjectives } from '@/components/match/match_objectives'
import { MatchOverview } from '@/components/match/match_overview'
import { MatchPerformance } from '@/components/match/match_performance'
import { MatchPurchases } from '@/components/match/match_purchases'
import { MatchScoreboard } from '@/components/match/match_scoreboard'
import { MatchStory } from '@/components/match/match_story'
import { MatchVision } from '@/components/match/match_vision'
import { ReplayViewer } from '@/components/match/replay_viewer'
import { Spinner } from '@/components/ui/spinner'
import { fetchMatch, isFullyParsed } from '@/lib/api_match'
import { opendota } from '@/lib/opendota'
import { usePageTitle } from '@/lib/title'

type Tab =
  | 'overview'
  | 'scoreboard'
  | 'graphs'
  | 'combat'
  | 'damage'
  | 'performance'
  | 'laning'
  | 'casts'
  | 'farm'
  | 'purchases'
  | 'objectives'
  | 'buildings'
  | 'log'
  | 'actions'
  | 'fantasy'
  | 'story'
  | 'cosmetics'
  | 'draft'
  | 'vision'
  | 'chat'
  | 'replay'

export const Route = createFileRoute('/match/$matchId/$tab')({
  component: MatchPage,
  validateSearch: (search: Record<string, unknown>): { t?: number } => ({
    t: typeof search.t === 'number' ? search.t : Number(search.t) || undefined,
  }),
})

function MatchPage() {
  const { matchId, tab } = Route.useParams()
  const { t: jumpToTime } = Route.useSearch()
  usePageTitle(`Match ${matchId}`)

  const match = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => fetchMatch(matchId),
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || isFullyParsed(data)) return false
      return 15_000 // still parsing — poll every 15s while our own parse job runs
    },
  })

  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
  })

  const itemsData = useQuery({
    queryKey: ['items_constants'],
    queryFn: () => opendota.items(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const abilitiesData = useQuery({
    queryKey: ['abilities_constants'],
    queryFn: () => opendota.abilities(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const abilityIdsData = useQuery({
    queryKey: ['ability_ids_constants'],
    queryFn: () => opendota.abilityIds(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const chatWheelData = useQuery({
    queryKey: ['chat_wheel_constants'],
    queryFn: () => opendota.chatWheel(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  if (match.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!match.data) return <div className="text-sm text-muted">Match not found.</div>

  const m = match.data
  const itemConst = itemsData.data ?? {}
  const idToName = new Map<number, string>(
    Object.entries(itemConst).map(([name, { id }]) => [id, name]),
  )

  // Parsed-only tabs appear only when the data behind them exists.
  const hasCombat =
    (m.teamfights?.length ?? 0) > 0 ||
    m.players.some((p) => (p.kills_log?.length ?? 0) > 0 || Object.keys(p.killed ?? {}).length > 0)
  const hasDamage = m.players.some((p) => p.damage != null || p.damage_inflictor != null)
  const hasPerformance = m.players.some((p) => p.lane_role != null || p.benchmarks != null)
  const hasFarm = m.players.some((p) => Object.keys(p.gold_reasons ?? {}).length > 0)
  const hasPurchases = m.players.some((p) => (p.purchase_log?.length ?? 0) > 0)
  const hasObjectives = (m.objectives?.length ?? 0) > 0
  const hasDraft = (m.picks_bans?.length ?? 0) > 0
  const hasLaning = m.players.some((p) => p.lane_pos && Object.keys(p.lane_pos).length > 0)
  const hasCasts = m.players.some((p) => p.ability_uses && Object.keys(p.ability_uses).length > 0)
  const hasActions = m.players.some((p) => p.actions && Object.keys(p.actions).length > 0)
  const hasFantasy = m.players.some((p) => p.teamfight_participation != null)
  const hasStory = m.players.some((p) => (p.kills_log?.length ?? 0) > 0)
  const hasCosmetics = m.players.some((p) => (p.cosmetics?.length ?? 0) > 0)
  const hasLog = m.players.some(
    (p) => (p.kills_log?.length ?? 0) > 0 || (p.obs_log?.length ?? 0) > 0,
  )
  const hasBuildings =
    (m.objectives ?? []).some((o) => o.type === 'building_kill') ||
    m.players.some((p) => p.damage != null)
  const hasVision = m.players.some((p) => (p.obs_log?.length ?? 0) + (p.sen_log?.length ?? 0) > 0)
  const hasChat = (m.chat?.length ?? 0) > 0

  const availableTabs: Tab[] = [
    'overview',
    'scoreboard',
    'graphs',
    ...(hasCombat ? (['combat'] as Tab[]) : []),
    ...(hasDamage ? (['damage'] as Tab[]) : []),
    ...(hasPerformance ? (['performance'] as Tab[]) : []),
    ...(hasLaning ? (['laning'] as Tab[]) : []),
    ...(hasCasts ? (['casts'] as Tab[]) : []),
    ...(hasFarm ? (['farm'] as Tab[]) : []),
    ...(hasPurchases ? (['purchases'] as Tab[]) : []),
    ...(hasObjectives ? (['objectives'] as Tab[]) : []),
    ...(hasBuildings ? (['buildings'] as Tab[]) : []),
    ...(hasLog ? (['log'] as Tab[]) : []),
    ...(hasActions ? (['actions'] as Tab[]) : []),
    ...(hasFantasy ? (['fantasy'] as Tab[]) : []),
    ...(hasStory ? (['story'] as Tab[]) : []),
    ...(hasCosmetics ? (['cosmetics'] as Tab[]) : []),
    ...(hasDraft ? (['draft'] as Tab[]) : []),
    ...(hasVision ? (['vision'] as Tab[]) : []),
    ...(hasChat ? (['chat'] as Tab[]) : []),
    'replay',
  ]

  const activeTab = availableTabs.includes(tab as Tab) ? (tab as Tab) : 'overview'
  const loading = (
    <div className="flex justify-center py-12">
      <Spinner />
    </div>
  )

  /* Two-level navigation: standalone entries plus groups of related tabs,
     so the strip stays readable now that there are ~20 possible tabs.
     Every tab keeps its own URL; groups only affect how links render. */
  type NavEntry = { label: string; tabs: Tab[] }
  const NAV: NavEntry[] = [
    { label: 'overview', tabs: ['overview'] },
    { label: 'scoreboard', tabs: ['scoreboard'] },
    { label: 'graphs', tabs: ['graphs'] },
    { label: 'combat', tabs: ['combat', 'damage', 'log'] },
    { label: 'economy', tabs: ['farm', 'purchases'] },
    { label: 'performance', tabs: ['performance', 'laning', 'casts', 'actions', 'fantasy'] },
    { label: 'maps', tabs: ['vision', 'buildings', 'objectives'] },
    { label: 'draft', tabs: ['draft'] },
    { label: 'more', tabs: ['story', 'chat', 'cosmetics'] },
    { label: 'replay', tabs: ['replay'] },
  ]
  const navEntries = NAV.map((g) => ({
    ...g,
    tabs: g.tabs.filter((t) => availableTabs.includes(t)),
  })).filter((g) => g.tabs.length > 0)
  const activeGroup = navEntries.find((g) => g.tabs.includes(activeTab))
  const TAB_LABELS: Partial<Record<Tab, string>> = {
    combat: 'kills',
    performance: 'benchmarks',
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Tab strip: grouped primary row, contextual secondary row */}
      <div
        className="flex items-center flex-wrap mt-3 px-3 py-2.5 font-dota"
        style={{ background: 'rgba(8,10,12,0.55)' }}
      >
        {navEntries.map((g, i) => {
          const active = g === activeGroup
          return (
            <span key={g.label} className="flex items-center">
              {i > 0 && (
                // #3f464d is not in the Token Mapping Reference — left as-is per
                // task instructions.
                <span className="mx-2.5 text-[13px]" style={{ color: '#3f464d' }}>
                  /
                </span>
              )}
              <Link
                to="/match/$matchId/$tab"
                params={{ matchId, tab: g.tabs[0] }}
                className="text-[14px] font-semibold uppercase cursor-pointer whitespace-nowrap"
                style={{
                  // #7d8b95 is not in the Token Mapping Reference — left as-is per
                  // task instructions.
                  color: active ? 'var(--color-white)' : '#7d8b95',
                  letterSpacing: '2px',
                  borderBottom: active ? '1px solid var(--color-white)' : '1px solid transparent',
                  paddingBottom: 2,
                  textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                }}
              >
                {g.label}
              </Link>
            </span>
          )
        })}
      </div>
      {activeGroup && activeGroup.tabs.length > 1 && (
        <div
          className="flex items-center flex-wrap mb-3 px-3 py-2 font-dota"
          style={{
            background: 'rgba(8,10,12,0.35)',
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {activeGroup.tabs.map((t, i) => (
            <span key={t} className="flex items-center">
              {i > 0 && (
                // #3f464d is not in the Token Mapping Reference — left as-is per
                // task instructions.
                <span className="mx-2 text-[13px]" style={{ color: '#3f464d' }}>
                  ·
                </span>
              )}
              <Link
                to="/match/$matchId/$tab"
                params={{ matchId, tab: t }}
                className="text-[13px] uppercase cursor-pointer whitespace-nowrap"
                style={{
                  // #7d8b95 is not in the Token Mapping Reference — left as-is per
                  // task instructions.
                  color: activeTab === t ? 'var(--color-gold)' : '#7d8b95',
                  letterSpacing: '2px',
                  borderBottom:
                    activeTab === t ? '1px solid var(--color-gold)' : '1px solid transparent',
                  paddingBottom: 1,
                }}
              >
                {TAB_LABELS[t] ?? t}
              </Link>
            </span>
          ))}
        </div>
      )}
      {(!activeGroup || activeGroup.tabs.length <= 1) && <div className="mb-3" />}

      {activeTab === 'overview' &&
        (heroStats.data ? (
          <MatchOverview
            match={m}
            heroStats={heroStats.data}
            idToName={idToName}
            itemConst={itemConst}
          />
        ) : (
          loading
        ))}

      {activeTab === 'scoreboard' &&
        (heroStats.data ? (
          <MatchScoreboard
            match={m}
            heroStats={heroStats.data}
            idToName={idToName}
            itemConst={itemConst}
            abilities={abilitiesData.data ?? {}}
            abilityIds={abilityIdsData.data ?? {}}
          />
        ) : (
          loading
        ))}

      {activeTab === 'graphs' &&
        (heroStats.data ? (
          <MatchGraphs
            match={m}
            heroStats={heroStats.data}
            idToName={idToName}
            itemConst={itemConst}
          />
        ) : (
          loading
        ))}

      {activeTab === 'combat' &&
        (heroStats.data ? <MatchCombat match={m} heroStats={heroStats.data} /> : loading)}

      {activeTab === 'damage' &&
        (heroStats.data ? (
          <MatchDamage
            match={m}
            heroStats={heroStats.data}
            abilities={abilitiesData.data ?? {}}
            itemConst={itemConst}
          />
        ) : (
          loading
        ))}

      {activeTab === 'performance' &&
        (heroStats.data ? <MatchPerformance match={m} heroStats={heroStats.data} /> : loading)}

      {activeTab === 'farm' &&
        (heroStats.data ? <MatchFarm match={m} heroStats={heroStats.data} /> : loading)}

      {activeTab === 'purchases' &&
        (heroStats.data ? (
          <MatchPurchases players={m.players} heroStats={heroStats.data} itemConst={itemConst} />
        ) : (
          loading
        ))}

      {activeTab === 'buildings' &&
        (heroStats.data ? <MatchBuildings match={m} heroStats={heroStats.data} /> : loading)}

      {activeTab === 'laning' &&
        (heroStats.data ? <MatchLaning match={m} heroStats={heroStats.data} /> : loading)}

      {activeTab === 'casts' &&
        (heroStats.data ? (
          <MatchCasts
            match={m}
            heroStats={heroStats.data}
            abilityConst={abilitiesData.data ?? {}}
            itemConst={itemConst}
          />
        ) : (
          loading
        ))}

      {activeTab === 'log' &&
        (heroStats.data ? <MatchLog match={m} heroStats={heroStats.data} /> : loading)}

      {activeTab === 'actions' &&
        (heroStats.data ? <MatchActions match={m} heroStats={heroStats.data} /> : loading)}

      {activeTab === 'fantasy' &&
        (heroStats.data ? <MatchFantasy match={m} heroStats={heroStats.data} /> : loading)}

      {activeTab === 'story' &&
        (heroStats.data ? <MatchStory match={m} heroStats={heroStats.data} /> : loading)}

      {activeTab === 'cosmetics' &&
        (heroStats.data ? <MatchCosmetics match={m} heroStats={heroStats.data} /> : loading)}

      {activeTab === 'objectives' &&
        (heroStats.data ? <MatchObjectives match={m} heroStats={heroStats.data} /> : loading)}

      {activeTab === 'draft' &&
        (hasDraft && heroStats.data ? (
          <DraftPanel picksBans={m.picks_bans ?? []} heroStats={heroStats.data} />
        ) : (
          loading
        ))}

      {activeTab === 'vision' &&
        (heroStats.data ? (
          <MatchVision players={m.players} heroStats={heroStats.data} duration={m.duration} />
        ) : (
          loading
        ))}

      {activeTab === 'chat' &&
        (hasChat && heroStats.data ? (
          <MatchChat
            chat={m.chat ?? []}
            players={m.players}
            heroStats={heroStats.data}
            chatWheel={chatWheelData.data ?? {}}
          />
        ) : (
          loading
        ))}

      {activeTab === 'replay' &&
        (heroStats.data ? (
          <ReplayViewer
            match={m}
            heroStats={heroStats.data}
            idToName={idToName}
            itemConst={itemConst}
            abilityConst={abilitiesData.data ?? {}}
            initialTime={jumpToTime}
          />
        ) : (
          loading
        ))}
    </div>
  )
}
