use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── Language ───────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Language {
    TypeScript,
    JavaScript,
    Python,
    Rust,
    Go,
    Java,
    C,
    CSharp,
    Cpp,
    Ruby,
    PHP,
    Swift,
    Kotlin,
    Scala,
}

impl Language {
    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext {
            "ts" | "tsx" => Some(Self::TypeScript),
            "js" | "jsx" => Some(Self::JavaScript),
            "py" | "pyw" => Some(Self::Python),
            "rs" => Some(Self::Rust),
            "go" => Some(Self::Go),
            "java" => Some(Self::Java),
            "cs" => Some(Self::CSharp),
            "c" | "h" => Some(Self::C),
            "cpp" | "cc" | "cxx" | "hpp" => Some(Self::Cpp),
            "rb" => Some(Self::Ruby),
            "php" => Some(Self::PHP),
            "swift" => Some(Self::Swift),
            "kt" | "kts" => Some(Self::Kotlin),
            "scala" => Some(Self::Scala),
            _ => None,
        }
    }

    /// Canonical lowercase id used in rule language lists and CLI JSON output.
    pub fn id(&self) -> &'static str {
        match self {
            Self::TypeScript => "typescript",
            Self::JavaScript => "javascript",
            Self::Python => "python",
            Self::Rust => "rust",
            Self::Go => "go",
            Self::Java => "java",
            Self::CSharp => "csharp",
            Self::C => "c",
            Self::Cpp => "cpp",
            Self::Ruby => "ruby",
            Self::PHP => "php",
            Self::Swift => "swift",
            Self::Kotlin => "kotlin",
            Self::Scala => "scala",
        }
    }

    pub fn tree_sitter_name(&self) -> &'static str {
        match self {
            Self::TypeScript | Self::JavaScript => "typescript",
            Self::Python => "python",
            Self::Rust => "rust",
            Self::Go => "go",
            Self::Java => "java",
            Self::C => "c",
            Self::Cpp => "cpp",
            Self::CSharp => "csharp",
            Self::Ruby => "ruby",
            Self::PHP => "php",
            _ => "unknown",
        }
    }

    /// Whether the grammar used for this language is the TSX grammar.
    pub fn uses_tsx_grammar(&self) -> bool {
        false
    }
}

// ─── Position & Range ───────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

// ─── AST Node ───────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeType {
    // Program structure
    Program,
    Module,
    Statement,
    Expression,

    // Declarations
    FunctionDeclaration,
    ClassDeclaration,
    StructDeclaration,
    EnumDeclaration,
    TraitDeclaration,
    ImplDeclaration,
    InterfaceDeclaration,
    TypeAlias,
    VariableDeclaration,
    ConstantDeclaration,
    ImportDeclaration,
    ExportDeclaration,

    // Expressions
    FunctionCall,
    MethodCall,
    BinaryExpression,
    UnaryExpression,
    AssignmentExpression,
    ConditionalExpression,
    LambdaExpression,
    AwaitExpression,

    // Control flow
    IfStatement,
    ElseClause,
    ForLoop,
    WhileLoop,
    MatchExpression,
    TryCatch,
    ReturnStatement,
    BreakStatement,
    ContinueStatement,

    // Types
    TypeAnnotation,
    GenericType,
    UnionType,
    IntersectionType,

    // Misc
    Block,
    Parameter,
    Argument,
    Field,
    Comment,
    Attribute,
    Decorator,

    // Catch-all
    Unknown(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Symbol {
    pub name: String,
    pub kind: SymbolKind,
    pub range: Range,
    pub is_public: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SymbolKind {
    Function,
    Class,
    Struct,
    Enum,
    Trait,
    Interface,
    Variable,
    Constant,
    Parameter,
    Field,
    Module,
    Type,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeMetadata {
    pub line_count: u32,
    pub character_count: u32,
    pub hash: String,
    pub complexity_score: f64,
    pub token_count: usize,
    pub source_file: String,
    pub module_path: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ASTNode {
    pub id: String,
    pub node_type: NodeType,
    /// Raw tree-sitter node kind (e.g. "method_declaration", "catch_clause").
    pub kind: String,
    /// Source text covered by this node.
    pub text: String,
    pub range: Range,
    pub children: Vec<ASTNode>,
    pub parent_id: Option<String>,
    pub metadata: NodeMetadata,
    pub symbols: Vec<Symbol>,
    pub annotations: Vec<String>,
}

// ─── Issues ─────────────────────────────────────────────────

/// Machine-actionable auto-fix hint attached to a rule match.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FixInfo {
    /// Fix strategy: e.g. "remove_line".
    pub kind: String,
    /// Human-readable description of the fix.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Per-call analysis configuration: threshold overrides, ignore lists and path filters.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AnalyzeOptions {
    /// Metric-name → threshold override (e.g. "cyclomatic_complexity", "max_nesting_depth",
    /// "maintainability_index", "max_line_length", "max_line_reports").
    #[serde(default)]
    pub thresholds: HashMap<String, f64>,
    /// Rule ids to disable entirely for this call.
    #[serde(default)]
    pub ignore_rules: Vec<String>,
    /// File path suffixes/globs whose findings are dropped.
    #[serde(default)]
    pub exclude_paths: Vec<String>,
    /// If non-empty, only findings in paths matching one of these suffixes are kept.
    #[serde(default)]
    pub include_paths: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum IssueCategory {
    Complexity,
    Duplication,
    Coupling,
    Size,
    Naming,
    Security,
    Performance,
    DeadCode,
    Style,
    BestPractices,
    Testing,
    Documentation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Issue {
    pub id: String,
    pub file_path: String,
    pub line_number: u32,
    pub column_start: u32,
    pub column_end: u32,
    pub message: String,
    pub severity: Severity,
    pub confidence: f64,
    pub category: IssueCategory,
    pub rule_id: String,
    pub fingerprint: String,
    pub is_fixed: bool,
    pub created_at: DateTime<Utc>,
}

// ─── Metrics ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsResult {
    pub metrics: HashMap<String, f64>,
    pub targets: Vec<MetricTarget>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricTarget {
    pub target_type: String,
    pub target_id: String,
    pub metric_type: String,
    pub value: f64,
    pub category: String,
    /// 0-based start line of the target node in the source file.
    #[serde(default)]
    pub line: u32,
    /// 0-based end line of the target node in the source file.
    #[serde(default)]
    pub end_line: u32,
}

// ─── Scan ───────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ScanStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub id: String,
    pub project_id: String,
    pub status: ScanStatus,
    pub files_scanned: u32,
    pub lines_analyzed: u64,
    pub issues: Vec<Issue>,
    pub metrics: MetricsResult,
    pub duration_ms: u64,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

// ─── Refactoring ────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RefactoringStatus {
    Planned,
    PendingApproval,
    Approved,
    Applied,
    Rejected,
    RolledBack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Refactoring {
    pub id: String,
    pub project_id: String,
    pub issue_id: String,
    pub original_code: String,
    pub refactored_code: String,
    pub confidence: f64,
    pub status: RefactoringStatus,
    pub approved_by: Option<String>,
    pub approved_at: Option<DateTime<Utc>>,
    pub applied_at: Option<DateTime<Utc>>,
    pub rollback_available: bool,
    pub metadata: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
}
