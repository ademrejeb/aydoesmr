use std::path::Path;
use td_common::{ASTNode, Language, NodeMetadata, NodeType, Position, Range, Symbol, SymbolKind};
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum AstError {
    #[error("Unsupported language: {0}")]
    UnsupportedLanguage(String),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub struct AstParser;

impl AstParser {
    fn safe_text<'a>(node: &tree_sitter::Node, source: &'a str) -> &'a str {
        let bytes = source.as_bytes();
        let start = node.start_byte();
        let end = node.end_byte();
        if start <= end && end <= bytes.len() {
            std::str::from_utf8(&bytes[start..end]).unwrap_or("")
        } else {
            ""
        }
    }

    pub fn detect_language(path: &Path) -> Option<Language> {
        path.extension()
            .and_then(|ext| ext.to_str())
            .and_then(Language::from_extension)
    }

    pub fn parse_file(path: &Path) -> Result<ASTNode, AstError> {
        let language = Self::detect_language(path).ok_or_else(|| {
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("none");
            AstError::UnsupportedLanguage(ext.to_string())
        })?;

        let source = std::fs::read_to_string(path)?;
        let source_file = path.to_string_lossy().to_string();

        Self::parse_source(&source, language, &source_file)
    }

    pub fn parse_source(
        source: &str,
        language: Language,
        source_file: &str,
    ) -> Result<ASTNode, AstError> {
        let ts_language = match language {
            Language::TypeScript | Language::JavaScript => {
                let is_tsx = source_file.ends_with(".tsx") || source_file.ends_with(".jsx");
                if is_tsx {
                    tree_sitter_typescript::LANGUAGE_TSX
                } else {
                    tree_sitter_typescript::LANGUAGE_TYPESCRIPT
                }
            }
            Language::Python => tree_sitter_python::LANGUAGE,
            Language::Rust => tree_sitter_rust::LANGUAGE,
            Language::Go => tree_sitter_go::LANGUAGE,
            Language::Java => tree_sitter_java::LANGUAGE,
            Language::C => tree_sitter_c::LANGUAGE,
            Language::Cpp => tree_sitter_cpp::LANGUAGE,
            Language::Ruby => tree_sitter_ruby::LANGUAGE,
            Language::CSharp => tree_sitter_c_sharp::LANGUAGE,
            Language::PHP => {
                if source.contains("<?php") {
                    tree_sitter_php::LANGUAGE_PHP
                } else {
                    tree_sitter_php::LANGUAGE_PHP_ONLY
                }
            }
            _ => {
                return Err(AstError::UnsupportedLanguage(
                    language.tree_sitter_name().to_string(),
                ));
            }
        };

        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&ts_language.into())
            .map_err(|e| AstError::ParseError(e.to_string()))?;

        let tree = parser
            .parse(source, None)
            .ok_or_else(|| AstError::ParseError("Failed to parse source".to_string()))?;

        let root = tree.root_node();
        let node = Self::convert_node(root, source, source_file, &[]);

        Ok(node)
    }

    fn convert_node(
        node: tree_sitter::Node,
        source: &str,
        source_file: &str,
        module_path: &[String],
    ) -> ASTNode {
        let start = Position {
            line: node.start_position().row as u32,
            column: node.start_position().column as u32,
        };
        let end = Position {
            line: node.end_position().row as u32,
            column: node.end_position().column as u32,
        };
        let range = Range { start, end };

        let bytes = source.as_bytes();
        let start_byte = node.start_byte();
        let end_byte = node.end_byte();
        let text = if start_byte < bytes.len() && end_byte <= bytes.len() {
            std::str::from_utf8(&bytes[start_byte..end_byte]).unwrap_or("")
        } else {
            ""
        };

        let line_count = (end.line).saturating_sub(start.line) + 1;
        let character_count = text.len() as u32;
        let token_count = text.split_whitespace().count();
        let hash = format!("{:x}", md5_simple(text));
        let kind = node.kind().to_string();

        let node_type = Self::map_node_type(node.kind());
        let symbols = Self::extract_symbols(&node, source, source_file);
        let complexity_score = Self::estimate_complexity(&node);

        let metadata = NodeMetadata {
            line_count,
            character_count,
            hash,
            complexity_score,
            token_count,
            source_file: source_file.to_string(),
            module_path: module_path.to_vec(),
        };

        let children: Vec<ASTNode> = (0..node.child_count())
            .filter_map(|i| node.child(i))
            .map(|child| Self::convert_node(child, source, source_file, module_path))
            .collect();

        ASTNode {
            id: Uuid::new_v4().to_string(),
            node_type,
            kind,
            text: text.to_string(),
            range,
            children,
            parent_id: None,
            metadata,
            symbols,
            annotations: Vec::new(),
        }
    }

    fn map_node_type(kind: &str) -> NodeType {
        // Node kinds shared across the supported grammars
        match kind {
            "program"
            | "module"
            | "source_file"
            | "translation_unit"
            | "compilation_unit"
            | "namespace_definition"
            | "namespace_declaration" => NodeType::Program,

            // ── Functions ──
            "function_declaration"
            | "function_item"
            | "function_definition"
            | "method_declaration"
            | "constructor_declaration"
            | "method"
            | "singleton_method"
            | "local_function_statement"
            | "destructor_declaration"
            | "function_signature_item" => NodeType::FunctionDeclaration,

            // ── Classes / structs / types ──
            "class_declaration" | "class_definition" | "class" | "record_declaration"
            | "class_specifier" => NodeType::ClassDeclaration,
            "struct_item" | "struct_declaration" | "struct_specifier" | "struct_type"
            | "union_specifier" => NodeType::StructDeclaration,
            "enum_item" | "enum_declaration" | "enum_specifier" => NodeType::EnumDeclaration,
            "trait_item" | "trait_declaration" => NodeType::TraitDeclaration,
            "impl_item" | "impl_declaration" => NodeType::ImplDeclaration,
            "interface_declaration" | "interface_type" => NodeType::InterfaceDeclaration,
            "type_alias_declaration"
            | "type_item"
            | "type_declaration"
            | "type_definition"
            | "using_statement" => NodeType::TypeAlias,

            // ── Variables / imports ──
            "lexical_declaration"
            | "variable_declaration"
            | "let_declaration"
            | "const_declaration"
            | "pub_variadic_declaration"
            | "local_variable_declaration"
            | "declaration"
            | "var_declaration"
            | "short_var_declaration"
            | "local_declaration_statement" => NodeType::VariableDeclaration,
            "import_declaration" | "import_statement" | "preproc_include" | "using_directive" => {
                NodeType::ImportDeclaration
            }
            "export_statement" => NodeType::ExportDeclaration,
            "expression_statement" | "echo_statement" => NodeType::Statement,

            // ── Expressions ──
            "call_expression"
            | "function_call"
            | "object_creation_expression"
            | "call"
            | "invocation_expression"
            | "function_call_expression"
            | "scoped_call_expression"
            | "new_expression" => NodeType::FunctionCall,
            "member_expression"
            | "method_call_expression"
            | "method_invocation"
            | "selector_expression"
            | "method_call"
            | "member_access_expression"
            | "field_expression"
            | "attribute" => NodeType::MethodCall,
            "binary_expression" | "binary_operator" => NodeType::BinaryExpression,
            "unary_expression" | "update_expression" => NodeType::UnaryExpression,
            "assignment_expression" | "assignment_statement" | "assignment" => {
                NodeType::AssignmentExpression
            }
            "conditional_expression" | "ternary_expression" | "ternary" => {
                NodeType::ConditionalExpression
            }
            "arrow_function"
            | "lambda"
            | "closure_expression"
            | "lambda_expression"
            | "anonymous_function_expression" => NodeType::LambdaExpression,
            "await_expression" => NodeType::AwaitExpression,

            // ── Control flow ──
            "if_statement" | "if_expression" | "if" | "unless" | "elsif" | "elseif_clause" => {
                NodeType::IfStatement
            }
            "else_clause" => NodeType::ElseClause,
            "for_statement"
            | "for_in_statement"
            | "for_loop"
            | "for"
            | "enhanced_for_statement"
            | "foreach_statement"
            | "for_range_loop" => NodeType::ForLoop,
            "while_statement" | "while_expression" | "while" | "until" | "do_statement" => {
                NodeType::WhileLoop
            }
            "match_expression"
            | "switch_statement"
            | "switch_expression"
            | "expression_switch_statement"
            | "type_switch_statement"
            | "select_statement"
            | "case"
            | "case_statement"
            | "default_statement" => NodeType::MatchExpression,
            "try_statement" | "try_expression" | "begin" | "rescue" | "finally_clause" => {
                NodeType::TryCatch
            }
            "return_statement" | "return_expression" | "return" => NodeType::ReturnStatement,
            "break_statement" | "break_expression" => NodeType::BreakStatement,
            "continue_statement" | "continue_expression" => NodeType::ContinueStatement,

            "type_annotation" | "type_identifier" | "predefined_type" | "primitive_type" => {
                NodeType::TypeAnnotation
            }
            "generic_type" | "generic_name" => NodeType::GenericType,

            "block" | "compound_statement" | "block_body" => NodeType::Block,
            "formal_parameters"
            | "parameter"
            | "parameter_declaration"
            | "formal_parameter"
            | "simple_parameter"
            | "property_promotion_parameter" => NodeType::Parameter,
            "argument_list" | "arguments" | "argument" => NodeType::Argument,
            "field_declaration"
            | "field_identifier"
            | "field_declaration_list"
            | "property_identifier"
            | "property_declaration" => NodeType::Field,
            "comment" | "line_comment" | "block_comment" | "comment_block" => NodeType::Comment,

            _ => NodeType::Unknown(kind.to_string()),
        }
    }

    fn extract_symbols(node: &tree_sitter::Node, source: &str, _source_file: &str) -> Vec<Symbol> {
        let mut symbols = Vec::new();

        match node.kind() {
            // ── Functions ──
            "function_declaration"
            | "function_item"
            | "function_definition"
            | "method_declaration"
            | "constructor_declaration"
            | "method"
            | "singleton_method"
            | "local_function_statement"
            | "destructor_declaration" => {
                let name = Self::symbol_name(node, source);
                if let Some(name) = name {
                    if name.is_empty() {
                        return symbols;
                    }
                    let is_pub = Self::has_public_modifier(node, source);
                    symbols.push(Symbol {
                        name,
                        kind: SymbolKind::Function,
                        range: Range {
                            start: Position {
                                line: node.start_position().row as u32,
                                column: node.start_position().column as u32,
                            },
                            end: Position {
                                line: node.end_position().row as u32,
                                column: node.end_position().column as u32,
                            },
                        },
                        is_public: is_pub,
                    });
                }
            }
            // ── Classes / structs / types ──
            "class_declaration"
            | "class_definition"
            | "class"
            | "record_declaration"
            | "struct_item"
            | "struct_declaration"
            | "struct_specifier"
            | "struct_type"
            | "union_specifier"
            | "interface_declaration"
            | "interface_type"
            | "class_specifier" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = Self::safe_text(&name_node, source).to_string();
                    let is_pub = Self::has_public_modifier(node, source);
                    let kind = match node.kind() {
                        "struct_item" | "struct_specifier" | "struct_type" | "union_specifier" => {
                            SymbolKind::Struct
                        }
                        "interface_declaration" | "interface_type" => SymbolKind::Interface,
                        _ => SymbolKind::Class,
                    };
                    symbols.push(Symbol {
                        name,
                        kind,
                        range: Range {
                            start: Position {
                                line: node.start_position().row as u32,
                                column: node.start_position().column as u32,
                            },
                            end: Position {
                                line: node.end_position().row as u32,
                                column: node.end_position().column as u32,
                            },
                        },
                        is_public: is_pub,
                    });
                }
            }
            _ => {}
        }

        symbols
    }

    /// Extract the name of a function/class node across grammars.
    /// C function names live inside a nested `function_declarator`, so we
    /// dig down through the declarator tree to the first identifier.
    fn symbol_name(node: &tree_sitter::Node, source: &str) -> Option<String> {
        if let Some(name_node) = node.child_by_field_name("name") {
            return Some(Self::safe_text(&name_node, source).to_string());
        }

        if let Some(declarator) = node.child_by_field_name("declarator") {
            return Self::first_identifier(&declarator, source);
        }

        None
    }

    fn first_identifier(node: &tree_sitter::Node, source: &str) -> Option<String> {
        if node.kind() == "identifier" {
            return Some(Self::safe_text(node, source).to_string());
        }
        for i in 0..node.child_count() {
            if let Some(child) = node.child(i)
                && let Some(name) = Self::first_identifier(&child, source)
            {
                return Some(name);
            }
        }
        None
    }

    fn has_public_modifier(node: &tree_sitter::Node, source: &str) -> bool {
        // Java/C# put modifiers on the declaration node itself; Rust/JS use the parent.
        for scope in [Some(*node), node.parent()].into_iter().flatten() {
            for i in 0..scope.child_count() {
                if let Some(child) = scope.child(i) {
                    if child.kind() == "visibility_modifier"
                        || child.kind() == "pub"
                        || child.kind() == "modifier"
                    {
                        let text = Self::safe_text(&child, source);
                        if text.contains("public") || text == "pub" {
                            return true;
                        }
                    }
                    let text = Self::safe_text(&child, source);
                    if text == "pub" || text == "export" || text == "public" {
                        return true;
                    }
                }
            }
        }
        false
    }

    fn estimate_complexity(node: &tree_sitter::Node) -> f64 {
        let mut complexity = 1.0;
        Self::walk_complexity(node, &mut complexity);
        complexity
    }

    fn walk_complexity(node: &tree_sitter::Node, complexity: &mut f64) {
        match node.kind() {
            "if_statement"
            | "if_expression"
            | "if"
            | "unless"
            | "elsif"
            | "else_clause"
            | "for_statement"
            | "for_in_statement"
            | "for"
            | "while_statement"
            | "while_expression"
            | "while"
            | "until"
            | "match_expression"
            | "switch_statement"
            | "switch_expression"
            | "expression_switch_statement"
            | "case"
            | "conditional_expression"
            | "ternary_expression"
            | "try_statement"
            | "try_expression"
            | "catch_clause"
            | "rescue" => {
                *complexity += 1.0;
            }
            _ => {}
        }

        for i in 0..node.child_count() {
            if let Some(child) = node.child(i) {
                Self::walk_complexity(&child, complexity);
            }
        }
    }
}

fn md5_simple(input: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in input.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_language() {
        assert_eq!(
            AstParser::detect_language(Path::new("main.ts")),
            Some(Language::TypeScript)
        );
        assert_eq!(
            AstParser::detect_language(Path::new("app.py")),
            Some(Language::Python)
        );
        assert_eq!(
            AstParser::detect_language(Path::new("lib.rs")),
            Some(Language::Rust)
        );
        assert_eq!(AstParser::detect_language(Path::new("readme.md")), None);
    }

    #[test]
    fn test_parse_typescript() {
        let source = r#"
function greet(name: string): string {
    if (name.length > 0) {
        return `Hello, ${name}!`;
    }
    return "Hello, World!";
}
"#;
        let result = AstParser::parse_source(source, Language::TypeScript, "test.ts");
        assert!(result.is_ok());

        let ast = result.unwrap();
        assert_eq!(ast.node_type, NodeType::Program);
        assert!(!ast.children.is_empty());
        assert!(ast.metadata.complexity_score >= 1.0);
    }

    #[test]
    fn test_parse_python() {
        let source = r#"
def greet(name: str) -> str:
    if len(name) > 0:
        return f"Hello, {name}!"
    return "Hello, World!"
"#;
        let result = AstParser::parse_source(source, Language::Python, "test.py");
        assert!(result.is_ok());

        let ast = result.unwrap();
        assert_eq!(ast.node_type, NodeType::Program);
        assert!(!ast.children.is_empty());
        assert!(ast.metadata.complexity_score >= 1.0);
    }

    #[test]
    fn test_parse_rust() {
        let source = r#"
fn greet(name: &str) -> String {
    if !name.is_empty() {
        format!("Hello, {}!", name)
    } else {
        "Hello, World!".to_string()
    }
}
"#;
        let result = AstParser::parse_source(source, Language::Rust, "test.rs");
        assert!(result.is_ok());

        let ast = result.unwrap();
        assert_eq!(ast.node_type, NodeType::Program);
        assert!(!ast.children.is_empty());
        assert!(ast.metadata.complexity_score >= 1.0);
    }

    #[test]
    fn test_complex_typescript() {
        let source = r#"
class UserService {
    private users: Map<string, User> = new Map();

    async findById(id: string): Promise<User | null> {
        for (const [key, user] of this.users) {
            if (key === id && user.active) {
                return user;
            }
        }
        return null;
    }
}
"#;
        let result = AstParser::parse_source(source, Language::TypeScript, "service.ts");
        assert!(result.is_ok());

        let ast = result.unwrap();
        assert!(!ast.children.is_empty());
        assert!(ast.metadata.complexity_score > 1.0);
    }

    #[test]
    fn test_parse_tsx() {
        let source = r#"
export function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return <div className="card"><h2>{title}</h2>{children}</div>;
}
"#;
        let result = AstParser::parse_source(source, Language::TypeScript, "Card.tsx");
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.node_type, NodeType::Program);
        assert!(!ast.children.is_empty());
    }

    #[test]
    fn test_parse_java() {
        let source = r#"
public class UserService {
    private List<String> users = new ArrayList<>();

    public String findById(int id) {
        for (String user : users) {
            if (user.length() == id) {
                return user;
            }
        }
        return null;
    }
}
"#;
        let result = AstParser::parse_source(source, Language::Java, "UserService.java");
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.node_type, NodeType::Program);
        assert!(!ast.children.is_empty());
        let has_class = find_node(&ast, &NodeType::ClassDeclaration);
        assert!(has_class, "Expected a class declaration");
        let has_fn = find_node(&ast, &NodeType::FunctionDeclaration);
        assert!(has_fn, "Expected a method declaration");
    }

    #[test]
    fn test_parse_c() {
        let source = r#"
#include <stdio.h>

int max(int a, int b) {
    if (a > b) {
        return a;
    }
    return b;
}
"#;
        let result = AstParser::parse_source(source, Language::C, "max.c");
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.node_type, NodeType::Program);
        assert!(find_node(&ast, &NodeType::FunctionDeclaration));
        assert!(find_node(&ast, &NodeType::IfStatement));
    }

    #[test]
    fn test_parse_go() {
        let source = r#"
package main

func max(a, b int) int {
    if a > b {
        return a
    }
    return b
}
"#;
        let result = AstParser::parse_source(source, Language::Go, "max.go");
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.node_type, NodeType::Program);
        assert!(find_node(&ast, &NodeType::FunctionDeclaration));
    }

    #[test]
    fn test_parse_ruby() {
        let source = r#"
class Greeter
  def greet(name)
    if name.length > 0
      "Hello, #{name}!"
    else
      "Hello, World!"
    end
  end
end
"#;
        let result = AstParser::parse_source(source, Language::Ruby, "greeter.rb");
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.node_type, NodeType::Program);
        assert!(find_node(&ast, &NodeType::ClassDeclaration));
        assert!(find_node(&ast, &NodeType::FunctionDeclaration));
    }

    #[test]
    fn test_parse_cpp() {
        let source = r#"
#include <string>
class Greeter {
public:
    std::string greet(const std::string& name) {
        if (!name.empty()) {
            return "Hello, " + name;
        }
        return "Hello, World!";
    }
};
"#;
        let result = AstParser::parse_source(source, Language::Cpp, "greeter.cpp");
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.node_type, NodeType::Program);
        assert!(
            find_node(&ast, &NodeType::ClassDeclaration),
            "expected class_specifier mapping"
        );
        assert!(
            find_node(&ast, &NodeType::FunctionDeclaration),
            "expected function_definition mapping"
        );
        assert!(
            find_node(&ast, &NodeType::IfStatement),
            "expected if_statement mapping"
        );
    }

    #[test]
    fn test_parse_csharp() {
        let source = r#"
namespace App {
    public class Greeter {
        public string Greet(string name) {
            if (name.Length > 0) {
                return "Hello, " + name;
            }
            return "Hello, World!";
        }
    }
}
"#;
        let result = AstParser::parse_source(source, Language::CSharp, "greeter.cs");
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.node_type, NodeType::Program);
        assert!(
            find_node(&ast, &NodeType::ClassDeclaration),
            "expected class_declaration mapping"
        );
        assert!(
            find_node(&ast, &NodeType::FunctionDeclaration),
            "expected method_declaration mapping"
        );
        assert!(
            find_node(&ast, &NodeType::IfStatement),
            "expected if_statement mapping"
        );
    }

    #[test]
    fn test_parse_php() {
        let source = r#"<?php
class Greeter {
    public function greet(string $name): string {
        if (strlen($name) > 0) {
            return "Hello, " . $name;
        }
        return "Hello, World!";
    }
}
echo (new Greeter())->greet("World");
"#;
        let result = AstParser::parse_source(source, Language::PHP, "greeter.php");
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.node_type, NodeType::Program);
        assert!(
            find_node(&ast, &NodeType::ClassDeclaration),
            "expected class_declaration mapping"
        );
        assert!(
            find_node(&ast, &NodeType::FunctionDeclaration),
            "expected method_declaration mapping"
        );
        assert!(
            find_node(&ast, &NodeType::IfStatement),
            "expected if_statement mapping"
        );
    }

    fn find_node(node: &ASTNode, target: &NodeType) -> bool {
        if &node.node_type == target {
            return true;
        }
        node.children.iter().any(|c| find_node(c, target))
    }
}
