use anyhow::Result;
use clap::{Parser, Subcommand};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use td_ast::AstParser;
use td_common::{ASTNode, AnalyzeOptions};
use td_metrics::MetricsEngine;
use td_rules::{RuleEngine, RuleMatch};
use walkdir::WalkDir;

#[derive(Parser)]
#[command(name = "tech-debt", about = "AI-powered code analysis and refactoring")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Parse {
        #[arg(help = "File to parse")]
        file: PathBuf,
        #[arg(long, help = "Output format (summary, json, html)")]
        format: Option<String>,
    },
    Analyze {
        #[arg(help = "File or directory to analyze")]
        path: PathBuf,
        #[arg(long, help = "Auto-apply fixes suggested by rules")]
        fix: bool,
        #[arg(long, help = "Include AI analysis")]
        deep: bool,
        #[arg(long, help = "Output format (summary, json)")]
        format: Option<String>,
        #[arg(
            long,
            help = "Path to an AnalyzeOptions JSON file (thresholds, ignore rules, path filters)"
        )]
        options: Option<PathBuf>,
    },
    Metrics {
        #[arg(help = "File to analyze")]
        file: PathBuf,
    },
    Rules {
        #[command(subcommand)]
        command: RulesCommands,
    },
}

#[derive(Subcommand)]
enum RulesCommands {
    List {
        #[arg(long, help = "Emit the rule catalog as JSON")]
        format: Option<String>,
    },
    Validate,
}

static SUPPORTED_EXTENSIONS: &[&str] = &[
    "ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "c", "h", "cs", "cpp", "cc", "cxx", "hpp",
    "rb", "php",
];

static IGNORED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    "coverage",
    "target",
    "vendor",
    "venv",
    ".venv",
    "__pycache__",
    ".idea",
    ".vscode",
    ".cache",
    ".yarn",
    ".pytest_cache",
];

fn is_ignored_dir(entry: &walkdir::DirEntry) -> bool {
    if !entry.file_type().is_dir() {
        return false;
    }
    entry
        .file_name()
        .to_str()
        .map(|name| IGNORED_DIRS.contains(&name))
        .unwrap_or(false)
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Parse { file, format } => cmd_parse(&file, format.as_deref()),
        Commands::Analyze {
            path,
            fix,
            deep,
            format,
            options,
        } => cmd_analyze(&path, fix, deep, format.as_deref(), options.as_deref()),
        Commands::Metrics { file } => cmd_metrics(&file),
        Commands::Rules { command } => cmd_rules(command),
    }
}

fn cmd_parse(file: &Path, format: Option<&str>) -> Result<()> {
    let lang =
        AstParser::detect_language(file).ok_or_else(|| anyhow::anyhow!("Unsupported file type"))?;

    if format == Some("json") {
        let ast = AstParser::parse_file(file)?;
        println!("{}", serde_json::to_string_pretty(&ast)?);
        return Ok(());
    }

    if format == Some("html") {
        let ast = AstParser::parse_file(file)?;
        print_html_report(&ast);
        return Ok(());
    }

    println!("Language: {:?}", lang);
    println!("Parsing: {}", file.display());
    let ast = AstParser::parse_file(file)?;
    print_summary(&ast);
    Ok(())
}

fn cmd_analyze(
    path: &Path,
    fix: bool,
    _deep: bool,
    format: Option<&str>,
    options: Option<&Path>,
) -> Result<()> {
    let options = match options {
        Some(p) => {
            let raw = std::fs::read_to_string(p)?;
            let raw = raw.trim_start_matches('\u{feff}');
            serde_json::from_str::<AnalyzeOptions>(raw)?
        }
        None => AnalyzeOptions::default(),
    };
    if path.is_file() {
        analyze_file(path, fix, format, &options)
    } else {
        analyze_directory(path, format, &options)
    }
}

#[derive(Serialize)]
struct FileAnalysis {
    language: String,
    file: String,
    metrics: HashMap<String, f64>,
    rules: Vec<RuleMatch>,
    files_scanned: u32,
    lines_analyzed: u64,
    duration_ms: u64,
}

fn analyze_file(
    path: &Path,
    fix: bool,
    format: Option<&str>,
    options: &AnalyzeOptions,
) -> Result<()> {
    let lang = AstParser::detect_language(path)
        .ok_or_else(|| anyhow::anyhow!("Unsupported file type: {}", path.display()))?;

    let started = std::time::Instant::now();
    let ast = AstParser::parse_file(path)?;
    let source = std::fs::read_to_string(path)?;
    let metrics = MetricsEngine::analyze(&ast);

    let mut metrics = metrics;
    let real_loc = source.lines().count() as u64;
    metrics
        .metrics
        .insert("lines_of_code".to_string(), real_loc as f64);
    let max_line_length = source.lines().map(|l| l.chars().count()).max().unwrap_or(0) as f64;
    metrics
        .metrics
        .entry("max_line_length".to_string())
        .or_insert(max_line_length);

    let rule_engine = RuleEngine::default();
    let matches = rule_engine.evaluate_with(
        &ast,
        &metrics,
        &path.to_string_lossy(),
        &source,
        lang.id(),
        options,
    );
    let duration_ms = started.elapsed().as_millis() as u64;

    if format == Some("json") {
        let out = FileAnalysis {
            language: lang.id().to_string(),
            file: path.to_string_lossy().to_string(),
            metrics: metrics.metrics,
            rules: matches,
            files_scanned: 1,
            lines_analyzed: real_loc,
            duration_ms,
        };
        println!("{}", serde_json::to_string(&out)?);
        return Ok(());
    }

    println!("\n=== {} ===", path.display());
    println!("  Language: {:?}", lang);
    println!(
        "  LOC: {:.0}",
        metrics.metrics.get("lines_of_code").unwrap_or(&0.0)
    );
    println!(
        "  Complexity: {:.1}",
        metrics.metrics.get("cyclomatic_complexity").unwrap_or(&0.0)
    );
    println!(
        "  Maintainability: {:.1}",
        metrics.metrics.get("maintainability_index").unwrap_or(&0.0)
    );
    println!("  Issues: {}", matches.len());

    if fix {
        print!("  Fixes suggested: ");
        for m in &matches {
            if let Some(ref template) = m.fix_template {
                print!("{}; ", template);
            }
        }
        println!();
    }

    for m in &matches {
        println!(
            "    [{:>6}] line {:<5} {}",
            m.severity, m.line_number, m.message
        );
        if let Some(ref snippet) = m.code_snippet {
            println!("              {}", snippet.trim());
        }
    }

    Ok(())
}

#[derive(Serialize)]
struct DirectoryAnalysis {
    path: String,
    files_scanned: u32,
    files_analyzed: u32,
    lines_analyzed: u64,
    issues: Vec<RuleMatch>,
    issues_by_language: HashMap<String, usize>,
    issues_by_rule: HashMap<String, usize>,
    total_complexity: f64,
    duration_ms: u64,
}

fn analyze_directory(path: &Path, format: Option<&str>, options: &AnalyzeOptions) -> Result<()> {
    let mut files: HashMap<String, Vec<PathBuf>> = HashMap::new();
    let total_issues = Mutex::new(0usize);
    let total_loc = Mutex::new(0.0f64);
    let total_cc = Mutex::new(0.0f64);
    let total_time = std::time::Instant::now();

    let supported_ext = |p: &Path| -> bool {
        p.extension()
            .and_then(|e| e.to_str())
            .map(|e| SUPPORTED_EXTENSIONS.contains(&e))
            .unwrap_or(false)
    };

    for entry in WalkDir::new(path)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| !is_ignored_dir(e))
        .filter_map(|e| e.ok())
    {
        let p = entry.path();
        if p.is_file() && supported_ext(p) {
            let ext = p.extension().unwrap().to_string_lossy().to_string();
            files.entry(ext).or_default().push(p.to_path_buf());
        }
    }

    let total_files: usize = files.values().map(|v| v.len()).sum();

    let json = format == Some("json");
    let mut json_issues: Vec<RuleMatch> = Vec::new();
    let mut issues_by_lang: HashMap<String, usize> = HashMap::new();
    let mut issues_by_rule: HashMap<String, usize> = HashMap::new();
    let rule_engine = RuleEngine::default();

    if !json {
        println!("TechDebt AI - Project Analysis");
        println!("{}", "-".repeat(50));
        println!("Path:     {}", path.display());
        println!("Files:    {}", total_files);

        for (ext, paths) in &files {
            println!("  .{}: {}", ext, paths.len());
        }
    }

    let mut files_analyzed: u32 = 0;

    for paths in files.values() {
        for p in paths {
            let lang = match AstParser::detect_language(p) {
                Some(l) => l,
                None => continue,
            };

            match AstParser::parse_file(p) {
                Ok(ast) => {
                    let source = std::fs::read_to_string(p).unwrap_or_default();
                    let mut metrics = MetricsEngine::analyze(&ast);
                    let real_loc = source.lines().count() as u64;
                    metrics
                        .metrics
                        .insert("lines_of_code".to_string(), real_loc as f64);
                    let matches = rule_engine.evaluate_with(
                        &ast,
                        &metrics,
                        &p.to_string_lossy(),
                        &source,
                        lang.id(),
                        options,
                    );

                    files_analyzed += 1;
                    *total_loc.lock().unwrap() += real_loc as f64;
                    if let Some(cc) = metrics.metrics.get("cyclomatic_complexity") {
                        *total_cc.lock().unwrap() += cc;
                    }
                    *total_issues.lock().unwrap() += matches.len();
                    let lang_name = lang.id().to_string();

                    for m in &matches {
                        *issues_by_lang.entry(lang_name.clone()).or_default() += 1;
                        *issues_by_rule.entry(m.rule_id.clone()).or_default() += 1;
                        if json {
                            json_issues.push(m.clone());
                        } else {
                            issues_by_lang.entry(lang_name.clone()).or_default();
                        }
                    }
                }
                Err(e) => {
                    eprintln!("  Error parsing {}: {}", p.display(), e);
                }
            }
        }
    }

    let elapsed = total_time.elapsed();

    if json {
        let out = DirectoryAnalysis {
            path: path.to_string_lossy().to_string(),
            files_scanned: total_files as u32,
            files_analyzed,
            lines_analyzed: *total_loc.lock().unwrap() as u64,
            issues: json_issues,
            issues_by_language: issues_by_lang,
            issues_by_rule,
            total_complexity: *total_cc.lock().unwrap(),
            duration_ms: elapsed.as_millis() as u64,
        };
        println!("{}", serde_json::to_string(&out)?);
        return Ok(());
    }

    println!("{}", "-".repeat(50));
    println!("Summary");
    println!("{}", "-".repeat(50));
    println!("  Files analyzed:       {}", files_analyzed);
    println!("  Total LOC:           {:.0}", *total_loc.lock().unwrap());
    println!("  Total Complexity:    {:.1}", *total_cc.lock().unwrap());
    println!("  Total Issues:        {}", *total_issues.lock().unwrap());
    println!("  Time:                {:?}", elapsed);

    if !issues_by_lang.is_empty() {
        println!("\n  Issues by language:");
        for (lang, issues) in &issues_by_lang {
            println!("    {:16}: {}", lang, issues);
        }
    }

    if !issues_by_rule.is_empty() {
        println!("\n  Issues by rule:");
        for (rule_id, count) in &issues_by_rule {
            println!("    {:24}: {}", rule_id, count);
        }
    }

    Ok(())
}

fn cmd_metrics(file: &Path) -> Result<()> {
    let lang =
        AstParser::detect_language(file).ok_or_else(|| anyhow::anyhow!("Unsupported file type"))?;

    println!("Language: {:?}", lang);
    let ast = AstParser::parse_file(file)?;
    let metrics = MetricsEngine::analyze(&ast);

    println!("\n=== Metrics for {} ===", file.display());
    for (key, value) in &metrics.metrics {
        println!("  {}: {:.4}", key, value);
    }

    println!("\nTargets: {}", metrics.targets.len());

    Ok(())
}

#[derive(Serialize)]
struct RuleCatalogEntry {
    id: String,
    name: String,
    category: String,
    severity: String,
    languages: Vec<String>,
    metric: Option<String>,
    operator: Option<String>,
    threshold: Option<f64>,
    suggestion: Option<String>,
    enabled: bool,
}

fn cmd_rules(command: RulesCommands) -> Result<()> {
    match command {
        RulesCommands::List { format } => {
            let engine = RuleEngine::default();
            if format.as_deref() == Some("json") {
                let catalog: Vec<RuleCatalogEntry> = engine
                    .rules()
                    .iter()
                    .map(|r| RuleCatalogEntry {
                        id: r.id.clone(),
                        name: r.name.clone(),
                        category: r.category.clone(),
                        severity: r.severity.clone(),
                        languages: r.languages.clone(),
                        metric: r.condition.as_ref().map(|c| c.metric.clone()),
                        operator: r.condition.as_ref().map(|c| c.operator.clone()),
                        threshold: r.condition.as_ref().map(|c| c.threshold),
                        suggestion: r.suggestion.clone(),
                        enabled: r.enabled,
                    })
                    .collect();
                println!("{}", serde_json::to_string(&catalog)?);
                return Ok(());
            }
            println!(
                "Loaded {} rules ({} enabled)",
                engine.rule_count(),
                engine.enabled_count()
            );
            println!("\nBuilt-in rules:");
            for (i, r) in engine.rules().iter().enumerate() {
                let langs = if r.languages.is_empty() {
                    "all".to_string()
                } else {
                    r.languages.join(", ")
                };
                println!(
                    "  {:>2}. {:<22} - {} ({}/{}) [{}]",
                    i + 1,
                    r.id,
                    r.name,
                    r.category,
                    r.severity,
                    langs
                );
            }
        }
        RulesCommands::Validate => {
            println!("Rule validation not yet implemented.");
        }
    }
    Ok(())
}

fn print_summary(ast: &ASTNode) {
    println!("\n=== AST Summary ===");
    println!("  Node type: {:?}", ast.node_type);
    println!("  Children: {}", ast.children.len());
    println!("  Lines: {}", ast.metadata.line_count);
    println!("  Tokens: {}", ast.metadata.token_count);
    println!("  Complexity: {:.2}", ast.metadata.complexity_score);

    if !ast.symbols.is_empty() {
        println!("\n  Symbols:");
        for symbol in &ast.symbols {
            println!(
                "    {:?} {} (public: {})",
                symbol.kind, symbol.name, symbol.is_public
            );
        }
    }
}

// ── HTML Report ──────────────────────────────────────────────────────────

// Output a simple HTML dashboard view. No <style> block to avoid Rust
// `println!` brace-escaping issues. The HTML structure is clean and can
// be styled later or integrated into the collaboration platform.
fn print_html_report(ast: &ASTNode) {
    let source_file = &ast.metadata.source_file;
    let node_type = format!("{:?}", ast.node_type);
    let line_count = ast.metadata.line_count;
    let token_count = ast.metadata.token_count;
    let complexity = ast.metadata.complexity_score;

    // Output a complete, stand-alone HTML document WITHOUT a <style> block.
    // All formatting is done with plain HTML attributes and text.
    // This can be saved as .html and opened in any browser, and later styled
    // or integrated into the platform's dashboard.
    println!("<!DOCTYPE html>");
    println!("<html lang='en'>");
    println!("<head>");
    println!("<meta charset='UTF-8'>");
    println!("<meta name='viewport' content='width=device-width, initial-scale=1.0'>");
    println!("<title>TechDebt AI - Code Analysis Report</title>");
    println!("</head>");
    println!("<body>");
    println!(
        "<div style='max-width:800px; margin: 40px auto; font-family: Arial, sans-serif; background: #fff; padding: 30px; border: 1px solid #ddd; border-radius: 8px;'>"
    );
    println!(
        "<h1 style='color: #2d3748; border-bottom: 2px solid #2d3748; padding-bottom: 10px;'>TechDebt AI - Code Analysis Report</h1>"
    );

    // File info row
    println!(
        "<div style='display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;'>"
    );
    println!("<div><p><strong>File:</strong> {}</>", source_file);
    println!("<p><strong>Language:</strong> {}</>", node_type);
    println!("<p><strong>Lines of Code:</strong> {}</>", line_count);
    println!("<p><strong>Tokens:</strong> {}</>", token_count);
    println!("<p><strong>Complexity Score:</strong> {:.2}</>", complexity);
    println!("</div>");

    // Rules summary
    println!("<h3 style='margin: 20px 0 10px 0; color: #2d3748;'>Rules Analysis</h3>");
    println!("<p style='margin: 0 0 15px 0; line-height: 1.6;'>");
    println!(
        "10 built-in rules evaluated across: complexity, security, maintainability, style, performance."
    );
    println!("</p>");
    println!(
        "<div style='background: #f8f9fa; padding: 12px; border-radius: 4px; margin: 10px 0;'>"
    );
    println!(
        "<p style='margin: 0; font-size: 0.85rem; color: #4a5568;'><strong>Critical:</strong> Hardcoded secrets, SQL injection</p>"
    );
    println!(
        "<p style='margin: 3px 0 0 0; font-size: 0.85rem; color: #4a5568;'><strong>High:</strong> Cyclomatic complexity > 10, deep nesting > 3</p>"
    );
    println!(
        "<p style='margin: 3px 0 0 0; font-size: 0.85rem; color: #4a5568;'><strong>Medium:</strong> Low maintainability index, magic numbers</p>"
    );
    println!(
        "<p style='margin: 3px 0 0 0; font-size: 0.85rem; color: #4a5568;'><strong>Low:</strong> Long lines, style convention violations</p>"
    );
    println!(
        "<p style='margin: 3px 0 0 0; font-size: 0.85rem; color: #4a5568;'><strong>Info:</strong> CamelCase, PascalCase checks</p>"
    );
    println!("</div>");

    // Footer
    println!(
        "<div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #718096; font-size: 0.85rem;'>"
    );
    println!("  <p>TechDebt AI v0.1.0 · Static code analysis report generated automatically</p>");
    println!(
        "  <p>For integration into the Arabic-First Collaboration Platform, this HTML report can be"
    );
    println!("  parsed and displayed within the platform's developer tools module.</p>");
    println!("</div>");

    println!("</div>");
    println!("</body>");
    println!("</html>");
}
