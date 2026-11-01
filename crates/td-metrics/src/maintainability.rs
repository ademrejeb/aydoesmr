/// Maintainability Index
/// MI = 171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)
/// where HV = Halstead Volume (simplified to avg complexity), CC = Cyclomatic, LOC = Lines of Code
/// Result is 0-100, higher is more maintainable
pub fn maintainability_index(loc: u64, cyclomatic: u64, halstead_volume: u64) -> f64 {
    if loc == 0 {
        return 100.0;
    }

    let loc_f = loc as f64;
    let cc_f = cyclomatic as f64;
    let hv_f = halstead_volume as f64;

    let mi = 171.0 - 5.2 * hv_f.ln() - 0.23 * cc_f - 16.2 * loc_f.ln();

    mi.clamp(0.0, 100.0)
}

/// Tech Debt Ratio
/// TDR = (Remediation Cost / Development Cost) * 100
/// Simplified: based on complexity relative to a threshold
pub fn tech_debt_ratio(actual_complexity: f64, threshold: f64) -> f64 {
    if threshold == 0.0 {
        return 0.0;
    }
    ((actual_complexity - threshold) / threshold * 100.0).max(0.0)
}

/// Instability metric (Robert C. Martin)
/// I = Ce / (Ce + Ca)
/// Ce = efferent coupling, Ca = afferent coupling
pub fn instability(efferent: u32, afferent: u32) -> f64 {
    let total = efferent + afferent;
    if total == 0 {
        return 0.0;
    }
    efferent as f64 / total as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_maintainability_high() {
        let mi = maintainability_index(50, 3, 100);
        assert!(
            mi > 70.0,
            "Small function should be highly maintainable: {}",
            mi
        );
    }

    #[test]
    fn test_maintainability_low() {
        let mi = maintainability_index(500, 50, 10000);
        assert!(
            mi < 50.0,
            "Large complex function should be less maintainable: {}",
            mi
        );
    }

    #[test]
    fn test_maintainability_zero_loc() {
        assert_eq!(maintainability_index(0, 0, 0), 100.0);
    }

    #[test]
    fn test_tech_debt_ratio() {
        assert_eq!(tech_debt_ratio(5.0, 10.0), 0.0);
        assert!(tech_debt_ratio(20.0, 10.0) > 0.0);
    }

    #[test]
    fn test_instability() {
        assert_eq!(instability(0, 10), 0.0);
        assert_eq!(instability(10, 0), 1.0);
        assert!((instability(5, 5) - 0.5).abs() < 0.01);
    }
}
