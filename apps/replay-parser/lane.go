package main

// laningPhaseEndSeconds marks the end of the laning window (10:00),
// matching OpenDota's own laning-phase window.
const laningPhaseEndSeconds = 600

// recordLanePosSample buckets a hero position sample into LanePos, restricted
// to the laning phase (see laningPhaseEndSeconds). Bucketing by integer
// world-grid cell (same scale as PositionPoint.X/Y) keeps LanePos a compact
// heatmap rather than one entry per sample.
func recordLanePosSample(p *PlayerParsed, x, y, matchTime float64) {
	if matchTime > laningPhaseEndSeconds {
		return
	}
	if p.LanePos == nil {
		p.LanePos = map[string]map[string]int32{}
	}
	xKey := fmtSlot(int(x))
	if p.LanePos[xKey] == nil {
		p.LanePos[xKey] = map[string]int32{}
	}
	p.LanePos[xKey][fmtSlot(int(y))]++
}

// laneEfficiencyPct estimates last-hit efficiency during the laning phase:
// actual last hits at laningPhaseEndSeconds against a fixed theoretical max
// (creep waves spawn a bounded number of last-hittable creeps in the first
// 10 minutes; 100 is the commonly-cited practical ceiling used by existing
// lane-efficiency tools for a solo lane).
func laneEfficiencyPct(lastHitsAtLaningEnd int32, laningEndMinute int) float64 {
	const theoreticalMaxLastHits = 100.0
	if laningEndMinute <= 0 {
		return 0
	}
	pct := float64(lastHitsAtLaningEnd) / theoreticalMaxLastHits * 100
	if pct > 100 {
		pct = 100
	}
	return pct
}
