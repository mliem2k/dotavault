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
    }
    const merged = mergeParsedMatch(basic, parsed)
    expect(merged.players[0].purchase_log).toEqual([{ key: 'item_tango', time: 5 }])
    expect(merged.players[1].purchase_log).toEqual([{ key: 'item_boots', time: 10 }])
    expect(merged.kills).toEqual(parsed.kills)
    expect(merged.radiant_gold_adv).toEqual([50])
    expect(merged.radiant_xp_adv).toEqual([20])
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
