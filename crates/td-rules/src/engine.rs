use crate::loader::{Condition, Rule, RuleMatch, RuleMetadata, line_snippet};
use regex::Regex;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use td_common::{AnalyzeOptions, FixInfo, MetricsResult};

pub struct RuleEngine {
    rules: Vec<Rule>,
}

impl RuleEngine {
    pub fn new() -> Self {
        Self { rules: Vec::new() }
    }

    pub fn load_rules(&mut self, rules: Vec<Rule>) {
        self.rules.extend(rules);
    }

    pub fn load_builtin_rules(&mut self) {
        self.load_rules(vec![
            // === COMPLEXITY RULES ===
            Rule {
                id: "high_complexity".to_string(),
                name: "High Cyclomatic Complexity".to_string(),
                category: "complexity".to_string(),
                severity: "high".to_string(),
                enabled: true,
                languages: vec![
                    "rust".to_string(),
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "go".to_string(),
                    "java".to_string(),
                    "c".to_string(),
                    "ruby".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: Some(Condition {
                    metric: "cyclomatic_complexity".to_string(),
                    operator: ">".to_string(),
                    threshold: 10.0,
                }),
                suggestion: Some("This function has high cyclomatic complexity. Consider breaking it down into smaller functions.".to_string()),
                refactoring: None,
                pattern: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["complexity".to_string(), "maintainability".to_string()],
                    references: vec!["Clean Code".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "deep_nesting".to_string(),
                name: "Deep Nesting of Conditionals".to_string(),
                category: "complexity".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "rust".to_string(),
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "go".to_string(),
                    "java".to_string(),
                    "c".to_string(),
                    "ruby".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: Some(Condition {
                    metric: "max_nesting_depth".to_string(),
                    operator: ">".to_string(),
                    threshold: 3.0,
                }),
                suggestion: Some("Reduce nesting depth by using guard clauses or extracting logic.".to_string()),
                refactoring: None,
                pattern: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["complexity".to_string(), "readability".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "low_maintainability".to_string(),
                name: "Low Maintainability Index".to_string(),
                category: "maintainability".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "rust".to_string(),
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "go".to_string(),
                    "java".to_string(),
                    "c".to_string(),
                    "ruby".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: Some(Condition {
                    metric: "maintainability_index".to_string(),
                    operator: "<".to_string(),
                    threshold: 20.0,
                }),
                suggestion: Some("This code has a low maintainability index. Consider refactoring for clarity.".to_string()),
                refactoring: None,
                pattern: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["maintainability".to_string(), "readability".to_string()],
                    ..Default::default()
                },
            },

            // === SECURITY RULES ===
            Rule {
                id: "hardcoded_secrets".to_string(),
                name: "Hardcoded Secrets / API Keys".to_string(),
                category: "security".to_string(),
                severity: "critical".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "rust".to_string(),
                    "go".to_string(),
                    "java".to_string(),
                    "ruby".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                suggestion: Some("Use environment variables or a secrets manager. Never commit credentials to version control.".to_string()),
                refactoring: None,
                pattern: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec![
                        "security".to_string(),
                        "secrets".to_string(),
                        "owasp-a02".to_string()
                    ],
                    cwe_id: Some("CWE-798".to_string()),
                    owasp_category: Some("A02:2021 - Cryptographic Failures".to_string()),
                    ..Default::default()
                },
            },
            Rule {
                id: "sql_injection".to_string(),
                name: "Potential SQL Injection".to_string(),
                category: "security".to_string(),
                severity: "critical".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "java".to_string(),
                    "go".to_string(),
                    "ruby".to_string(),
                    "csharp".to_string(),
                    "rust".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                suggestion: Some("Use parameterized queries or prepared statements instead of string concatenation.".to_string()),
                refactoring: None,
                pattern: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec![
                        "security".to_string(),
                        "sql-injection".to_string(),
                        "owasp-a01".to_string()
                    ],
                    cwe_id: Some("CWE-89".to_string()),
                    owasp_category: Some("A01:2021 - Broken Access Control".to_string()),
                    ..Default::default()
                },
            },

            // === CODE SMELLS ===
            Rule {
                id: "long_line".to_string(),
                name: "Line Too Long".to_string(),
                category: "code-smell".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "rust".to_string(),
                    "go".to_string(),
                    "java".to_string(),
                    "c".to_string(),
                    "ruby".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                suggestion: Some("Consider breaking this line or renaming to stay within 160 chars.".to_string()),
                fix_template: Some("Split line at operator into multiple lines".to_string()),
                refactoring: None,
                pattern: None,
                metadata: RuleMetadata {
                    tags: vec!["code-smell".to_string(), "style".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "magic_number".to_string(),
                name: "Magic Number Detected".to_string(),
                category: "code-smell".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "rust".to_string(),
                    "go".to_string(),
                    "java".to_string(),
                    "c".to_string(),
                    "ruby".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                suggestion: Some("Use a named constant instead of a magic number for clarity.".to_string()),
                fix_template: Some("Replace magic number with constant: const MAGIC = value".to_string()),
                refactoring: None,
                pattern: None,
                metadata: RuleMetadata {
                    tags: vec!["code-smell".to_string(), "readability".to_string()],
                    ..Default::default()
                },
            },

            // === STYLE RULES ===
            Rule {
                id: "camel_case".to_string(),
                name: "Function Not in Camel Case".to_string(),
                category: "style".to_string(),
                severity: "info".to_string(),
                enabled: true,
                languages: vec![
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "python".to_string(),
                    "java".to_string(),
                    "go".to_string(),
                    "csharp".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                suggestion: Some("Rename to use camelCase convention.".to_string()),
                fix_template: Some("Rename function from snake_case to camelCase".to_string()),
                refactoring: None,
                pattern: None,
                metadata: RuleMetadata {
                    tags: vec!["style".to_string(), "naming".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "pascal_case".to_string(),
                name: "Type/Class Not in Pascal Case".to_string(),
                category: "style".to_string(),
                severity: "info".to_string(),
                enabled: true,
                languages: vec![
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "rust".to_string(),
                    "java".to_string(),
                    "go".to_string(),
                    "c".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                    "ruby".to_string(),
                ],
                condition: None,
                suggestion: Some("Rename to use PascalCase convention.".to_string()),
                fix_template: Some("Rename type from snake_case to PascalCase".to_string()),
                refactoring: None,
                pattern: None,
                metadata: RuleMetadata {
                    tags: vec!["style".to_string(), "naming".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "todo_comment".to_string(),
                name: "TODO/FIXME Comment".to_string(),
                category: "best-practices".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![],
                condition: None,
                suggestion: Some("Incomplete work is marked here. Track it as a task or finish it.".to_string()),
                refactoring: None,
                pattern: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["best-practices".to_string(), "documentation".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "debug_logging".to_string(),
                name: "Debug Logging Left in Code".to_string(),
                category: "best-practices".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "python".to_string(),
                    "java".to_string(),
                    "ruby".to_string(),
                    "csharp".to_string(),
                    "go".to_string(),
                    "rust".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                suggestion: Some("Remove or gate debug logging before merging.".to_string()),
                refactoring: None,
                pattern: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["best-practices".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "eval_usage".to_string(),
                name: "Use of Dangerous eval/exec".to_string(),
                category: "security".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "python".to_string(),
                    "java".to_string(),
                    "ruby".to_string(),
                    "php".to_string(),
                    "cpp".to_string(),
                    "csharp".to_string(),
                ],
                condition: None,
                suggestion: Some("eval/exec executes arbitrary code. Prefer safer parsing (JSON.parse, AST parsers).".to_string()),
                refactoring: None,
                pattern: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["security".to_string(), "owasp-a03".to_string()],
                    cwe_id: Some("CWE-95".to_string()),
                    owasp_category: Some("A03:2021 - Injection".to_string()),
                    ..Default::default()
                },
            },
            Rule {
                id: "empty_catch_block".to_string(),
                name: "Empty catch Block Swallows Errors".to_string(),
                category: "best-practices".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "java".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                suggestion: Some("Empty catch blocks hide failures. Log, rethrow, or handle the error.".to_string()),
                refactoring: None,
                pattern: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["best-practices".to_string(), "error-handling".to_string()],
                    ..Default::default()
                },
            },

            // === PERFORMANCE ===
            Rule {
                id: "string_concat_loop".to_string(),
                name: "String Concatenation in Loop".to_string(),
                category: "performance".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "java".to_string(),
                    "go".to_string(),
                    "ruby".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                suggestion: Some("Collect items in a list/array and use join/combine at the end.".to_string()),
                refactoring: None,
                pattern: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["performance".to_string(), "algorithmic".to_string()],
                    ..Default::default()
                },
            },

            // === DEAD CODE ===
            Rule {
                id: "unused_import".to_string(),
                name: "Import Never Used".to_string(),
                category: "dead-code".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                ],
                condition: None,
                suggestion: Some("Remove the unused import to keep the surface area small.".to_string()),
                refactoring: None,
                pattern: None,
                fix_template: Some("Remove import statement".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["dead-code".to_string(), "maintainability".to_string()],
                    ..Default::default()
                },
            },

            // === TYPES ===
            Rule {
                id: "careless_any".to_string(),
                name: "Careless use of `any`".to_string(),
                category: "code-smell".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec!["typescript".to_string()],
                condition: None,
                suggestion: Some("Replace `any` with a precise type or `unknown` + narrowing.".to_string()),
                refactoring: None,
                pattern: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["types".to_string(), "type-safety".to_string()],
                    ..Default::default()
                },
            },

            // =============================================================
            // ===ADDED: DEEPER SECURITY / BEST PRACTICES / SMELLS / PERF===
            // =============================================================

            // ── SECURITY ──
            Rule {
                id: "command_injection".to_string(),
                name: "Potential Command Injection".to_string(),
                category: "security".to_string(),
                severity: "high".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "java".to_string(),
                    "go".to_string(),
                    "rust".to_string(),
                    "ruby".to_string(),
                    "php".to_string(),
                    "c".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some(
                    "Never build shell commands from strings. Use exec-array APIs and validate \
                     every user-controlled argument."
                        .to_string(),
                ),
                refactoring: None,
                fix_template: Some("Switch to exec-array / subprocess (list) form".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["security".to_string(), "command-injection".to_string(), "owasp-a03".to_string()],
                    cwe_id: Some("CWE-78".to_string()),
                    owasp_category: Some("A03:2021 - Injection".to_string()),
                    ..Default::default()
                },
            },
            Rule {
                id: "path_traversal".to_string(),
                name: "Path Traversal in File Access".to_string(),
                category: "security".to_string(),
                severity: "high".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "java".to_string(),
                    "go".to_string(),
                    "ruby".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some(
                    "Resolve and canonicalize user-supplied paths; reject absolute paths and `..` \
                     segments before file operations."
                        .to_string(),
                ),
                refactoring: None,
                fix_template: Some("Canonicalize path and verify it stays below the allowed root".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["security".to_string(), "path-traversal".to_string(), "owasp-a01".to_string()],
                    cwe_id: Some("CWE-22".to_string()),
                    owasp_category: Some("A01:2021 - Broken Access Control".to_string()),
                    ..Default::default()
                },
            },
            Rule {
                id: "weak_hash".to_string(),
                name: "Weak Hash Algorithm for Secrets".to_string(),
                category: "security".to_string(),
                severity: "high".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "go".to_string(),
                    "java".to_string(),
                    "rust".to_string(),
                    "ruby".to_string(),
                    "php".to_string(),
                    "csharp".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some(
                    "md5/sha1 are broken for credentials. Use an adaptive hash (bcrypt/argon2/scrypt/PBKDF2)."
                        .to_string(),
                ),
                refactoring: None,
                fix_template: Some("Replace md5/sha1 with bcrypt/argon2 for stored secrets".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["security".to_string(), "weak-hash".to_string(), "owasp-a02".to_string()],
                    cwe_id: Some("CWE-327".to_string()),
                    owasp_category: Some("A02:2021 - Cryptographic Failures".to_string()),
                    ..Default::default()
                },
            },
            Rule {
                id: "insecure_random".to_string(),
                name: "Insecure Randomness".to_string(),
                category: "security".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "go".to_string(),
                    "java".to_string(),
                    "ruby".to_string(),
                    "php".to_string(),
                    "rust".to_string(),
                    "csharp".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some(
                    "Do not use Math.random / rand for tokens, OTPs, salts or sessions. Use a CSPRNG."
                        .to_string(),
                ),
                refactoring: None,
                fix_template: Some("Use a cryptographically-secure RNG for secrets/tokens".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["security".to_string(), "randomness".to_string(), "owasp-a02".to_string()],
                    cwe_id: Some("CWE-330".to_string()),
                    owasp_category: Some("A02:2021 - Cryptographic Failures".to_string()),
                    ..Default::default()
                },
            },
            Rule {
                id: "weak_crypto".to_string(),
                name: "Use of Weak / Broken Crypto".to_string(),
                category: "security".to_string(),
                severity: "high".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "go".to_string(),
                    "java".to_string(),
                    "ruby".to_string(),
                    "php".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some(
                    "DES/3DES/RC4/RC2/Blowfish and ECB mode are insecure. Use AEAD ciphers (AES-GCM)."
                        .to_string(),
                ),
                refactoring: None,
                fix_template: Some("Replace weak cipher/ECB with AES-GCM + random IV".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["security".to_string(), "weak-crypto".to_string(), "owasp-a02".to_string()],
                    cwe_id: Some("CWE-327".to_string()),
                    owasp_category: Some("A02:2021 - Cryptographic Failures".to_string()),
                    ..Default::default()
                },
            },
            Rule {
                id: "hardcoded_credentials_url".to_string(),
                name: "Credentials Embedded in URL".to_string(),
                category: "security".to_string(),
                severity: "high".to_string(),
                enabled: true,
                languages: vec![],
                condition: None,
                pattern: None,
                suggestion: Some(
                    "Remove credentials from connection URLs; load from environment or a secret store."
                        .to_string(),
                ),
                refactoring: None,
                fix_template: Some("Move URL credentials to environment variables".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["security".to_string(), "secrets".to_string(), "owasp-a07".to_string()],
                    cwe_id: Some("CWE-798".to_string()),
                    owasp_category: Some("A07:2021 - Identification and Authentication Failures".to_string()),
                    ..Default::default()
                },
            },
            Rule {
                id: "hardcoded_ip_address".to_string(),
                name: "Hardcoded IP Address".to_string(),
                category: "security".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![],
                condition: None,
                pattern: None,
                suggestion: Some(
                    "Use configurable hosts/DNS instead of literal private IPs scattered in code."
                        .to_string(),
                ),
                refactoring: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["security".to_string(), "configuration".to_string()],
                    ..Default::default()
                },
            },

            // ── BEST PRACTICES ──
            Rule {
                id: "mutable_global_state".to_string(),
                name: "Mutable Global State".to_string(),
                category: "best-practices".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "go".to_string(),
                    "php".to_string(),
                    "ruby".to_string(),
                    "java".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some(
                    "Prefer immutable module-level data or explicit singletons with a single accessor."
                        .to_string(),
                ),
                refactoring: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["best-practices".to_string(), "state".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "empty_function".to_string(),
                name: "Empty Function / Stub".to_string(),
                category: "best-practices".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "java".to_string(),
                    "go".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some(
                    "An empty or stub function is dead API surface. Implement it or remove it."
                        .to_string(),
                ),
                refactoring: None,
                fix_template: Some("Implement body or delete the stub".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["best-practices".to_string(), "dead-code".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "redundant_boolean_comparison".to_string(),
                name: "Redundant Boolean Comparison".to_string(),
                category: "best-practices".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![],
                condition: None,
                pattern: None,
                suggestion: Some("Compare against the boolean directly (`if (flag)` instead of `== true`).".to_string()),
                refactoring: None,
                fix_template: Some("Drop the comparison with true/false".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["best-practices".to_string(), "readability".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "hardcoded_timeout".to_string(),
                name: "Hardcoded Timeout".to_string(),
                category: "best-practices".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![],
                condition: None,
                pattern: None,
                suggestion: Some("Put timeouts in configuration, not as inline magic values.".to_string()),
                refactoring: None,
                fix_template: Some("Move timeout to a named constant or config".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["best-practices".to_string(), "configuration".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "missing_docs_public_api".to_string(),
                name: "Public API Missing Documentation".to_string(),
                category: "best-practices".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "python".to_string(),
                    "java".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some("Document exported/public functions and types so consumers know the contract.".to_string()),
                refactoring: None,
                fix_template: Some("Add doc comment above the public declaration".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["best-practices".to_string(), "documentation".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "shadowed_builtin".to_string(),
                name: "Variable Shadows a Builtin".to_string(),
                category: "best-practices".to_string(),
                severity: "info".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "go".to_string(),
                    "ruby".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some("Renaming shadows a language builtin and can cause subtle bugs.".to_string()),
                refactoring: None,
                fix_template: Some("Rename variable not to shadow the builtin".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["best-practices".to_string(), "naming".to_string()],
                    ..Default::default()
                },
            },

            // ── CODE SMELLS ──
            Rule {
                id: "long_function".to_string(),
                name: "Function Too Long".to_string(),
                category: "code-smell".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "rust".to_string(),
                    "go".to_string(),
                    "java".to_string(),
                    "c".to_string(),
                    "ruby".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some("Split long functions into smaller, single-purpose helpers.".to_string()),
                refactoring: None,
                fix_template: Some("Split function into cohesive, smaller functions".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["code-smell".to_string(), "complexity".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "too_many_parameters".to_string(),
                name: "Too Many Parameters".to_string(),
                category: "code-smell".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "java".to_string(),
                    "go".to_string(),
                    "ruby".to_string(),
                    "rust".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: Some(Condition {
                    metric: "parameter_count".to_string(),
                    operator: ">".to_string(),
                    threshold: 6.0,
                }),
                pattern: None,
                suggestion: Some("Group related parameters into a request object or struct.".to_string()),
                refactoring: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["code-smell".to_string(), "design".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "too_many_returns".to_string(),
                name: "Too Many Return Points".to_string(),
                category: "code-smell".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "java".to_string(),
                    "go".to_string(),
                    "ruby".to_string(),
                    "rust".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: Some(Condition {
                    metric: "return_count".to_string(),
                    operator: ">".to_string(),
                    threshold: 4.0,
                }),
                pattern: None,
                suggestion: Some("Too many exits make control flow hard to follow. Consolidate returns.".to_string()),
                refactoring: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["code-smell".to_string(), "control-flow".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "nested_ternary".to_string(),
                name: "Nested Ternary Operator".to_string(),
                category: "code-smell".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "java".to_string(),
                    "php".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some("Nested ternaries are hard to read. Extract into if/else or a helper.".to_string()),
                refactoring: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["code-smell".to_string(), "readability".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "self_comparison".to_string(),
                name: "Variable Compared With Itself".to_string(),
                category: "code-smell".to_string(),
                severity: "info".to_string(),
                enabled: true,
                languages: vec![],
                condition: None,
                pattern: None,
                suggestion: Some("x == x is a tautology; this usually signals a copy/paste bug.".to_string()),
                refactoring: None,
                fix_template: Some("Fix the operand to the intended variable".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["code-smell".to_string(), "bugs".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "duplicate_function".to_string(),
                name: "Duplicate Function / Overridden Definition".to_string(),
                category: "code-smell".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "go".to_string(),
                    "ruby".to_string(),
                    "php".to_string(),
                    "rust".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some("The same name is defined more than once; later definitions silently win.".to_string()),
                refactoring: None,
                fix_template: Some("Rename or remove the duplicate definition".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["code-smell".to_string(), "dead-code".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "commented_out_code".to_string(),
                name: "Commented-Out Code".to_string(),
                category: "code-smell".to_string(),
                severity: "low".to_string(),
                enabled: true,
                languages: vec![],
                condition: None,
                pattern: None,
                suggestion: Some("Commented-out code rots. Delete it or track it via version control.".to_string()),
                refactoring: None,
                fix_template: Some("Delete commented-out block".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["code-smell".to_string(), "dead-code".to_string()],
                    ..Default::default()
                },
            },

            // ── PERFORMANCE ──
            Rule {
                id: "n_plus_one_query".to_string(),
                name: "N+1 Query Inside Loop".to_string(),
                category: "performance".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "python".to_string(),
                    "java".to_string(),
                    "go".to_string(),
                    "ruby".to_string(),
                    "php".to_string(),
                    "csharp".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some("Issue one batched query instead of repeatedly hitting the DB in a loop.".to_string()),
                refactoring: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["performance".to_string(), "database".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "sync_network_io".to_string(),
                name: "Blocking Network I/O in Loop".to_string(),
                category: "performance".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "python".to_string(),
                    "go".to_string(),
                    "java".to_string(),
                    "ruby".to_string(),
                    "php".to_string(),
                    "csharp".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some("Synchronous network calls inside a loop serialize execution. Batch or parallelize.".to_string()),
                refactoring: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["performance".to_string(), "io".to_string()],
                    ..Default::default()
                },
            },
            Rule {
                id: "regex_in_loop".to_string(),
                name: "Regex Compilation in Loop".to_string(),
                category: "performance".to_string(),
                severity: "medium".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "java".to_string(),
                    "go".to_string(),
                    "rust".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some("Compile the regex once outside the loop and reuse it.".to_string()),
                refactoring: None,
                fix_template: None,
                metadata: RuleMetadata {
                    tags: vec!["performance".to_string(), "regex".to_string()],
                    ..Default::default()
                },
            },

            // ── DOCUMENTATION ──
            Rule {
                id: "low_comment_density".to_string(),
                name: "Low Comment Density".to_string(),
                category: "code-smell".to_string(),
                severity: "info".to_string(),
                enabled: true,
                languages: vec![
                    "python".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "rust".to_string(),
                    "go".to_string(),
                    "java".to_string(),
                    "c".to_string(),
                    "ruby".to_string(),
                    "csharp".to_string(),
                    "cpp".to_string(),
                    "php".to_string(),
                ],
                condition: None,
                pattern: None,
                suggestion: Some("Non-trivial files with almost no comments are hard to maintain.".to_string()),
                refactoring: None,
                fix_template: Some("Add doc comments and explain non-obvious logic".to_string()),
                metadata: RuleMetadata {
                    tags: vec!["code-smell".to_string(), "documentation".to_string()],
                    ..Default::default()
                },
            },
        ]);
    }

    pub fn evaluate(
        &self,
        ast: &td_common::ASTNode,
        metrics: &MetricsResult,
        file_path: &str,
        source: &str,
        language: &str,
    ) -> Vec<RuleMatch> {
        self.evaluate_with(
            ast,
            metrics,
            file_path,
            source,
            language,
            &AnalyzeOptions::default(),
        )
    }

    pub fn evaluate_with(
        &self,
        ast: &td_common::ASTNode,
        metrics: &MetricsResult,
        file_path: &str,
        source: &str,
        language: &str,
        options: &AnalyzeOptions,
    ) -> Vec<RuleMatch> {
        let mut matches = Vec::new();

        for rule in &self.rules {
            if !rule.enabled {
                continue;
            }
            if !options.ignore_rules.is_empty()
                && options.ignore_rules.iter().any(|r| r == &rule.id)
            {
                continue;
            }
            if !rule.languages.is_empty() && !rule.matches_language(language) {
                continue;
            }

            // Metric-condition rules fire against both the whole file and each
            // per-function/per-class target, so matches point at the exact line.
            if let Some(condition) = &rule.condition {
                let threshold = options
                    .thresholds
                    .get(&condition.metric)
                    .copied()
                    .unwrap_or(condition.threshold);
                let condition = Condition {
                    metric: condition.metric.clone(),
                    operator: condition.operator.clone(),
                    threshold,
                };
                if let Some(value) = metrics.metrics.get(&condition.metric)
                    && Self::triggered(*value, &condition)
                {
                    Self::push_match(
                        rule,
                        ast.range.start.line + 1,
                        1,
                        ast.kind.clone(),
                        line_snippet(source, ast.range.start.line as usize),
                        &format!(
                            "{}: {} is {} (threshold: {})",
                            rule.name, condition.metric, value, condition.threshold
                        ),
                        file_path,
                        &mut matches,
                    );
                }

                for target in &metrics.targets {
                    if target.category != "local" || target.metric_type != condition.metric {
                        continue;
                    }
                    if Self::triggered(target.value, &condition) {
                        Self::push_match(
                            rule,
                            target.line + 1,
                            1,
                            format!("{}.{}", target.target_type, target.target_id),
                            line_snippet(source, target.line as usize),
                            &format!(
                                "{}: {} is {} (threshold: {}) in {}",
                                rule.name,
                                condition.metric,
                                target.value,
                                condition.threshold,
                                target.target_id
                            ),
                            file_path,
                            &mut matches,
                        );
                    }
                }
            }
        }

        Self::eval_source_rules(
            &self.rules,
            ast,
            source,
            file_path,
            language,
            options,
            &mut matches,
        );

        // Inline ignore comments, path filters and rule ignores.
        let (file_ignored, inline_ignores) = Self::collect_inline_ignores(source);
        matches.retain(|m| {
            if file_ignored {
                return false;
            }
            if let Some(ignored) = inline_ignores.get(&m.line_number)
                && (ignored.is_empty() || ignored.iter().any(|r| r == &m.rule_id))
            {
                return false;
            }
            if !options.exclude_paths.is_empty()
                && options
                    .exclude_paths
                    .iter()
                    .any(|p| Self::matches_path(file_path, p))
            {
                return false;
            }
            if !options.include_paths.is_empty()
                && !options
                    .include_paths
                    .iter()
                    .any(|p| Self::matches_path(file_path, p))
            {
                return false;
            }
            true
        });

        // Collapse duplicate detections on the same rule and line (e.g. a
        // nested assignment node inside a variable declarator).
        let mut seen = HashMap::new();
        matches.retain(|m| {
            let key = (m.rule_id.clone(), m.line_number);
            seen.insert(key, ()).is_none()
        });

        matches
    }

    fn triggered(value: f64, condition: &Condition) -> bool {
        match condition.operator.as_str() {
            ">" => value > condition.threshold,
            "<" => value < condition.threshold,
            ">=" => value >= condition.threshold,
            "<=" => value <= condition.threshold,
            "==" => (value - condition.threshold).abs() < f64::EPSILON,
            "!=" => (value - condition.threshold).abs() >= f64::EPSILON,
            _ => false,
        }
    }

    // One flat signature keeps every call site a single line; a context struct
    // would only move the same fields around.
    #[allow(clippy::too_many_arguments)]
    fn push_match(
        rule: &Rule,
        line: u32,
        column: u32,
        detail: String,
        snippet: Option<String>,
        message: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        matches.push(RuleMatch {
            rule_id: rule.id.clone(),
            rule_name: rule.name.clone(),
            severity: rule.severity.clone(),
            category: rule.category.clone(),
            message: message.to_string(),
            suggestion: rule.suggestion.clone(),
            fix_template: rule.fix_template.clone(),
            file_path: file_path.to_string(),
            line_number: line,
            column,
            end_line: line,
            end_column: column + detail.len() as u32,
            code_snippet: snippet,
            fix: None,
        });
    }

    /// Walk the AST and source to fire structural/pattern rules with real
    /// line numbers and a snippet of the offending code.
    fn eval_source_rules(
        rules: &[Rule],
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        language: &str,
        options: &AnalyzeOptions,
        matches: &mut Vec<RuleMatch>,
    ) {
        let find = |id: &str| -> Option<&Rule> {
            rules.iter().find(|r| {
                r.enabled
                    && r.id == id
                    && !options.ignore_rules.contains(&r.id)
                    && (r.languages.is_empty() || r.matches_language(language))
            })
        };

        // Comment-based rules: TODO/FIXME/HACK
        if let Some(rule) = find("todo_comment") {
            Self::walk_comments(rule, ast, source, file_path, matches);
        }

        // Security assignment rules: hardcoded secrets, SQL injection
        if let Some(rule) = find("hardcoded_secrets") {
            Self::walk_secret_assignments(rule, ast, source, file_path, matches);
        }
        if let Some(rule) = find("sql_injection") {
            Self::walk_sql_strings(rule, ast, source, file_path, matches);
        }

        // Dangerous constructs: eval/exec, debug logging, empty catch
        if let Some(rule) = find("eval_usage") {
            Self::walk_evals(rule, ast, source, file_path, matches);
        }
        if let Some(rule) = find("debug_logging") {
            Self::walk_debug_logs(rule, ast, source, file_path, matches);
        }
        if let Some(rule) = find("empty_catch_block") {
            Self::walk_empty_catches(rule, ast, source, file_path, matches);
        }

        // Magic numbers inside function bodies
        if let Some(rule) = find("magic_number") {
            Self::walk_magic_numbers(rule, ast, source, file_path, matches);
        }

        // String concatenation inside loops
        if let Some(rule) = find("string_concat_loop") {
            Self::walk_concat_in_loops(rule, ast, source, file_path, matches);
        }

        // Naming conventions
        if let Some(rule) = find("camel_case") {
            Self::walk_naming(rule, ast, source, file_path, matches, true);
        }
        if let Some(rule) = find("pascal_case") {
            Self::walk_naming(rule, ast, source, file_path, matches, false);
        }

        // Long lines (threshold overridable via options)
        if let Some(rule) = find("long_line") {
            let max_len = options
                .thresholds
                .get("max_line_length")
                .map(|v| v.round() as usize)
                .unwrap_or(160);
            let max_reports = options
                .thresholds
                .get("max_line_reports")
                .map(|v| v.round() as usize)
                .unwrap_or(20);
            Self::walk_long_lines(rule, source, file_path, matches, max_len, max_reports);
        }

        // Dead code: unused imports
        if let Some(rule) = find("unused_import") {
            Self::walk_unused_imports(rule, ast, source, file_path, matches);
        }

        // Type safety: careless `any`
        if let Some(rule) = find("careless_any") {
            Self::walk_careless_any(rule, source, file_path, matches);
        }

        // ── New security rules ──
        if let Some(rule) = find("command_injection") {
            Self::walk_command_injection(rule, source, file_path, matches);
        }
        if let Some(rule) = find("path_traversal") {
            Self::walk_path_traversal(rule, source, file_path, matches);
        }
        if let Some(rule) = find("weak_hash") {
            Self::walk_weak_hash(rule, source, file_path, matches);
        }
        if let Some(rule) = find("insecure_random") {
            Self::walk_insecure_random(rule, source, file_path, matches);
        }
        if let Some(rule) = find("weak_crypto") {
            Self::walk_regex_lines(
                rule,
                source,
                file_path,
                matches,
                r#"(?i)\b(des|desede|3des|rc2|rc4|arc4|blowfish|deskeyspec|mode_ecb)\b|"ecb""#,
            );
        }
        if let Some(rule) = find("hardcoded_credentials_url") {
            Self::walk_regex_lines(
                rule,
                source,
                file_path,
                matches,
                r"(?i)[a-z][a-z0-9+.-]*://[^\s/:]+:[^\s/@]+@",
            );
        }
        if let Some(rule) = find("hardcoded_ip_address") {
            Self::walk_regex_lines(
                rule,
                source,
                file_path,
                matches,
                r#"["'`]\s*\b(10\.(1[0-9]{2}|2[0-4][0-9]|25[0-5]|[1-9][0-9]?|[0-9])\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.0\.0\.1|0\.0\.0\.0)\b"#,
            );
        }

        // ── New best-practice rules ──
        if let Some(rule) = find("mutable_global_state") {
            Self::walk_mutable_global_state(rule, source, file_path, matches, language);
        }
        if let Some(rule) = find("empty_function") {
            Self::walk_empty_functions(rule, ast, source, file_path, matches, language);
        }
        if let Some(rule) = find("redundant_boolean_comparison") {
            Self::walk_regex_lines(
                rule,
                source,
                file_path,
                matches,
                r"\b(===|==|!==|!=)\s*(true|false)\b|\b(true|false)\s*(===|==|!==|!=)\b",
            );
        }
        if let Some(rule) = find("hardcoded_timeout") {
            Self::walk_regex_lines(
                rule,
                source,
                file_path,
                matches,
                r"(?i)\b(timeout|connect_timeout|read_timeout|write_timeout|request_timeout|timeoutmillis)\b\s*[:=]\s*\d{4,}\b",
            );
        }
        if let Some(rule) = find("missing_docs_public_api") {
            Self::walk_missing_docs(rule, ast, source, file_path, matches);
        }
        if let Some(rule) = find("shadowed_builtin") {
            Self::walk_shadowed_builtins(rule, ast, source, file_path, matches);
        }

        // ── New code-smell rules ──
        if let Some(rule) = find("long_function") {
            let max_len = options
                .thresholds
                .get("max_function_length")
                .map(|v| v.round() as usize)
                .unwrap_or(60);
            Self::walk_long_functions(rule, ast, source, file_path, matches, max_len);
        }
        if let Some(rule) = find("nested_ternary") {
            Self::walk_nested_ternaries(rule, ast, source, file_path, matches);
        }
        if let Some(rule) = find("self_comparison") {
            Self::walk_self_comparisons(rule, source, file_path, matches);
        }
        if let Some(rule) = find("duplicate_function") {
            Self::walk_duplicate_functions(rule, ast, source, file_path, matches, language);
        }
        if let Some(rule) = find("commented_out_code") {
            Self::walk_commented_out_code(rule, ast, source, file_path, matches);
        }

        // ── New performance rules ──
        if let Some(rule) = find("regex_in_loop") {
            Self::walk_queries_in_loops(
                rule,
                ast,
                source,
                file_path,
                matches,
                r"(?i)\b(new regExp\(|re\.compile\(|regex::new\(|new regex\(|pattern\.compile\(|regex\.compile\(|regex\()",
            );
        }
        if let Some(rule) = find("sync_network_io") {
            Self::walk_queries_in_loops(
                rule,
                ast,
                source,
                file_path,
                matches,
                r"(?i)\b(requests\.(get|post|put|delete|patch|head)|axios\.(get|post|put|delete|patch)|fetch\s*\(|httpclient\.(send|get|post|put|delete)|http\.(get|post|newrequest|client)|urllib\.|webclient\.|curl_?exec\b|execCommand|net::http|urlsession\s*\(|finch\(|hyper::client)\b",
            );
        }
        if let Some(rule) = find("n_plus_one_query") {
            Self::walk_queries_in_loops(
                rule,
                ast,
                source,
                file_path,
                matches,
                r"(?i)\b(\.query\s*\(|\.execute\s*\(|\.raw\s*\(|\.run\s*\(|\.findall\s*\(|\.findone\s*\(|\.findfirst\s*\(|\.findmany\s*\(|->find\s*\(|->findone\s*\(|->first\s*\(|->get\s*\(|\.createquerybuilder\s*\(|\.session\s*\.get\s*\(|\.read\s*\(|\.get_first\s*\()",
            );
        }

        // ── New documentation rule ──
        if let Some(rule) = find("low_comment_density") {
            let min = options
                .thresholds
                .get("min_comment_density")
                .copied()
                .unwrap_or(0.02);
            Self::walk_comment_density(rule, ast, source, file_path, matches, min);
        }
    }

    fn walk_long_lines(
        rule: &Rule,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
        max_len: usize,
        max_reports: usize,
    ) {
        let mut reported = 0usize;
        for (idx, line) in source.lines().enumerate() {
            if line.chars().count() > max_len {
                if reported >= max_reports {
                    break;
                }
                reported += 1;
                Self::push_match(
                    rule,
                    (idx + 1) as u32,
                    1,
                    format!("line too long ({} chars)", line.chars().count()),
                    Some(line.trim_end().to_string()),
                    &format!(
                        "{}: line {} has {} characters (recommended max {})",
                        rule.name,
                        idx + 1,
                        line.chars().count(),
                        max_len
                    ),
                    file_path,
                    matches,
                );
            }
        }
    }

    fn walk_unused_imports(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        fn names_from(text: &str) -> Vec<String> {
            let mut names = Vec::new();
            if text.trim().is_empty() {
                return names;
            }
            if text.trim_start().starts_with("from ") {
                if let Some(idx) = text.find(" import ") {
                    let mut rest = text[idx + 8..].trim();
                    if rest == "*" {
                        return names;
                    }
                    rest = rest.trim().trim_matches(['(', ')']);
                    for part in rest.split(',') {
                        let name = part.rsplit(" as ").next().unwrap_or(part).trim();
                        if !name.is_empty() {
                            names.push(name.to_string());
                        }
                    }
                }
                return names;
            }
            if let Some(open) = text.find('{')
                && let Some(close) = text.rfind('}')
                && open < close
            {
                for part in text[open + 1..close].split(',') {
                    let name = part.rsplit(" as ").next().unwrap_or(part).trim();
                    let name = name.trim_matches('"');
                    if !name.is_empty() && name != "type" {
                        names.push(name.to_string());
                    }
                }
                return names;
            }
            if let Some(from_idx) = text.find(" from ") {
                let mid = text[8..from_idx].trim();
                if let Some(stripped) = mid.strip_prefix("* as ") {
                    if let Some(n) = stripped.split_whitespace().next() {
                        names.push(n.to_string());
                    }
                } else if let Some(n) = mid.split_whitespace().next()
                    && !n.is_empty()
                    && n != "type"
                {
                    names.push(n.to_string());
                }
                return names;
            }
            // Python: `import x, y` / `import pkg.mod as alias`
            for part in text.split(',') {
                let cleaned = part.replace("import", "").trim().to_string();
                let n = cleaned.rsplit(" as ").next().unwrap_or("").trim();
                let n = n.split('.').next().unwrap_or(n).trim();
                if !n.is_empty() {
                    names.push(n.to_string());
                }
            }
            names
        }

        fn words(text: &str, name: &str) -> usize {
            let re = match Regex::new(&format!(r"\b{}\b", regex::escape(name))) {
                Ok(re) => re,
                Err(_) => return 0,
            };
            re.find_iter(text).count()
        }

        Self::visit(ast, &mut |node| {
            let kind = node.kind.as_str();
            let is_import = kind == "import_statement"
                || kind == "import_from_statement"
                || node.node_type == td_common::NodeType::ImportDeclaration;
            if !is_import || node.text.trim().is_empty() {
                return;
            }
            for name in names_from(&node.text) {
                if words(source, &name) == words(&node.text, &name) && words(&node.text, &name) > 0
                {
                    let line = node.range.start.line;
                    Self::push_match(
                        rule,
                        line + 1,
                        node.range.start.column + 1,
                        name.clone(),
                        line_snippet(source, line as usize),
                        &format!("{}: '{}' is imported but never used", rule.name, name),
                        file_path,
                        matches,
                    );
                    if let Some(line_text) = line_snippet(source, line as usize)
                        && line_text.trim() == node.text.trim()
                        && let Some(last) = matches.last_mut()
                    {
                        last.fix = Some(FixInfo {
                            kind: "remove_line".to_string(),
                            description: Some("Delete this unused import statement.".to_string()),
                        });
                    }
                    break;
                }
            }
        });
    }

    fn walk_careless_any(rule: &Rule, source: &str, file_path: &str, matches: &mut Vec<RuleMatch>) {
        for (idx, line) in source.lines().enumerate() {
            if regex_find(line, r"(:\s*any\b|\bas\s+any\b|<any\s*>)") {
                Self::push_match(
                    rule,
                    (idx + 1) as u32,
                    1,
                    "`any` weakens type safety".to_string(),
                    Some(line.trim_end().to_string()),
                    &format!("{}: 'any' bypasses type checking", rule.name),
                    file_path,
                    matches,
                );
            }
        }
    }

    fn matches_path(file_path: &str, pattern: &str) -> bool {
        if pattern.is_empty() {
            return false;
        }
        if pattern.ends_with('/') || pattern.ends_with('\\') {
            file_path.contains(pattern.trim_end_matches(['/', '\\']))
        } else {
            file_path.ends_with(pattern)
        }
    }

    /// Parse inline suppression comments:
    ///   `techdebt:ignore-file`            — ignore the whole file
    ///   `techdebt:ignore` / `:disable`    — ignore all findings on that line
    ///   `techdebt:ignore rule-a, rule-b`  — ignore those rules on that line
    /// Returns (file_ignored, line → ignored-rule-ids-or-empty-for-all).
    fn collect_inline_ignores(source: &str) -> (bool, HashMap<u32, Vec<String>>) {
        let mut file_ignored = false;
        let mut map: HashMap<u32, Vec<String>> = HashMap::new();
        let re =
            Regex::new(r"(?i)techdebt\s*[-: ]\s*(ignore|disable)(-file)?\b([^/\r\n]*)").unwrap();
        for (idx, line) in source.lines().enumerate() {
            for cap in re.captures_iter(line) {
                if cap.get(2).is_some() {
                    file_ignored = true;
                    continue;
                }
                let rest = cap.get(3).map(|m| m.as_str().trim()).unwrap_or("");
                let rules: Vec<String> = rest
                    .split(|c: char| c == ',' || c.is_whitespace())
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string())
                    .collect();
                map.entry(idx as u32 + 1)
                    .and_modify(|list| list.extend(rules.iter().cloned()))
                    .or_insert(rules);
            }
        }
        (file_ignored, map)
    }

    fn walk_comments(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        Self::visit(ast, &mut |node| {
            if node.node_type == td_common::NodeType::Comment {
                let text = node.text.as_str();
                if regex_find(text, r"(?i)\b(todo|fixme|fix me|hack|xxx)\b") {
                    let line = node.range.start.line;
                    Self::push_match(
                        rule,
                        line + 1,
                        node.range.start.column + 1,
                        node.text.clone(),
                        line_snippet(source, line as usize),
                        &format!(
                            "{}: {}",
                            rule.name,
                            text.trim().chars().take(80).collect::<String>()
                        ),
                        file_path,
                        matches,
                    );
                    // Standalone comment line → safe to delete the whole line.
                    if let Some(snip) = line_snippet(source, line as usize)
                        && !snip.trim().is_empty()
                        && snip.trim() == node.text.trim()
                        && let Some(m) = matches.last_mut()
                    {
                        m.fix = Some(FixInfo {
                            kind: "remove_line".to_string(),
                            description: Some("Delete this comment line.".to_string()),
                        });
                    }
                }
            }
        });
    }

    fn walk_secret_assignments(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        const ASSIGNMENT_KINDS: &[&str] = &[
            "assignment_expression",
            "assignment",
            "assignment_statement",
            "short_var_declaration",
            "local_variable_declaration",
            "variable_declarator",
            "declaration",
            "var_declaration",
            "const_declaration",
            "lexical_declaration",
            "pair",
            "keyword_argument",
            "local_declaration_statement",
            "expression_statement",
        ];
        Self::visit(ast, &mut |node| {
            if ASSIGNMENT_KINDS.contains(&node.kind.as_str())
                && regex_find(
                    &node.text,
                    r#"(?i)\b(api[_-]?key|access[_-]?key|secret|token|passwd|password|pwd|client[_-]?secret)\b\s*[:=]\s*["'][^"']{8,}"#,
                )
            {
                let line = node.range.start.line;
                Self::push_match(
                    rule,
                    line + 1,
                    node.range.start.column + 1,
                    node.text.clone(),
                    line_snippet(source, line as usize),
                    &format!("{}: credential literal assigned inline", rule.name),
                    file_path,
                    matches,
                );
            }
        });
    }

    fn walk_sql_strings(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        const SQL_CONTAINER_KINDS: &[&str] = &[
            "binary_expression",
            "assignment_expression",
            "assignment",
            "assignment_statement",
            "augmented_assignment_expression",
            "call_expression",
            "method_invocation",
            "method_call",
            "call",
            "selector_expression",
        ];
        Self::visit(ast, &mut |node| {
            let is_container = SQL_CONTAINER_KINDS.contains(&node.kind.as_str());
            let is_string = node.kind.contains("string")
                || regex_find(&node.kind, r"interpolated|template|heredoc|encapsed");
            if (is_container || is_string)
                && regex_find(
                    &node.text,
                    r"(?i)\b(select|insert|update|delete|drop|alter)\b",
                )
                && (node.text.contains('+')
                    || node.text.contains("${")
                    || node.text.contains("#{")
                    || node.text.contains("%s")
                    || node.text.contains(".format(")
                    || node.text.starts_with("f\"")
                    || node.text.contains(" f\"")
                    || node.text.contains('$')
                    || regex_find(&node.text, r#"\s\.\s*["']|\.\s*\$"#))
            {
                let line = node.range.start.line;
                Self::push_match(
                    rule,
                    line + 1,
                    node.range.start.column + 1,
                    node.text.chars().take(160).collect(),
                    line_snippet(source, line as usize),
                    &format!("{}: SQL built by string interpolation/concat", rule.name),
                    file_path,
                    matches,
                );
            }
        });
    }

    fn walk_evals(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        const CALL_KINDS: &[&str] = &[
            "call_expression",
            "method_invocation",
            "call",
            "method_call",
            "selector_expression",
        ];
        Self::visit(ast, &mut |node| {
            if CALL_KINDS.contains(&node.kind.as_str())
                && regex_find(&node.text, r"(?i)\b(eval|exec|new function)\s*\(")
            {
                let line = node.range.start.line;
                Self::push_match(
                    rule,
                    line + 1,
                    node.range.start.column + 1,
                    node.text.chars().take(80).collect(),
                    line_snippet(source, line as usize),
                    &format!("{}: use of eval/exec-style dynamic code", rule.name),
                    file_path,
                    matches,
                );
            }
        });
    }

    fn walk_debug_logs(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        const CALL_KINDS: &[&str] = &[
            "call_expression",
            "method_invocation",
            "call",
            "method_call",
        ];
        Self::visit(ast, &mut |node| {
            if CALL_KINDS.contains(&node.kind.as_str())
                && regex_find(
                    &node.text,
                    r"(?i)\bconsole\.(log|debug|info|warn|error)\s*\(|\bdebugger\b|\bprintStackTrace\s*\(|\bprint\s*\(|\bprintf\s*\(|\bputs\s|\bp\s*\(|fmt\.(Print|Println|Printf)\s*\(|println!\s*\(|eprintln!\s*\(|var_dump\s*\(|print_r\s*\(|error_log\s*\(|System\.out\.(print|println|printf)\s*\(|console\.(WriteLine|Write)\s*\(",
                )
            {
                let line = node.range.start.line;
                Self::push_match(
                    rule,
                    line + 1,
                    node.range.start.column + 1,
                    node.text.chars().take(80).collect(),
                    line_snippet(source, line as usize),
                    &format!("{}: debug output left behind", rule.name),
                    file_path,
                    matches,
                );
                // Whole statement is the log call → safe to delete the line.
                if let Some(snip) = line_snippet(source, line as usize) {
                    let a = snip.trim().trim_end_matches(';').trim();
                    let b = node.text.trim().trim_end_matches(';').trim();
                    if !a.is_empty()
                        && a == b
                        && let Some(m) = matches.last_mut()
                    {
                        m.fix = Some(FixInfo {
                            kind: "remove_line".to_string(),
                            description: Some("Delete this debug log line.".to_string()),
                        });
                    }
                }
            }
        });
    }

    fn walk_empty_catches(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        Self::visit(ast, &mut |node| {
            if node.kind == "catch_clause" {
                let body = extract_braced_body(&node.text);
                let stripped = strip_comments(&body);
                if stripped.trim().is_empty() {
                    let line = node.range.start.line;
                    Self::push_match(
                        rule,
                        line + 1,
                        node.range.start.column + 1,
                        node.text.chars().take(120).collect(),
                        line_snippet(source, line as usize),
                        &format!("{}: empty catch block swallows errors", rule.name),
                        file_path,
                        matches,
                    );
                }
            }
        });
    }

    fn walk_magic_numbers(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        const NUMBER_KINDS: &[&str] = &[
            "number",
            "integer",
            "float",
            "integer_literal",
            "float_literal",
            "number_literal",
            "decimal_integer_literal",
            "decimal_floating_point_literal",
            "hex_integer_literal",
            "octal_integer_literal",
            "binary_integer_literal",
            "int_literal",
            "uint_literal",
            "imaginary_literal",
            "real_literal",
        ];
        Self::visit_in_context(ast, &mut |node, in_function, in_loop| {
            let _ = in_loop;
            if !in_function || !NUMBER_KINDS.contains(&node.kind.as_str()) {
                return;
            }
            let cleaned: String = node
                .text
                .chars()
                .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
                .collect();
            let value = cleaned.parse::<f64>().ok();
            if let Some(value) = value {
                if value == 0.0 || value == 1.0 || value == 2.0 || value == -1.0 {
                    return;
                }
                let line = node.range.start.line;
                Self::push_match(
                    rule,
                    line + 1,
                    node.range.start.column + 1,
                    node.text.clone(),
                    line_snippet(source, line as usize),
                    &format!("{}: magic number {}", rule.name, value),
                    file_path,
                    matches,
                );
            }
        });
    }

    fn walk_concat_in_loops(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        const CONCAT_KINDS: &[&str] = &[
            "binary_expression",
            "augmented_assignment_expression",
            "assignment_expression",
            "assignment",
            "assignment_statement",
            "call",
            "method_invocation",
            "method_call",
        ];
        Self::visit_in_context(ast, &mut |node, _in_function, in_loop| {
            if in_loop
                && CONCAT_KINDS.contains(&node.kind.as_str())
                && regex_find(&node.text, r#"(\+\s*"|"\s*\+|\+= *")"#)
            {
                let line = node.range.start.line;
                Self::push_match(
                    rule,
                    line + 1,
                    node.range.start.column + 1,
                    node.text.chars().take(80).collect(),
                    line_snippet(source, line as usize),
                    &format!("{}: string built incrementally in a loop", rule.name),
                    file_path,
                    matches,
                );
            }
        });
    }

    fn walk_naming(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
        camel_case: bool,
    ) {
        Self::visit(ast, &mut |node| {
            let is_function = node.node_type == td_common::NodeType::FunctionDeclaration;
            let is_type = matches!(
                node.node_type,
                td_common::NodeType::ClassDeclaration
                    | td_common::NodeType::StructDeclaration
                    | td_common::NodeType::InterfaceDeclaration
                    | td_common::NodeType::TraitDeclaration
                    | td_common::NodeType::EnumDeclaration
                    | td_common::NodeType::TypeAlias
            );

            if camel_case && !is_function {
                return;
            }
            if !camel_case && !is_type {
                return;
            }

            let name = match node.symbols.first() {
                Some(s) => s.name.clone(),
                None => return,
            };
            if name.is_empty() || name.contains([' ', '.', '<', '(', '[', '&', '*']) {
                return;
            }
            // Skip test/private/operator-style names and all-caps constants.
            if name.starts_with('_') || name.chars().all(|c| c.is_uppercase() || c.is_ascii_digit())
            {
                return;
            }

            let violated = if camel_case {
                // snake_case in a camelCase language
                name.contains('_')
            } else {
                // starts with a lowercase letter in a PascalCase language
                name.chars()
                    .next()
                    .map(|c| c.is_lowercase())
                    .unwrap_or(false)
            };

            if violated {
                let line = node.range.start.line;
                let snippet = line_snippet(source, line as usize).filter(|l| !l.trim().is_empty());
                Self::push_match(
                    rule,
                    line + 1,
                    node.range.start.column + 1,
                    name.clone(),
                    snippet,
                    &format!(
                        "{}: '{}' violates the {} convention",
                        rule.name,
                        name,
                        if camel_case {
                            "camelCase"
                        } else {
                            "PascalCase"
                        }
                    ),
                    file_path,
                    matches,
                );
            }
        });
    }

    fn walk_regex_lines(
        rule: &Rule,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
        pattern: &'static str,
    ) {
        for (i, line) in source.lines().enumerate() {
            if regex_find(line, pattern) {
                let ln = (i + 1) as u32;
                Self::push_match(
                    rule,
                    ln,
                    1,
                    line.trim().chars().take(160).collect(),
                    Some(line.to_string()),
                    &rule.name.to_string(),
                    file_path,
                    matches,
                );
            }
        }
    }

    fn walk_command_injection(
        rule: &Rule,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        const CALL_PATTERN: &str = r"(?i)\b(exec|system|shell_exec|passthru|popen|proc_open|pcntl_exec|os\.system|os\.popen|subprocess\.(call|popen|run|check_output|check_call)|child_process\.(exec|execsync|spawn|spawnsync)|processbuilder|exec\.command|command::new|runtime\.getruntime\(\)\.exec)\s*\(";
        for (i, line) in source.lines().enumerate() {
            if !regex_find(line, CALL_PATTERN) {
                continue;
            }
            let open = line.find('(');
            if let Some(o) = open {
                let rest = &line[o + 1..];
                if let Some(c) = rest.find(')') {
                    let arg = rest[..c].trim();
                    if arg.starts_with('"') && arg.ends_with('"') && arg.len() > 1 {
                        continue; // literal arg = not interpolated, skip
                    }
                    if arg.starts_with('\'') && arg.ends_with('\'') && arg.len() > 1 {
                        continue;
                    }
                }
            }
            let ln = (i + 1) as u32;
            Self::push_match(
                rule,
                ln,
                1,
                line.trim().chars().take(140).collect(),
                Some(line.to_string()),
                &format!("{}: shell command built with dynamic input", rule.name),
                file_path,
                matches,
            );
        }
    }

    fn walk_path_traversal(
        rule: &Rule,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        const FILE_CALLS: &str = r"(?i)\b(open|fopen|file|openfile|openfilesync|readfile|readfilesync|createreadstream|unlink|unlinksync|rename|os\.open|os\.create|os\.readfile|std::fs::read|std::fs::file|fread|fwrite|file_put_contents|file_get_contents|pathlib\.|path\.new|files\.read|fs\.readfile|deletefile|copyfile|readfile)\s*\(";
        for (i, line) in source.lines().enumerate() {
            let concat = line.contains('+')
                || line.contains("%s")
                || line.contains("${")
                || line.contains("#{")
                || line.contains(".format(")
                || line.contains("f\"");
            if regex_find(line, FILE_CALLS)
                && (line.contains("../") || line.contains("..\\") || concat)
            {
                let ln = (i + 1) as u32;
                Self::push_match(
                    rule,
                    ln,
                    1,
                    line.trim().chars().take(160).collect(),
                    Some(line.to_string()),
                    &format!("{}: user input used to access a file path", rule.name),
                    file_path,
                    matches,
                );
            }
        }
    }

    fn walk_weak_hash(rule: &Rule, source: &str, file_path: &str, matches: &mut Vec<RuleMatch>) {
        const CRED_CTX: &str =
            r"(?i)\b(password|passw|pwd|secret|token|salt|credential|auth|api[_-]?hash)\b";
        const HASH_PATTERN: &str =
            r"(?i)\b(md5|sha1)\b|hashlib\.(md5|sha1)|messageDigest\.(md5|sha1)|DigestUtils\.md5";
        for (i, line) in source.lines().enumerate() {
            if regex_find(line, HASH_PATTERN) && regex_find(line, CRED_CTX) {
                let ln = (i + 1) as u32;
                Self::push_match(
                    rule,
                    ln,
                    1,
                    line.trim().chars().take(160).collect(),
                    Some(line.to_string()),
                    &format!("{}: md5/sha1 applied to a secret", rule.name),
                    file_path,
                    matches,
                );
            }
        }
    }

    fn walk_insecure_random(
        rule: &Rule,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        const RAND_PATTERN: &str =
            r"(?i)\b(math\.random|rand\b|randn\b|randint\s*\(|random\.|system\.random|Random\s*\()";
        const SEC_CTX: &str = r"(?i)\b(token|secret|otp|password|salt|csrf|nonce|api[_-]?key|apikey|session|auth|pin|verification)\b";
        for (i, line) in source.lines().enumerate() {
            if regex_find(line, RAND_PATTERN) && regex_find(line, SEC_CTX) {
                let ln = (i + 1) as u32;
                Self::push_match(
                    rule,
                    ln,
                    1,
                    line.trim().chars().take(160).collect(),
                    Some(line.to_string()),
                    &format!(
                        "{}: non-cryptographic RNG used for security-sensitive value",
                        rule.name
                    ),
                    file_path,
                    matches,
                );
            }
        }
    }

    fn walk_mutable_global_state(
        rule: &Rule,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
        language: &str,
    ) {
        let pattern: &'static str = match language {
            "typescript" | "javascript" => r"(?m)^\s*(?:var|let)\s+[a-zA-Z_$][\w$]*\s*=[^=]",
            "go" => r"(?m)^var\s+[a-zA-Z_]\w*",
            "php" => r"(?m)^\s*global\s+\$[a-zA-Z_]",
            "python" => r"(?m)^(?!\s)([a-zA-Z_]\w*)\s*=\s*[\[{\(']",
            "ruby" => r"(?m)^\s*\$[a-zA-Z_]\w*\s*=",
            "java" | "csharp" | "cpp" => {
                r"(?m)\bstatic\s+(?!(const|readonly|final)\b)[a-zA-Z_]\w*\s+[a-zA-Z_]\w*\s*=[^=]"
            }
            _ => return,
        };
        Self::walk_regex_lines(rule, source, file_path, matches, pattern);
    }

    fn walk_empty_functions(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
        language: &str,
    ) {
        Self::visit(ast, &mut |node| {
            if node.node_type != td_common::NodeType::FunctionDeclaration {
                return;
            }
            let body = extract_braced_body(&node.text);
            let stripped = strip_comments(&body);
            let py_pass =
                language == "python" && node.text.contains("pass") && !node.text.contains('{');
            let empty_block = node.text.contains('{') && stripped.trim().is_empty();
            if !py_pass && !empty_block {
                return;
            }
            let name = node
                .symbols
                .first()
                .map(|s| s.name.clone())
                .unwrap_or_default();
            let line = node.range.start.line;
            Self::push_match(
                rule,
                line + 1,
                node.range.start.column + 1,
                if name.is_empty() {
                    node.text.chars().take(60).collect()
                } else {
                    name
                },
                line_snippet(source, line as usize),
                &format!("{}: empty/stub function body", rule.name),
                file_path,
                matches,
            );
        });
    }

    fn walk_missing_docs(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        Self::visit(ast, &mut |node| {
            let is_api = matches!(
                node.node_type,
                td_common::NodeType::FunctionDeclaration
                    | td_common::NodeType::ClassDeclaration
                    | td_common::NodeType::InterfaceDeclaration
                    | td_common::NodeType::StructDeclaration
            );
            let is_public = node.symbols.first().map(|s| s.is_public).unwrap_or(false);
            if !is_api || !is_public {
                return;
            }
            let start = node.range.start.line;
            let mut has_doc = false;
            let mut probe = start;
            let mut guard = 0;
            while probe > 0 && guard < 4 {
                probe -= 1;
                guard += 1;
                if let Some(prev) = line_snippet(source, probe as usize) {
                    let t = prev.trim();
                    if t.is_empty() {
                        continue;
                    }
                    has_doc = t.starts_with("//")
                        || t.starts_with("/*")
                        || t.starts_with('*')
                        || t.starts_with('#')
                        || t.starts_with("///")
                        || t.starts_with("//!")
                        || t.starts_with("\"\"\"")
                        || t.starts_with("--");
                    break;
                } else {
                    break;
                }
            }
            if has_doc {
                return;
            }
            let name = node
                .symbols
                .first()
                .map(|s| s.name.clone())
                .unwrap_or_default();
            let line = start;
            Self::push_match(
                rule,
                line + 1,
                node.range.start.column + 1,
                if name.is_empty() {
                    node.text.chars().take(60).collect()
                } else {
                    name
                },
                line_snippet(source, line as usize),
                &format!("{}: public declaration has no doc comment", rule.name),
                file_path,
                matches,
            );
        });
    }

    fn walk_shadowed_builtins(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        const ASSIGN_KINDS: &[&str] = &[
            "assignment_expression",
            "assignment",
            "assignment_statement",
            "short_var_declaration",
            "variable_declarator",
            "lexical_declaration",
            "local_variable_declaration",
            "local_declaration_statement",
            "declaration",
            "var_declaration",
        ];
        const BUILTIN_PATTERN: &str = r"\b(list|dict|set|str|int|float|bool|len|range|print|input|type|open|max|min|sum|sorted|filter|map|zip|enumerate|id|next|iter|exit|Error|Exception|String|Object|module|path|os|sys|color|count|array)\b\s*=[^=]";
        Self::visit_in_context(ast, &mut |node, in_function, _in_loop| {
            if !in_function || !ASSIGN_KINDS.contains(&node.kind.as_str()) {
                return;
            }
            if regex_find(&node.text, BUILTIN_PATTERN) {
                let line = node.range.start.line;
                Self::push_match(
                    rule,
                    line + 1,
                    node.range.start.column + 1,
                    node.text.chars().take(120).collect(),
                    line_snippet(source, line as usize),
                    &format!("{}: assignment shadows a builtin name", rule.name),
                    file_path,
                    matches,
                );
            }
        });
    }

    fn walk_long_functions(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
        max_len: usize,
    ) {
        Self::visit(ast, &mut |node| {
            if node.node_type != td_common::NodeType::FunctionDeclaration {
                return;
            }
            let lines = node.metadata.line_count as usize;
            if lines < max_len {
                return;
            }
            let name = node
                .symbols
                .first()
                .map(|s| s.name.clone())
                .unwrap_or_default();
            let line = node.range.start.line;
            Self::push_match(
                rule,
                line + 1,
                node.range.start.column + 1,
                if name.is_empty() {
                    format!("function spans {} lines", lines)
                } else {
                    format!("{} ({} lines)", name, lines)
                },
                line_snippet(source, line as usize),
                &format!(
                    "{}: function body is {} lines (max {})",
                    rule.name, lines, max_len
                ),
                file_path,
                matches,
            );
        });
    }

    fn walk_nested_ternaries(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        fn has_nested(n: &td_common::ASTNode) -> bool {
            for c in &n.children {
                if c.node_type == td_common::NodeType::ConditionalExpression {
                    return true;
                }
                if has_nested(c) {
                    return true;
                }
            }
            false
        }
        Self::visit(ast, &mut |node| {
            if node.node_type != td_common::NodeType::ConditionalExpression || !has_nested(node) {
                return;
            }
            let line = node.range.start.line;
            Self::push_match(
                rule,
                line + 1,
                node.range.start.column + 1,
                node.text.chars().take(140).collect(),
                line_snippet(source, line as usize),
                &format!("{}: nested ternary expression", rule.name),
                file_path,
                matches,
            );
        });
    }

    fn walk_duplicate_functions(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
        language: &str,
    ) {
        let overloadable = ["java", "csharp", "cpp"];
        if overloadable.contains(&language) {
            return;
        }
        let mut seen: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
        Self::visit(ast, &mut |node| {
            if node.node_type != td_common::NodeType::FunctionDeclaration {
                return;
            }
            let name = match node.symbols.first() {
                Some(s) if !s.name.is_empty() => s.name.clone(),
                _ => return,
            };
            if let Some(prev_line) = seen.get(&name) {
                let line = node.range.start.line;
                Self::push_match(
                    rule,
                    line + 1,
                    node.range.start.column + 1,
                    name.clone(),
                    line_snippet(source, line as usize),
                    &format!(
                        "{}: '{}' redefined; previous at line {}",
                        rule.name, name, prev_line
                    ),
                    file_path,
                    matches,
                );
            } else {
                seen.insert(name, node.range.start.line + 1);
            }
        });
    }

    fn walk_commented_out_code(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        Self::visit(ast, &mut |node| {
            if node.node_type != td_common::NodeType::Comment {
                return;
            }
            let stripped = node
                .text
                .lines()
                .map(|l| {
                    l.trim()
                        .trim_start_matches("//")
                        .trim_start_matches("#")
                        .trim_start_matches("/*")
                        .trim_start_matches('*')
                        .trim_start_matches("*/")
                        .trim()
                        .to_string()
                })
                .collect::<Vec<_>>()
                .join("\n");
            if stripped.trim().is_empty() {
                return;
            }
            let looks_like_code = regex_find(
                &stripped,
                r"(?m)^(return|if|for|while|switch|catch|func|function|def|class|import|from|const|let|var|print|echo|throw|try|new|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WHERE|JOIN)\b",
            ) && (stripped.contains(';')
                || stripped.contains('=')
                || stripped.contains('{')
                || stripped.contains('(')
                || stripped.contains("=>"));
            if !looks_like_code {
                return;
            }
            let line = node.range.start.line;
            Self::push_match(
                rule,
                line + 1,
                node.range.start.column + 1,
                node.text.chars().take(120).collect(),
                line_snippet(source, line as usize),
                &format!("{}: commented-out code block", rule.name),
                file_path,
                matches,
            );
        });
    }

    fn walk_queries_in_loops(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
        pattern: &'static str,
    ) {
        Self::visit_in_context(ast, &mut |node, _in_function, in_loop| {
            if !in_loop {
                return;
            }
            let is_call = node.node_type == td_common::NodeType::FunctionCall
                || node.node_type == td_common::NodeType::MethodCall;
            if is_call && regex_find(&node.text, pattern) {
                let line = node.range.start.line;
                Self::push_match(
                    rule,
                    line + 1,
                    node.range.start.column + 1,
                    node.text.chars().take(120).collect(),
                    line_snippet(source, line as usize),
                    &rule.name.to_string(),
                    file_path,
                    matches,
                );
            }
        });
    }

    fn walk_self_comparisons(
        rule: &Rule,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
    ) {
        const OPS: [&str; 8] = ["===", "!==", "==", "!=", ">=", "<=", ">", "<"];
        for (i, line) in source.lines().enumerate() {
            if line.trim().is_empty() {
                continue;
            }
            let best = OPS
                .iter()
                .filter_map(|op| line.find(op).map(|idx| (*op, idx)))
                .min_by_key(|(_, idx)| *idx);
            let (op, idx) = match best {
                Some(b) => b,
                None => continue,
            };
            let lhs = line[..idx].trim();
            let rhs = line[idx + op.len()..].trim();
            let lhs_id = lhs
                .rsplit(|c: char| !(c.is_alphanumeric() || c == '_'))
                .next()
                .unwrap_or("");
            let rhs_id = rhs
                .split(|c: char| !(c.is_alphanumeric() || c == '_'))
                .next()
                .unwrap_or("");
            if !lhs_id.is_empty() && lhs_id == rhs_id {
                let ln = (i + 1) as u32;
                Self::push_match(
                    rule,
                    ln,
                    1,
                    line.trim().chars().take(140).collect(),
                    Some(line.to_string()),
                    &format!("{}: {} is compared with itself", rule.name, lhs_id),
                    file_path,
                    matches,
                );
            }
        }
    }

    fn walk_comment_density(
        rule: &Rule,
        ast: &td_common::ASTNode,
        source: &str,
        file_path: &str,
        matches: &mut Vec<RuleMatch>,
        min_density: f64,
    ) {
        let total = source.len() as f64;
        let loc = source.lines().count() as f64;
        if total <= 0.0 || loc < 100.0 {
            return;
        }
        let mut comment_chars = 0usize;
        Self::visit(ast, &mut |node| {
            if node.node_type == td_common::NodeType::Comment {
                comment_chars += node.text.len();
            }
        });
        let density = comment_chars as f64 / total;
        if density >= min_density {
            return;
        }
        Self::push_match(
            rule,
            1,
            1,
            format!(
                "comment density {:.2}% (min {:.0}%)",
                density * 100.0,
                min_density * 100.0
            ),
            None,
            &format!("{}: file is largely uncommented", rule.name),
            file_path,
            matches,
        );
    }

    fn visit<'a>(node: &'a td_common::ASTNode, f: &mut impl FnMut(&'a td_common::ASTNode)) {
        f(node);
        for child in &node.children {
            Self::visit(child, f);
        }
    }

    fn visit_in_context(
        node: &td_common::ASTNode,
        f: &mut impl FnMut(&td_common::ASTNode, bool, bool),
    ) {
        let in_function = node.node_type == td_common::NodeType::FunctionDeclaration
            || node.node_type == td_common::NodeType::ClassDeclaration;
        let in_loop = node.node_type == td_common::NodeType::ForLoop
            || node.node_type == td_common::NodeType::WhileLoop;
        Self::visit_in_context_recurse(node, f, in_function, in_loop);
    }

    fn visit_in_context_recurse(
        node: &td_common::ASTNode,
        f: &mut impl FnMut(&td_common::ASTNode, bool, bool),
        in_function: bool,
        in_loop: bool,
    ) {
        f(node, in_function, in_loop);
        for child in &node.children {
            let cf = in_function
                || child.node_type == td_common::NodeType::FunctionDeclaration
                || child.node_type == td_common::NodeType::ClassDeclaration;
            let cl = in_loop
                || child.node_type == td_common::NodeType::ForLoop
                || child.node_type == td_common::NodeType::WhileLoop;
            Self::visit_in_context_recurse(child, f, cf, cl);
        }
    }

    pub fn rule_count(&self) -> usize {
        self.rules.len()
    }

    pub fn rules(&self) -> &[Rule] {
        &self.rules
    }

    pub fn enabled_count(&self) -> usize {
        self.rules.iter().filter(|r| r.enabled).count()
    }
}

impl Default for RuleEngine {
    fn default() -> Self {
        let mut engine = Self::new();
        engine.load_builtin_rules();
        engine
    }
}

// ── Small regex/string helpers ────────────────────────────────────────

static PATTERN_CACHE: OnceLock<Mutex<HashMap<&'static str, Regex>>> = OnceLock::new();

fn regex_find(text: &str, pattern: &'static str) -> bool {
    let cache = PATTERN_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = cache.lock().unwrap();
    let re = guard
        .entry(pattern)
        .or_insert_with_key(|p| Regex::new(p).unwrap_or_else(|_| Regex::new(r"\b\B").unwrap()));
    re.is_match(text)
}

/// Return the text between the first `{` and the last `}` (the block body).
fn extract_braced_body(text: &str) -> String {
    match (text.find('{'), text.rfind('}')) {
        (Some(s), Some(e)) if s < e => text[s + 1..e].to_string(),
        _ => String::new(),
    }
}

/// Remove line comments (`//`, `#`) and block comments (`/* ... */`).
fn strip_comments(body: &str) -> String {
    let mut out = String::new();
    let bytes: Vec<char> = body.chars().collect();
    let mut i = 0usize;
    while i < bytes.len() {
        let c = bytes[i];
        if c == '/' && i + 1 < bytes.len() && bytes[i + 1] == '/' {
            while i < bytes.len() && bytes[i] != '\n' {
                i += 1;
            }
            continue;
        }
        if c == '/' && i + 1 < bytes.len() && bytes[i + 1] == '*' {
            i += 2;
            while i + 1 < bytes.len() && !(bytes[i] == '*' && bytes[i + 1] == '/') {
                i += 1;
            }
            i += 2;
            continue;
        }
        if c == '#' {
            while i < bytes.len() && bytes[i] != '\n' {
                i += 1;
            }
            continue;
        }
        out.push(c);
        i += 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use td_ast::AstParser;
    use td_common::Language;
    use td_metrics::MetricsEngine;

    #[test]
    fn test_builtin_rules_loaded() {
        let engine = RuleEngine::default();
        assert_eq!(engine.rule_count(), 40);
        assert_eq!(engine.enabled_count(), 40);
    }

    #[test]
    fn test_high_complexity_rule_triggers() {
        let source = r#"
fn complex(x: i32) -> &'static str {
    if x > 10 {
        if x > 20 {
            if x > 30 {
                if x > 40 {
                    if x > 50 {
                        if x > 60 {
                            if x > 70 {
                                if x > 80 {
                                    if x > 90 {
                                        if x > 100 {
                                            "huge"
                                        } else { "big" }
                                    } else { "large" }
                                } else { "medium-large" }
                            } else { "medium" }
                        } else { "small-medium" }
                    } else { "small" }
                } else { "smaller" }
            } else { "smallest" }
        } else { "smallest" }
    } else { "under" }
}
"#;
        let ast = AstParser::parse_source(source, Language::Rust, "test.rs").unwrap();
        let metrics = MetricsEngine::analyze(&ast);
        let engine = RuleEngine::default();
        let matches = engine.evaluate(&ast, &metrics, "test.rs", source, "rust");

        assert!(!matches.is_empty(), "Should detect high complexity");
        assert!(matches.iter().any(|m| m.rule_id == "high_complexity"));
        let high = matches
            .iter()
            .find(|m| m.rule_id == "high_complexity")
            .unwrap();
        assert!(
            high.line_number > 1,
            "Complexity match should point at the function, not line 1"
        );

        // Raising the cyclomatic threshold via options must suppress the rule.
        let opts = AnalyzeOptions {
            thresholds: [("cyclomatic_complexity".to_string(), 1000.0)]
                .into_iter()
                .collect(),
            ..AnalyzeOptions::default()
        };
        let suppressed = engine.evaluate_with(&ast, &metrics, "test.rs", source, "rust", &opts);
        assert!(!suppressed.iter().any(|m| m.rule_id == "high_complexity"));
    }

    #[test]
    fn test_source_rules_fire() {
        let source = r#"
function doThing(): void {
    const apiKey = "sk-live-1234567890abcdef";
    console.log("debug me");
    eval("alert(1)");
    // TODO: refactor this mess
    for (let i = 0; i < 10; i++) {
        sql = sql + "SELECT * FROM users WHERE id = ";
    }
    try {
        run();
    } catch (e) {}
}
"#;
        let ast = AstParser::parse_source(source, Language::TypeScript, "test.ts").unwrap();
        let metrics = MetricsEngine::analyze(&ast);
        let engine = RuleEngine::default();
        let matches = engine.evaluate(&ast, &metrics, "test.ts", source, "typescript");

        let ids: Vec<&str> = matches.iter().map(|m| m.rule_id.as_str()).collect();
        assert!(ids.contains(&"hardcoded_secrets"), "got: {:?}", ids);
        assert!(ids.contains(&"debug_logging"), "got: {:?}", ids);
        assert!(ids.contains(&"eval_usage"), "got: {:?}", ids);
        assert!(ids.contains(&"todo_comment"), "got: {:?}", ids);
        assert!(ids.contains(&"sql_injection"), "got: {:?}", ids);
        assert!(ids.contains(&"empty_catch_block"), "got: {:?}", ids);
        assert!(
            matches.iter().all(|m| m.line_number > 1),
            "offenders: {:?}",
            matches
                .iter()
                .filter(|m| m.line_number <= 1)
                .map(|m| (
                    m.rule_id.as_str(),
                    m.line_number,
                    m.message.clone(),
                    m.code_snippet.clone()
                ))
                .collect::<Vec<_>>()
        );

        let secret = matches
            .iter()
            .find(|m| m.rule_id == "hardcoded_secrets")
            .unwrap();
        assert!(secret.code_snippet.is_some());
        assert!(secret.code_snippet.as_deref().unwrap().contains("apiKey"));
    }

    #[test]
    fn test_strip_comments() {
        assert!(
            strip_comments("  // nothing\n  /* block */ # line\n  ")
                .trim()
                .is_empty()
        );
        assert_eq!(strip_comments("  return 1; ").trim(), "return 1;");
    }

    #[test]
    fn test_unused_import_and_careless_any() {
        let source = r#"
import { usedFn } from "aide";
import { orphanThing } from "nowhere";
const config: any = performRisky("x");
export function go() { return usedFn(); }
"#;
        let ast = AstParser::parse_source(source, Language::TypeScript, "test.ts").unwrap();
        let metrics = MetricsEngine::analyze(&ast);
        let engine = RuleEngine::default();
        let matches = engine.evaluate(&ast, &metrics, "test.ts", source, "typescript");

        assert!(
            matches.iter().any(|m| m.rule_id == "unused_import"),
            "unused import firing"
        );
        assert!(
            matches.iter().any(|m| m.rule_id == "careless_any"),
            "careless any firing"
        );
        let unused = matches
            .iter()
            .find(|m| m.rule_id == "unused_import")
            .unwrap();
        assert!(
            unused.line_number == 3,
            "should point at the unused import line"
        );
        assert!(
            unused
                .code_snippet
                .as_deref()
                .unwrap()
                .contains("orphanThing")
        );
        assert_eq!(
            unused.fix.as_ref().map(|f| f.kind.as_str()),
            Some("remove_line"),
            "unused import line is removable"
        );
    }

    #[test]
    fn test_inline_ignores() {
        let source = r#"
// techdebt:ignore-file
export function f() {
  console.log("debug"); // techdebt:ignore debug_logging
  const secret = "sk-live-zzz123456789012";
}
"#;
        let ast = AstParser::parse_source(source, Language::TypeScript, "test.ts").unwrap();
        let metrics = MetricsEngine::analyze(&ast);
        let engine = RuleEngine::default();
        let matches = engine.evaluate(&ast, &metrics, "test.ts", source, "typescript");
        assert!(
            matches.is_empty(),
            "techdebt:ignore-file must suppress all findings: {:?}",
            matches
                .iter()
                .map(|m| m.rule_id.as_str())
                .collect::<Vec<_>>()
        );

        let source2 = r#"
export function f() {
  console.log("debug"); // techdebt:ignore debug_logging
  const secret = "sk-live-zzz123456789012";
}
"#;
        let ast2 = AstParser::parse_source(source2, Language::TypeScript, "t2.ts").unwrap();
        let m2 = engine.evaluate(&ast2, &metrics, "t2.ts", source2, "typescript");
        assert!(
            !m2.iter().any(|m| m.rule_id == "debug_logging"),
            "ignored rule on the line"
        );
        assert!(
            m2.iter().any(|m| m.rule_id == "hardcoded_secrets"),
            "other rules still fire"
        );
    }

    #[test]
    fn test_fix_metadata_attached() {
        let source = r#"
export function f() {
  // TODO: tidy this soon
  const x = compute(); // TODO: also tidy this
  console.log("debug me");
}
"#;
        let ast = AstParser::parse_source(source, Language::TypeScript, "test.ts").unwrap();
        let metrics = MetricsEngine::analyze(&ast);
        let engine = RuleEngine::default();
        let matches = engine.evaluate(&ast, &metrics, "test.ts", source, "typescript");

        // Standalone comment line is 3 (file starts with a blank line).
        let todo = matches
            .iter()
            .find(|m| m.rule_id == "todo_comment" && m.line_number == 3)
            .unwrap();
        assert_eq!(
            todo.fix.as_ref().map(|f| f.kind.as_str()),
            Some("remove_line"),
            "standalone comment removable"
        );
        let inline_todo = matches
            .iter()
            .find(|m| m.rule_id == "todo_comment" && m.line_number == 4);
        if let Some(m) = inline_todo {
            assert!(
                m.fix.is_none(),
                "inline TODO on code line is not removable (got kind {:?}, snippet: {:?})",
                m.fix.as_ref().map(|f| f.kind.clone()),
                m.code_snippet
            );
        }
        let dbg = matches
            .iter()
            .find(|m| m.rule_id == "debug_logging")
            .unwrap();
        assert_eq!(
            dbg.fix.as_ref().map(|f| f.kind.as_str()),
            Some("remove_line"),
            "whole-statement debug log removable"
        );
    }

    #[test]
    fn test_exclude_paths_filter() {
        let source = "\n".repeat(0) + &"x".repeat(200);
        let ast =
            AstParser::parse_source(&source, Language::JavaScript, "vendor/bundle.js").unwrap();
        let metrics = MetricsEngine::analyze(&ast);
        let engine = RuleEngine::default();
        let hits = engine.evaluate(&ast, &metrics, "vendor/bundle.js", &source, "javascript");
        assert!(hits.iter().any(|m| m.rule_id == "long_line"));
        let opts = AnalyzeOptions {
            exclude_paths: vec!["vendor/".to_string()],
            ..AnalyzeOptions::default()
        };
        let filtered = engine.evaluate_with(
            &ast,
            &metrics,
            "vendor/bundle.js",
            &source,
            "javascript",
            &opts,
        );
        assert!(!filtered.iter().any(|m| m.rule_id == "long_line"));
    }

    #[test]
    fn test_ignore_rules_filter() {
        let source = r#"
export function f(id: string) {
  const key = "sk-live-abcdefghijklmnopqrstuvwxyz1234567890";
  console.log("debug me");
  // TODO: fix this
}
"#;
        let ast = AstParser::parse_source(source, Language::TypeScript, "test.ts").unwrap();
        let metrics = MetricsEngine::analyze(&ast);
        let engine = RuleEngine::default();
        let opts = AnalyzeOptions {
            ignore_rules: vec![
                "hardcoded_secrets".to_string(),
                "debug_logging".to_string(),
                "todo_comment".to_string(),
            ],
            ..AnalyzeOptions::default()
        };
        let hits = engine.evaluate_with(&ast, &metrics, "test.ts", source, "typescript", &opts);
        assert!(!hits.iter().any(|m| m.rule_id == "hardcoded_secrets"));
        assert!(!hits.iter().any(|m| m.rule_id == "debug_logging"));
        assert!(!hits.iter().any(|m| m.rule_id == "todo_comment"));
    }
}
