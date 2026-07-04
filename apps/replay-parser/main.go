// dotavault replay-parser: downloads a Dota 2 match replay directly from
// Valve's CDN and extracts continuous hero positions using manta
// (github.com/dotabuff/manta), Dotabuff's Go Source 2 replay parser.
//
// This only works while Valve still serves the replay (a short window after
// the match ends); OpenDota's public API never exposes continuous movement,
// only sparse per-fight death locations and ward placements, so this is a
// separate, best-effort "if it's still there" capability, not a replacement.
package main

import (
	"compress/bzip2"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	// `replay-parser somefile.dem` parses a local file and prints a summary
	// (no HTTP server, no network fetch), for local testing against a replay
	// already on disk.
	if len(os.Args) > 1 {
		runLocalFile(os.Args[1])
		return
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/parse", withCORS(handleParse))

	log.Printf("replay-parser listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

type parseRequest struct {
	MatchID    int64 `json:"match_id"`
	Cluster    int   `json:"cluster"`
	ReplaySalt int64 `json:"replay_salt"`
}

type parseResponse struct {
	MatchID   int64                      `json:"match_id"`
	Duration  float64                    `json:"duration"`
	Positions map[string][]PositionPoint `json:"positions"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func handleParse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method not allowed"})
		return
	}

	var req parseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
		return
	}
	if req.MatchID == 0 || req.Cluster == 0 || req.ReplaySalt == 0 {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "match_id, cluster, and replay_salt are required"})
		return
	}

	replayURL := fmt.Sprintf("http://replay%d.valve.net/570/%d_%d.dem.bz2", req.Cluster, req.MatchID, req.ReplaySalt)
	log.Printf("match %d: fetching %s", req.MatchID, replayURL)

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Get(replayURL)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorResponse{Error: "failed to reach Valve's replay CDN"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "replay is no longer available (Valve's CDN has expired it)"})
		return
	}
	if resp.StatusCode != http.StatusOK {
		writeJSON(w, http.StatusBadGateway, errorResponse{Error: fmt.Sprintf("replay CDN returned %d", resp.StatusCode)})
		return
	}

	dem := bzip2.NewReader(resp.Body)

	positions, duration, err := ExtractPositions(dem)
	if err != nil {
		log.Printf("match %d: parse error: %v", req.MatchID, err)
		writeJSON(w, http.StatusUnprocessableEntity, errorResponse{Error: "failed to parse replay"})
		return
	}

	out := make(map[string][]PositionPoint, len(positions))
	for slot, pts := range positions {
		out[fmt.Sprintf("%d", slot)] = pts
	}

	writeJSON(w, http.StatusOK, parseResponse{
		MatchID:   req.MatchID,
		Duration:  duration,
		Positions: out,
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func runLocalFile(path string) {
	f, err := os.Open(path)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	positions, duration, err := ExtractPositions(f)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("duration=%.2fs slots=%d\n", duration, len(positions))
	for slot, pts := range positions {
		if len(pts) == 0 {
			continue
		}
		fmt.Printf("  slot=%-3d samples=%-5d first_t=%.2f last_t=%.2f\n", slot, len(pts), pts[0].T, pts[len(pts)-1].T)
	}
}
