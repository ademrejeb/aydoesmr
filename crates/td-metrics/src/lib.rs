pub mod complexity;
pub mod maintainability;

use std::collections::HashMap;
use td_common::{ASTNode, MetricTarget, MetricsResult, NodeType};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum MetricsError {
    #[error("Calculation error: {0}")]
    CalculationError(String),
}

pub struct MetricsEngine;

impl MetricsEngine {
    pub fn analyze(ast: &ASTNode) -> MetricsResult {
        let mut metrics = HashMap::new();

        // The root node spans the whole file, so its height is the file's line count.
        // (Previously line counts of every node were summed, massively inflating LOC.)
        let loc = ast.metadata.line_count;
        metrics.insert("lines_of_code".to_string(), loc as f64);

        let functions = Self::count_nodes(ast, &NodeType::FunctionDeclaration);
        metrics.insert("function_count".to_string(), functions as f64);

        let classes = Self::count_nodes(ast, &NodeType::ClassDeclaration);
        metrics.insert("class_count".to_string(), classes as f64);

        let cyclomatic = complexity::cyclomatic_complexity(ast);
        metrics.insert("cyclomatic_complexity".to_string(), cyclomatic);

        let cognitive = complexity::cognitive_complexity(ast);
        metrics.insert("cognitive_complexity".to_string(), cognitive);

        let nesting = complexity::max_nesting_depth(ast, 0);
        metrics.insert("max_nesting_depth".to_string(), nesting as f64);

        let maintainability = maintainability::maintainability_index(
            loc as u64,
            cyclomatic as u64,
            ast.metadata.complexity_score as u64,
        );
        metrics.insert("maintainability_index".to_string(), maintainability);

        let targets = Self::collect_targets(ast);

        MetricsResult { metrics, targets }
    }

    fn count_nodes(node: &ASTNode, target: &NodeType) -> u32 {
        let count = if node.node_type == *target { 1 } else { 0 };
        count
            + node
                .children
                .iter()
                .map(|c| Self::count_nodes(c, target))
                .sum::<u32>()
    }

    fn collect_targets(ast: &ASTNode) -> Vec<MetricTarget> {
        let mut targets = Vec::new();
        Self::collect_from_node(ast, &mut targets);
        targets
    }

    fn collect_from_node(node: &ASTNode, targets: &mut Vec<MetricTarget>) {
        if matches!(
            node.node_type,
            NodeType::FunctionDeclaration | NodeType::ClassDeclaration
        ) {
            let target_type = match node.node_type {
                NodeType::FunctionDeclaration => "function".to_string(),
                NodeType::ClassDeclaration => "class".to_string(),
                _ => "unknown".to_string(),
            };

            let name = node
                .symbols
                .first()
                .map(|s| s.name.clone())
                .unwrap_or_else(|| "anonymous".to_string());

            // Per-function/class metric values computed from this node's own subtree,
            // so complexity/deep-nesting/maintainability rules can point at the exact
            // line range of the offending target.
            let per_loc = node.metadata.line_count as f64;
            let per_cc = complexity::cyclomatic_complexity(node);
            let per_cog = complexity::cognitive_complexity(node);
            let per_nesting = complexity::max_nesting_depth(node, 0) as f64;
            let per_mi = maintainability::maintainability_index(
                node.metadata.line_count as u64,
                per_cc as u64,
                node.metadata.complexity_score as u64,
            );

            let line = node.range.start.line;
            let end_line = node.range.end.line;

            // Per-target signature metrics used by parameter/return-count rules.
            // Kept out of the file-level metric map so those rules can only
            // fire against a concrete function/class target, not the whole file.
            let parameter_count = Self::count_nodes(node, &NodeType::Parameter) as f64;
            let return_count = Self::count_nodes(node, &NodeType::ReturnStatement) as f64;

            let entries: &[(&str, f64)] = &[
                ("lines_of_code", per_loc),
                ("cyclomatic_complexity", per_cc),
                ("cognitive_complexity", per_cog),
                ("max_nesting_depth", per_nesting),
                ("maintainability_index", per_mi),
                ("parameter_count", parameter_count),
                ("return_count", return_count),
            ];

            for (metric_type, value) in entries {
                targets.push(MetricTarget {
                    target_type: target_type.clone(),
                    target_id: name.clone(),
                    metric_type: (*metric_type).to_string(),
                    value: *value,
                    category: "local".to_string(),
                    line,
                    end_line,
                });
            }
        }

        for child in &node.children {
            Self::collect_from_node(child, targets);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use td_ast::AstParser;
    use td_common::Language;

    #[test]
    fn test_analyze_typescript() {
        let source = r#"
function complex(x: number): string {
    if (x > 0) {
        if (x > 100) {
            return "big";
        } else if (x > 50) {
            return "medium";
        }
        return "small";
    } else if (x < -100) {
        return "very negative";
    }
    return "negative or zero";
}
"#;
        let ast = AstParser::parse_source(source, Language::TypeScript, "test.ts").unwrap();
        let result = MetricsEngine::analyze(&ast);

        assert!(result.metrics.get("cyclomatic_complexity").unwrap() > &1.0);
        assert!(result.metrics.get("cognitive_complexity").unwrap() > &0.0);
        assert!(result.metrics.get("max_nesting_depth").unwrap() > &0.0);
        assert!(result.metrics.get("lines_of_code").unwrap() > &0.0);
    }
}
