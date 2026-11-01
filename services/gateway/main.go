package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

// ── Response Types ────────────────────────────────────────────────────────

type HealthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Version   string `json:"version"`
	Timestamp string `json:"timestamp"`
	GoVersion string `json:"go_version"`
}

type AnalyzeRequest struct {
	Source   string          `json:"source"`
	Language string          `json:"language"`
	Options  json.RawMessage `json:"options,omitempty"`
}

type BatchItem struct {
	Source   string `json:"source"`
	Language string `json:"language"`
	File     string `json:"file,omitempty"`
}

type BatchRequest struct {
	Files   []BatchItem     `json:"files"`
	Options json.RawMessage `json:"options,omitempty"`
}

type BatchResult struct {
	File          string          `json:"file,omitempty"`
	Success       bool            `json:"success"`
	Metrics       MetricsResult   `json:"metrics"`
	Rules         []RuleMatch     `json:"rules"`
	Language      string          `json:"language,omitempty"`
	Duration      float64         `json:"duration_ms"`
}

type BatchResponse struct {
	Success  bool          `json:"success"`
	Results  []BatchResult `json:"results"`
	Duration float64       `json:"duration_ms"`
}

type FixInfo struct {
	Kind        string `json:"kind"`
	Description string `json:"description,omitempty"`
}

type RuleMatch struct {
	RuleID      string   `json:"rule_id"`
	RuleName    string   `json:"rule_name"`
	Severity    string   `json:"severity"`
	Category    string   `json:"category"`
	Message     string   `json:"message"`
	Suggestion  string   `json:"suggestion"`
	LineNumber  int      `json:"line_number"`
	Column      int      `json:"column"`
	EndLine     int      `json:"end_line"`
	EndColumn   int      `json:"end_column"`
	CodeSnippet string   `json:"code_snippet"`
	Fix         *FixInfo `json:"fix,omitempty"`
}

type MetricsResult struct {
	CyclomaticComplexity  float64 `json:"cyclomatic_complexity"`
	MaintainabilityIndex float64 `json:"maintainability_index"`
	LinesOfCode          int     `json:"lines_of_code"`
	MaxLineLength        int     `json:"max_line_length,omitempty"`
}

type AnalyzeResponse struct {
	Success  bool          `json:"success"`
	Metrics  MetricsResult `json:"metrics"`
	Rules    []RuleMatch   `json:"rules"`
	Language string        `json:"language,omitempty"`
	Duration float64       `json:"duration_ms"`
}

// ── Rust engine (tech-debt CLI) integration ─────────────────────────────

type engineAnalysis struct {
	Language   string             `json:"language"`
	File       string             `json:"file"`
	Metrics    map[string]float64 `json:"metrics"`
	Rules      []engineRuleMatch  `json:"rules"`
	DurationMS int64              `json:"duration_ms"`
}

type engineRuleMatch struct {
	RuleID      string   `json:"rule_id"`
	RuleName    string   `json:"rule_name"`
	Severity    string   `json:"severity"`
	Category    string   `json:"category"`
	Message     string   `json:"message"`
	Suggestion  *string  `json:"suggestion"`
	FixTemplate *string  `json:"fix_template"`
	FilePath    string   `json:"file_path"`
	LineNumber  uint32   `json:"line_number"`
	Column      uint32   `json:"column"`
	EndLine     uint32   `json:"end_line"`
	EndColumn   uint32   `json:"end_column"`
	CodeSnippet *string  `json:"code_snippet"`
	Fix         *FixInfo `json:"fix"`
}

// Map a gateway language name to the file extension the engine expects.
func engineExtensionFor(language string) (string, bool) {
	switch strings.ToLower(language) {
	case "typescript", "ts":
		return ".ts", true
	case "javascript", "js":
		return ".js", true
	case "python", "py":
		return ".py", true
	case "rust", "rs":
		return ".rs", true
	case "go", "golang":
		return ".go", true
	case "java":
		return ".java", true
	case "c":
		return ".c", true
	case "ruby", "rb":
		return ".rb", true
	case "csharp", "c#":
		return ".cs", true
	case "cpp", "c++":
		return ".cpp", true
	case "php":
		return ".php", true
	default:
		return "", false
	}
}

// Locate the engine binary: TECHDEBT_BINARY env, next to the gateway, or PATH.
func findEngineBinary() string {
	if p := os.Getenv("TECHDEBT_BINARY"); p != "" {
		return p
	}
	candidates := []string{"tech-debt.exe", "tech-debt"}
	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		candidates = append(candidates, filepath.Join(dir, "tech-debt.exe"), filepath.Join(dir, "tech-debt"))
	}
	for _, c := range candidates {
		if _, err := exec.LookPath(c); err == nil {
			return c
		}
	}
	return ""
}

// runEngine shells out to the Rust engine for a single source text and returns
// the raw engine analysis. ok=false (caller falls back) when unavailable/fails.
func runEngine(source, language string, options json.RawMessage) (*engineAnalysis, bool) {
	binary := findEngineBinary()
	if binary == "" {
		return nil, false
	}

	ext, ok := engineExtensionFor(language)
	if !ok {
		return nil, false
	}

	f, err := os.CreateTemp("", "techdebt-*"+ext)
	if err != nil {
		return nil, false
	}
	path := f.Name()
	defer os.Remove(path)
	if _, err := f.WriteString(source); err != nil {
		f.Close()
		return nil, false
	}
	f.Close()

	args := []string{"analyze", path, "--format", "json"}
	var optsFile *os.File
	if len(options) > 0 && string(options) != "null" {
		optsFile, err = os.CreateTemp("", "techdebt-options-*.json")
		if err != nil {
			return nil, false
		}
		defer os.Remove(optsFile.Name())
		if _, err := optsFile.Write(options); err != nil {
			optsFile.Close()
			return nil, false
		}
		optsFile.Close()
		args = append(args, "--options", optsFile.Name())
	}

	cmd := exec.Command(binary, args...)
	out, err := cmd.Output()
	if err != nil {
		log.Printf("tech-debt engine failed for %s: %v", language, err)
		return nil, false
	}

	var res engineAnalysis
	if err := json.Unmarshal(out, &res); err != nil {
		log.Printf("tech-debt engine returned invalid json: %v", err)
		return nil, false
	}
	return &res, true
}

// analyzeWithEngine shells out to the Rust engine and maps its JSON output
// back onto the gateway's response contract.
func analyzeWithEngine(source, language string, options json.RawMessage) (*AnalyzeResponse, bool) {
	res, ok := runEngine(source, language, options)
	if !ok {
		return nil, false
	}

	metric := func(key string) float64 {
		if v, ok := res.Metrics[key]; ok {
			return v
		}
		return 0
	}

	rules := make([]RuleMatch, 0, len(res.Rules))
	for _, m := range res.Rules {
		rule := RuleMatch{
			RuleID:     m.RuleID,
			RuleName:   m.RuleName,
			Severity:   m.Severity,
			Category:   m.Category,
			Message:    m.Message,
			LineNumber: int(m.LineNumber),
			Column:     int(m.Column),
			EndLine:    int(m.EndLine),
			EndColumn:  int(m.EndColumn),
			Fix:        m.Fix,
		}
		if m.Suggestion != nil {
			rule.Suggestion = *m.Suggestion
		}
		if m.CodeSnippet != nil {
			rule.CodeSnippet = *m.CodeSnippet
		}
		rules = append(rules, rule)
	}

	metrics := MetricsResult{
		CyclomaticComplexity:  metric("cyclomatic_complexity"),
		MaintainabilityIndex: metric("maintainability_index"),
		LinesOfCode:          int(metric("lines_of_code")),
		MaxLineLength:        int(metric("max_line_length")),
	}

	return &AnalyzeResponse{
		Success:  true,
		Metrics:  metrics,
		Rules:    rules,
		Language: res.Language,
		Duration: float64(res.DurationMS),
	}, true
}

// ── Handler: Health ───────────────────────────────────────────────────────

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(HealthResponse{
		Status:    "healthy",
		Service:   "techdebt-ai-gateway",
		Version:   "0.1.0",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		GoVersion: runtime.Version(),
	})
}

// ── Handler: Ready ────────────────────────────────────────────────────────

func readyHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ready",
	})
}

// ── Helper: count keyword occurrences (case-insensitive) ──────────────────

func countKeywordOccurrences(source, keyword string) int {
	lower := strings.ToLower(source)
	kwLower := strings.ToLower(keyword)
	count := 0
	start := 0
	for {
		i := strings.Index(lower[start:], kwLower)
		if i == -1 {
			break
		}
		count++
		start += i + 1
	}
	return count
}

// ── Handler: Analyze ─────────────────────────────────────────────────────

func analyzeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	start := time.Now()

	// Prefer the real Rust engine (tree-sitter, line-accurate) when available.
	if engineResp, ok := analyzeWithEngine(req.Source, req.Language, req.Options); ok {
		engineResp.Duration = float64(time.Since(start).Milliseconds())
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(engineResp)
		return
	}

	// ── Heuristic fallback (engine binary missing/failed) ──
	log.Printf("gateway /analyze: heuristic fallback for %q (engine unavailable)", req.Language)

	// Compute very rough metrics
	loc := len(req.Source)
	if loc > 0 {
		// count actual newlines
		newlineCount := strings.Count(req.Source, "\n")
		loc = newlineCount + 1
		if loc < 1 {
			loc = 1
		}
	}

	complexity := float64(countKeywordOccurrences(req.Source, "if") +
		countKeywordOccurrences(req.Source, "for") +
		countKeywordOccurrences(req.Source, "while") +
		countKeywordOccurrences(req.Source, "switch") +
		countKeywordOccurrences(req.Source, "case") +
		countKeywordOccurrences(req.Source, "func"))

	// Very rough maintainability index placeholder
	mi := 171.9 - 5.2*complexity - 0.23*float64(loc) // simplified formula placeholder
	if mi < 0 {
		mi = 0
	}

	// Collect rule matches
	var rules []RuleMatch

	// high_complexity: complexity > 10
	if complexity > 10 {
		rules = append(rules, RuleMatch{
			RuleID:      "high_complexity",
			RuleName:    "High Cyclomatic Complexity",
			Severity:    "high",
			Category:    "complexity",
			Message:     "Cyclomatic complexity is high (threshold: 10)",
			Suggestion:  "Consider breaking down functions into smaller pieces.",
			LineNumber:  1,
		})
	}

	// deep_nesting: complexity > 3 (rough heuristic)
	if complexity > 3 {
		rules = append(rules, RuleMatch{
			RuleID:      "deep_nesting",
			RuleName:    "Deep Nesting of Conditionals",
			Severity:    "medium",
			Category:    "complexity",
			Message:     "Code has nested conditional structures",
			Suggestion:  "Use guard clauses or extract logic into separate functions.",
			LineNumber:  1,
		})
	}

	// low_maintainability: MI < 20 (placeholder)
	if mi < 20 {
		rules = append(rules, RuleMatch{
			RuleID:      "low_maintainability",
			RuleName:    "Low Maintainability Index",
			Severity:    "medium",
			Category:    "maintainability",
			Message:     "Maintainability index is low (placeholder metric)",
			Suggestion:  "Refactor for clarity and add documentation.",
			LineNumber:  1,
		})
	}

	// hardcoded_secrets: naive check for "password" or "secret" assignment
	hasSecretHints := strings.Contains(strings.ToLower(req.Source), "password") ||
		strings.Contains(strings.ToLower(req.Source), "secret") ||
		strings.Contains(strings.ToLower(req.Source), "api_key") ||
		strings.Contains(strings.ToLower(req.Source), "token")
	if hasSecretHints {
		rules = append(rules, RuleMatch{
			RuleID:      "hardcoded_secrets",
			RuleName:    "Hardcoded Secrets / API Keys",
			Severity:    "critical",
			Category:    "security",
			Message:     "Potential hardcoded credentials detected in source",
			Suggestion:  "Use environment variables or a secrets manager. Never commit credentials to version control.",
			LineNumber:  1,
		})
	}

	// sql_injection: naive check for "execute" + string concat patterns
	lowerSrc := strings.ToLower(req.Source)
	hasSqlPattern := strings.Contains(lowerSrc, "execute") &&
		(strings.Contains(lowerSrc, "+") || strings.Contains(lowerSrc, "concat"))
	if hasSqlPattern {
		rules = append(rules, RuleMatch{
			RuleID:      "sql_injection",
			RuleName:    "Potential SQL Injection",
			Severity:    "critical",
			Category:    "security",
			Message:     "Potential SQL injection pattern detected (string concatenation with execute/query)",
			Suggestion:  "Use parameterized queries or prepared statements instead of string concatenation.",
			LineNumber:  1,
		})
	}

	duration := float64(time.Since(start).Milliseconds())

	resp := AnalyzeResponse{
		Success:   true,
		Metrics:   MetricsResult{CyclomaticComplexity: complexity, MaintainabilityIndex: mi, LinesOfCode: loc},
		Rules:     rules,
		Duration:  duration,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// ── Handler: Batch analyze ────────────────────────────────────────────────

func analyzeBatchHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req BatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}
	if len(req.Files) == 0 {
		http.Error(w, `{"error":"no files"}`, http.StatusBadRequest)
		return
	}

	start := time.Now()
	results := make([]BatchResult, len(req.Files))
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup

	for i, item := range req.Files {
		wg.Add(1)
		go func(idx int, it BatchItem) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			results[idx] = analyzeSingle(it, req.Options)
		}(i, item)
	}
	wg.Wait()

	json.NewEncoder(w).Encode(BatchResponse{
		Success:  true,
		Results:  results,
		Duration: float64(time.Since(start).Milliseconds()),
	})
}

// analyzeSingle runs one source through the engine (or heuristic fallback)
// and shapes the result into the batch contract.
func analyzeSingle(item BatchItem, options json.RawMessage) BatchResult {
	if resp, ok := analyzeWithEngine(item.Source, item.Language, options); ok {
		return BatchResult{
			File:     item.File,
			Success:  true,
			Metrics:  resp.Metrics,
			Rules:    resp.Rules,
			Language: resp.Language,
			Duration: resp.Duration,
		}
	}

	// Minimal deterministic fallback so every entry in the batch resolves.
	rules := []RuleMatch{}
	if strings.Contains(strings.ToLower(item.Source), "password") ||
		strings.Contains(strings.ToLower(item.Source), "api_key") {
		rules = append(rules, RuleMatch{
			RuleID:     "hardcoded_secrets",
			RuleName:   "Hardcoded Secrets / API Keys",
			Severity:   "critical",
			Category:   "security",
			Message:    "Potential hardcoded credentials detected in source",
			Suggestion: "Use environment variables or a secrets manager.",
			LineNumber: 1,
		})
	}
	loc := strings.Count(item.Source, "\n") + 1
	return BatchResult{
		File:     item.File,
		Success:  true,
		Metrics:  MetricsResult{CyclomaticComplexity: 0, MaintainabilityIndex: 80, LinesOfCode: loc},
		Rules:    rules,
		Language: item.Language,
	}
}

// ── Handler: Rules catalog ────────────────────────────────────────────────

func rulesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	binary := findEngineBinary()
	if binary == "" {
		http.Error(w, `{"error":"engine binary not found"}`, http.StatusServiceUnavailable)
		return
	}
	cmd := exec.Command(binary, "rules", "list", "--format", "json")
	out, err := cmd.Output()
	if err != nil {
		log.Printf("tech-debt engine rules failed: %v", err)
		http.Error(w, `{"error":"engine rules failed"}`, http.StatusInternalServerError)
		return
	}
	w.Write(out)
}

// ── CORS: dev-permissive so the web app can call the gateway directly ──────

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ── main ──────────────────────────────────────────────────────────────────

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := mux.NewRouter()
	r.HandleFunc("/health", healthHandler).Methods("GET")
	r.HandleFunc("/ready", readyHandler).Methods("GET")
	r.HandleFunc("/analyze", analyzeHandler).Methods("POST")
	r.HandleFunc("/analyze-batch", analyzeBatchHandler).Methods("POST")
	r.HandleFunc("/rules", rulesHandler).Methods("GET")

	log.Printf("TechDebt AI Gateway starting on :%s (go %s)", port, runtime.Version())
	log.Fatal(http.ListenAndServe(":"+port, withCORS(r)))
}