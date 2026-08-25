import { describe, expect, it } from 'bun:test'
import type { Match } from 'types'
import { mergeParsedMatch, type ParsedMatch } from './match_merge'

function basicMatch(): Match {
  return {
    match_id: 1,
    barracks_status_dire: 0,
    barracks_status_radiant: 0,
    cluster: 0,
    dire_score: 0,
    dire_team_id: null,
    duration: 1800,
    engine: 0,
    first_blood_time: 0,
    game_mode: 0,
    human_players: 10,
    leagueid: 0,
    lobby_type: 0,
    match_seq_num: 0,
    negative_votes: 0,
    objectives: null,
    picks_bans: null,
    positive_votes: 0,
    radiant_gold_adv: null,
    radiant_score: 0,
    radiant_team_id: null,
    radiant_win: true,
    radiant_xp_adv: null,
    skill: null,
    start_time: 0,
    teamfights: null,
    tower_status_dire: 0,
    tower_status_radiant: 0,
    version: null,
    patch: null,
    series_id: null,
    series_type: null,
    chat: null,
    players: [
      { match_id: 1, player_slot: 0, account_id: null } as Match['players'][number],
      { match_id: 1, player_slot: 128, account_id: null } as Match['players'][number],
    ],
  } as Match
}

describe('mergeParsedMatch', () => {
  it('returns basic unchanged when parsed is null', () => {
    const basic = basicMatch()
    expect(mergeParsedMatch(basic, null)).toEqual(basic)
  })

  it('merges per-player parsed fields by player_slot', () => {
    const basic = basicMatch()
    const parsed: ParsedMatch = {
      match_id: 1,
      duration: 1800,
      players: {
        '0': { purchase_log: [{ key: 'item_tango', time: 5 }] },
        '128': { purchase_log: [{ key: 'item_boots', time: 10 }] },
      },
      kills: [{ t: 100, attacker: 'npc_dota_hero_axe', victim: 'npc_dota_hero_lina' }],
      teamfights: [],
      objectives: [],
      chat: [],
      radiant_gold_adv: [50],
      radiant_xp_adv: [20],
      creeps: [{ kind: 'lane', team: 2, positions: [{ t: 1, x: 100, y: 100, hp: 300 }] }],
    }
    const merged = mergeParsedMatch(basic, parsed)
    expect(merged.players[0].purchase_log).toEqual([{ key: 'item_tango', time: 5 }])
    expect(merged.players[1].purchase_log).toEqual([{ key: 'item_boots', time: 10 }])
    expect(merged.kills).toEqual(parsed.kills)
    expect(merged.radiant_gold_adv).toEqual([50])
    expect(merged.radiant_xp_adv).toEqual([20])
    expect(merged.creeps).toEqual(parsed.creeps)
  })

  it('fills account_id/personaname from the replay only when OpenDota has none', () => {
    const basic = basicMatch()
    basic.players[1] = {
      ...basic.players[1],
      account_id: 12345,
      personaname: 'PublicPlayer',
    } as Match['players'][number]
    const parsed: ParsedMatch = {
      match_id: 1,
      duration: 1800,
      players: {
        // slot 0: OpenDota has nothing, replay resolved an identity.
        '0': { account_id: 999, personaname: 'FromReplay' },
        // slot 128: OpenDota already has a public identity; the replay's
        // account_id must not override it even though it's also present.
        '128': { account_id: 111, personaname: 'ShouldNotAppear' },
      },
      kills: [],
    }
    const merged = mergeParsedMatch(basic, parsed)
    expect(merged.players[0].account_id).toBe(999)
    expect(merged.players[0].personaname).toBe('FromReplay')
    expect(merged.players[1].account_id).toBe(12345)
    expect(merged.players[1].personaname).toBe('PublicPlayer')
  })

  // The Go parser emits every PlayerParsed field unconditionally, so a field
  // it could not populate arrives as an explicit null rather than being
  // absent. Spreading that over OpenDota's own parse deletes real data: a
  // parse that resolved no hero names still returns 10 players' worth of
  // nulls for every combat-log field, which is exactly how a silently
  // degraded parse used to blank the scoreboard's Support Items column.
  it('does not let a null parsed field overwrite populated OpenDota data', () => {
    const basic = basicMatch()
    basic.players[0].purchase_log = [{ key: 'item_tango', time: 5 }]
    basic.players[0].damage = { npc_dota_hero_axe: 100 }
    basic.players[0].hero_healing = 250
    const parsed: ParsedMatch = {
      match_id: 1,
      duration: 1800,
      players: {
        '0': {
          purchase_log: null,
          damage: null,
          positions: [{ t: 1 } as NonNullable<ParsedMatch['players'][string]['positions']>[number]],
        },
      },
    }
    const merged = mergeParsedMatch(basic, parsed)
    expect(merged.players[0].purchase_log).toEqual([{ key: 'item_tango', time: 5 }])
    expect(merged.players[0].damage).toEqual({ npc_dota_hero_axe: 100 })
    expect(merged.players[0].hero_healing).toBe(250)
    expect(merged.players[0].positions).toEqual([{ t: 1 } as never])
  })

  // A zero or an empty array is a real parsed answer, not a missing one, so
  // it must still win over whatever OpenDota reported.
  it('lets a zero or empty parsed value overwrite OpenDota data', () => {
    const basic = basicMatch()
    basic.players[0].purchase_log = [{ key: 'item_tango', time: 5 }]
    basic.players[0].observer_kills = 4
    const parsed: ParsedMatch = {
      match_id: 1,
      duration: 1800,
      players: { '0': { purchase_log: [], observer_kills: 0 } },
    }
    const merged = mergeParsedMatch(basic, parsed)
    expect(merged.players[0].purchase_log).toEqual([])
    expect(merged.players[0].observer_kills).toBe(0)
  })

  it('leaves a player unmerged if its slot has no counterpart in parsed data', () => {
    const basic = basicMatch()
    const parsed: ParsedMatch = {
      match_id: 1,
      duration: 1800,
      players: { '0': { purchase_log: [] } }, // no entry for slot 128
      kills: [],
    }
    const merged = mergeParsedMatch(basic, parsed)
    expect(merged.players[1]).toEqual(basic.players[1]) // slot 128 untouched, not thrown
  })
})
