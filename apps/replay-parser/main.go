// dotavault replay-parser: downloads a Dota 2 match replay directly from
// Valve's CDN and extracts continuous hero positions using manta
// (github.com/dotabuff/manta), Dotabuff's Go Source 2 replay parser.
//
// This only works while Valve still serves the replay (a short window after
// the match ends); OpenDota's public API never exposes continuous movement,
// only sparse per-fight death locations and ward placements, so this is a
// separate, best-effort "if it's still there" capability, not a replacement.
//
// Primary interface: `replay-parser -remote <match_id> <cluster> <salt>`,
// which prints the parse result as JSON to stdout (errors as JSON to stdout
// with a nonzero exit code). The Bun/Elysia API in apps/api invokes this as
// a subprocess and caches the result in Postgres, so each replay is parsed
// at most once. A standalone HTTP mode (no args) is kept for local testing.
package main

import (
	"compress/bzip2"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type parseResponse struct {
	MatchID   int64                      `json:"match_id"`
	Duration  float64                    `json:"duration"`
	Positions map[string][]PositionPoint `json:"positions"`
	Kills     []KillEvent                `json:"kills"`
}

type errorResponse struct {
	Error string `json:"error"`
}

// errReplayGone means Valve's CDN no longer serves this replay (404), which
// callers treat differently from a transient failure.
var errReplayGone = errors.New("replay no longer available")

func main() {
	switch {
	case len(os.Args) == 5 && os.Args[1] == "-remote":
		runRemote(os.Args[2], os.Args[3], os.Args[4])
	case len(os.Args) == 2 && os.Args[1] == "-inspect":
		runInspect(os.Getenv("INSPECT_FILE"))
	case len(os.Args) == 2:
		// `replay-parser somefile.dem` parses a local file and prints a
		// summary (no network fetch), for testing against a replay on disk.
		runLocalFile(os.Args[1])
	case len(os.Args) == 1:
		runServer()
	default:
		fmt.Fprintln(os.Stderr, "usage: replay-parser [-remote <match_id> <cluster> <salt>] [-inspect] [file.dem]")
		os.Exit(2)
	}
}

// fetchAndParse downloads the replay from Valve's CDN and extracts positions.
func fetchAndParse(matchID, cluster, salt int64) (*parseResponse, error) {
	replayURL := fmt.Sprintf("http://replay%d.valve.net/570/%d_%d.dem.bz2", cluster, matchID, salt)
	log.Printf("match %d: fetching %s", matchID, replayURL)

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Get(replayURL)
	if err != nil {
		return nil, fmt.Errorf("failed to reach Valve's replay CDN: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, errReplayGone
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("replay CDN returned %d", resp.StatusCode)
	}

	pm, err := ExtractMatch(matchID, bzip2.NewReader(resp.Body))
	if err != nil {
		return nil, fmt.Errorf("failed to parse replay: %w", err)
	}

	out := make(map[string][]PositionPoint, len(pm.Players))
	for slot, p := range pm.Players {
		out[slot] = p.Positions
	}
	return &parseResponse{MatchID: matchID, Duration: pm.Duration, Positions: out, Kills: pm.Kills}, nil
}

/* ---------------- subprocess (CLI) mode ---------------- */

// runRemote prints the parse result as JSON to stdout. Exit codes: 0 ok,
// 4 replay gone (Valve expired it), 1 any other failure.
func runRemote(matchIDs, clusters, salts string) {
	var matchID, cluster, salt int64
	if _, err := fmt.Sscanf(matchIDs, "%d", &matchID); err != nil || matchID <= 0 {
		cliFail("invalid match_id", 2)
	}
	if _, err := fmt.Sscanf(clusters, "%d", &cluster); err != nil || cluster <= 0 {
		cliFail("invalid cluster", 2)
	}
	if _, err := fmt.Sscanf(salts, "%d", &salt); err != nil || salt <= 0 {
		cliFail("invalid salt", 2)
	}

	result, err := fetchAndParse(matchID, cluster, salt)
	if err != nil {
		if errors.Is(err, errReplayGone) {
			cliFail("replay is no longer available (Valve's CDN has expired it)", 4)
		}
		cliFail(err.Error(), 1)
	}
	if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
		cliFail(err.Error(), 1)
	}
}

func cliFail(msg string, code int) {
	_ = json.NewEncoder(os.Stdout).Encode(errorResponse{Error: msg})
	os.Exit(code)
}

/* ---------------- HTTP mode (local testing) ---------------- */

func runServer() {
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
	Cluster    int64 `json:"cluster"`
	ReplaySalt int64 `json:"replay_salt"`
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

	result, err := fetchAndParse(req.MatchID, req.Cluster, req.ReplaySalt)
	if err != nil {
		if errors.Is(err, errReplayGone) {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "replay is no longer available (Valve's CDN has expired it)"})
			return
		}
		log.Printf("match %d: %v", req.MatchID, err)
		writeJSON(w, http.StatusBadGateway, errorResponse{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

/* ---------------- local file mode ---------------- */

func runLocalFile(path string) {
	f, err := os.Open(path)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	pm, err := ExtractMatch(0, f)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("duration=%.2fs slots=%d kills=%d\n", pm.Duration, len(pm.Players), len(pm.Kills))
	for _, k := range pm.Kills[:min(3, len(pm.Kills))] {
		fmt.Printf("  kill t=%.1f %s -> %s inflictor=%q gold=%d\n", k.T, k.Attacker, k.Victim, k.Inflictor, k.GoldLost)
	}
	for slot, p := range pm.Players {
		pts := p.Positions
		if len(pts) == 0 {
			continue
		}
		mid := pts[len(pts)/2]
		fmt.Printf("  slot=%-3s samples=%-5d first_t=%.2f last_t=%.2f mid={t=%.0f lvl=%d hp=%d/%d mp=%d/%d}\n",
			slot, len(pts), pts[0].T, pts[len(pts)-1].T, mid.T, mid.Level, mid.HP, mid.MaxHP, mid.MP, mid.MaxMP)
	}
}
