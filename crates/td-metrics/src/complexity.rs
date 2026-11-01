use td_common::{ASTNode, NodeType};

/// Cyclomatic complexity: count of decision points + 1
/// M = E - N + 2P (edges - nodes + 2*connected components)
/// Simplified: walk the AST and count branching nodes
pub fn cyclomatic_complexity(node: &ASTNode) -> f64 {
    let mut complexity = 1.0;
    walk_cyclomatic(node, &mut complexity);
    complexity
}

fn walk_cyclomatic(node: &ASTNode, complexity: &mut f64) {
    match &node.node_type {
        NodeType::IfStatement
        | NodeType::ForLoop
        | NodeType::WhileLoop
        | NodeType::MatchExpression
        | NodeType::TryCatch => {
            *complexity += 1.0;
        }
        NodeType::BinaryExpression => {
            // Logical operators add branches
            *complexity += 0.0;
        }
        _ => {}
    }

    for child in &node.children {
        walk_cyclomatic(child, complexity);
    }
}

/// Cognitive complexity: penalizes nesting and control flow breaks
pub fn cognitive_complexity(node: &ASTNode) -> f64 {
    let mut complexity = 0.0;
    walk_cognitive(node, &mut complexity, 0);
    complexity
}

fn walk_cognitive(node: &ASTNode, complexity: &mut f64, nesting: u32) {
    let increments = match &node.node_type {
        NodeType::IfStatement => Some(1.0 + nesting as f64),
        NodeType::ForLoop | NodeType::WhileLoop => Some(1.0 + nesting as f64),
        NodeType::MatchExpression => Some(1.0 + nesting as f64),
        NodeType::TryCatch => Some(1.0 + nesting as f64),
        NodeType::ElseClause => Some(1.0),
        _ => None,
    };

    if let Some(inc) = increments {
        *complexity += inc;
    }

    let child_nesting = match &node.node_type {
        NodeType::IfStatement
        | NodeType::ForLoop
        | NodeType::WhileLoop
        | NodeType::MatchExpression
        | NodeType::TryCatch => nesting + 1,
        _ => nesting,
    };

    for child in &node.children {
        walk_cognitive(child, complexity, child_nesting);
    }
}

/// Maximum nesting depth from a given root
pub fn max_nesting_depth(node: &ASTNode, current_depth: u32) -> u32 {
    let is_nesting = matches!(
        node.node_type,
        NodeType::IfStatement
            | NodeType::ForLoop
            | NodeType::WhileLoop
            | NodeType::MatchExpression
            | NodeType::TryCatch
            | NodeType::Block
    );

    let depth = if is_nesting {
        current_depth + 1
    } else {
        current_depth
    };

    node.children
        .iter()
        .map(|c| max_nesting_depth(c, depth))
        .max()
        .unwrap_or(depth)
}

#[cfg(test)]
mod tests {
    use super::*;
    use td_ast::AstParser;
    use td_common::Language;

    #[test]
    fn test_simple_function_complexity() {
        let source = "fn main() { println!(\"hello\"); }";
        let ast = AstParser::parse_source(source, Language::Rust, "test.rs").unwrap();
        assert_eq!(cyclomatic_complexity(&ast), 1.0);
    }

    #[test]
    fn test_if_branches() {
        let source = r#"
fn decide(x: i32) -> &'static str {
    if x > 0 {
        "positive"
    } else if x < 0 {
        "negative"
    } else {
        "zero"
    }
}
"#;
        let ast = AstParser::parse_source(source, Language::Rust, "test.rs").unwrap();
        let cc = cyclomatic_complexity(&ast);
        assert!(cc >= 3.0, "Expected >= 3.0, got {}", cc);
    }

    #[test]
    fn test_cognitive_nesting() {
        let source = r#"
fn nested(x: i32) {
    if x > 0 {
        for i in 0..x {
            if i % 2 == 0 {
                println!("{}", i);
            }
        }
    }
}
"#;
        let ast = AstParser::parse_source(source, Language::Rust, "test.rs").unwrap();
        let cog = cognitive_complexity(&ast);
        assert!(cog >= 3.0, "Expected cognitive >= 3.0, got {}", cog);
    }

    #[test]
    fn test_max_nesting() {
        let source = r#"
fn nested(x: i32) {
    if x > 0 {
        for i in 0..x {
            while i > 0 {
                println!("{}", i);
            }
        }
    }
}
"#;
        let ast = AstParser::parse_source(source, Language::Rust, "test.rs").unwrap();
        let depth = max_nesting_depth(&ast, 0);
        assert!(depth >= 3, "Expected nesting >= 3, got {}", depth);
    }
}
