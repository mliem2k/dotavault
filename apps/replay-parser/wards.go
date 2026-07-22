package main

import "math"

func recordWardPlaced(players map[string]*PlayerParsed, ownerSlot int, isSentry bool, x, y, t float64) {
	p := players[fmtSlot(ownerSlot)]
	if p == nil {
		return
	}
	ev := WardEvent{T: t, X: x, Y: y}
	if isSentry {
		p.SenLog = append(p.SenLog, ev)
	} else {
		p.ObsLog = append(p.ObsLog, ev)
	}
}

func recordWardRemoved(players map[string]*PlayerParsed, ownerSlot int, isSentry bool, x, y, t float64) {
	p := players[fmtSlot(ownerSlot)]
	if p == nil {
		return
	}
	ev := WardEvent{T: t, X: x, Y: y, EntityLeft: true}
	if isSentry {
		p.SenLeftLog = append(p.SenLeftLog, ev)
	} else {
		p.ObsLeftLog = append(p.ObsLeftLog, ev)
	}
}

// wardOwnerSlot resolves the placing player by proximity: a ward can only be
// placed within a hero's cast range, so whichever hero was closest to the
// ward at the tick it was created is almost certainly the one who placed
// it. Wards become independent world entities once placed, so there's no
// live "owner" field to read the way there is for, say, illusions — this
// spatial heuristic avoids depending on one. If FIELD_NOTES.md's dump of a
// real ward entity's full field map (extend inspect.go to call e.Map() on
// one) turns up a direct owner/player-id field instead, prefer that and
// treat this as the fallback.
func wardOwnerSlot(wardX, wardY float64, heroPositions map[int][2]float64) (int, bool) {
	const maxOwnerDistanceSq = 200.0 * 200.0 // world-grid units squared; ward cast range is well under this
	bestSlot, bestDistSq := -1, math.MaxFloat64
	for slot, pos := range heroPositions {
		dx, dy := pos[0]-wardX, pos[1]-wardY
		distSq := dx*dx + dy*dy
		if distSq < bestDistSq {
			bestDistSq, bestSlot = distSq, slot
		}
	}
	if bestSlot == -1 || bestDistSq > maxOwnerDistanceSq {
		return 0, false
	}
	return bestSlot, true
}
