use serde::{Deserialize, Serialize};
use td_common::FixInfo;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub category: String,
    pub severity: String,
    pub enabled: bool,
    pub languages: Vec<String>,
    #[serde(default)]
    pub condition: Option<Condition>,
    #[serde(default)]
    pub pattern: Option<PatternRule>,
    #[serde(default)]
    pub suggestion: Option<String>,
    #[serde(default)]
    pub refactoring: Option<RefactoringConfig>,
    #[serde(default)]
    pub fix_template: Option<String>,
    #[serde(default)]
    pub metadata: RuleMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleMetadata {
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub references: Vec<String>,
    #[serde(default)]
    pub cwe_id: Option<String>,
    #[serde(default)]
    pub owasp_category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    pub metric: String,
    pub operator: String,
    pub threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternRule {
    pub query: String,
    pub message_template: String,
    #[serde(default)]
    pub capture_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefactoringConfig {
    pub template: Option<String>,
    pub strategy: Option<String>,
    pub confidence_threshold: f64,
    pub requires_approval: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleMatch {
    pub rule_id: String,
    pub rule_name: String,
    pub severity: String,
    pub category: String,
    pub message: String,
    pub suggestion: Option<String>,
    pub fix_template: Option<String>,
    pub file_path: String,
    pub line_number: u32,
    #[serde(default)]
    pub column: u32,
    #[serde(default)]
    pub end_line: u32,
    #[serde(default)]
    pub end_column: u32,
    #[serde(default)]
    pub code_snippet: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fix: Option<FixInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleSet {
    pub rules: Vec<Rule>,
    #[serde(default)]
    pub extends: Option<String>,
    #[serde(default)]
    pub overrides: Vec<RuleOverride>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleOverride {
    pub id: String,
    pub enabled: Option<bool>,
    pub severity: Option<String>,
    pub threshold: Option<f64>,
}

impl Rule {
    pub fn matches_language(&self, lang: &str) -> bool {
        self.languages.iter().any(|l| l.eq_ignore_ascii_case(lang))
    }

    pub fn is_metric_rule(&self) -> bool {
        self.condition.is_some()
    }

    pub fn is_pattern_rule(&self) -> bool {
        self.pattern.is_some()
    }
}

/// Extract a single source line (0-based `line`) for use as a code snippet.
pub fn line_snippet(source: &str, line: usize) -> Option<String> {
    source.lines().nth(line).map(|l| l.trim_end().to_string())
}
