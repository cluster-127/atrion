/**
 * Resistance calculation (Ohm's Law for traffic).
 *
 * R(t) = R_base + P·W + μ||M|| + S + U
 */
use crate::types::{Momentum, Ohms, PhysicsConfig, PressureVector, Scar, SensitivityWeights};
use crate::vector;

/// Calculate instantaneous resistance
///
/// Formula: R = R_base + (P · W) + damping×momentum + scar + staleness
///
/// Where:
/// - R_base: Minimum resistance (config)
/// - P · W: Weighted pressure
/// - damping: Momentum damping factor
/// - S: Accumulated scar tissue
/// - U: Staleness penalty
#[inline]
pub fn calculate_resistance(
    pressure: &PressureVector,
    momentum: Momentum,
    scar: Scar,
    weights: &SensitivityWeights,
    config: &PhysicsConfig,
    staleness: f64,
) -> Ohms {
    let weighted_pressure = vector::dot_product(pressure, weights);
    let momentum_contribution = config.damping_factor * momentum.0;

    let total =
        config.base_resistance + weighted_pressure + momentum_contribution + scar.0 + staleness;

    // Enforce minimum resistance
    Ohms(total.max(config.base_resistance))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base_resistance_enforced() {
        let pressure = PressureVector::new(0.0, 0.0, 0.0);
        let config = PhysicsConfig::default();
        let weights = SensitivityWeights::default();

        let r = calculate_resistance(&pressure, Momentum(0.0), Scar(0.0), &weights, &config, 0.0);

        assert_eq!(r.0, config.base_resistance);
    }

    #[test]
    fn test_pressure_increases_resistance() {
        let pressure = PressureVector::new(0.5, 0.2, 0.3);
        let config = PhysicsConfig::default();
        let weights = SensitivityWeights::default();

        let r = calculate_resistance(&pressure, Momentum(0.0), Scar(0.0), &weights, &config, 0.0);

        assert!(r.0 > config.base_resistance);
    }

    #[test]
    fn test_scar_accumulation() {
        let pressure = PressureVector::new(0.0, 0.0, 0.0);
        let config = PhysicsConfig::default();
        let weights = SensitivityWeights::default();

        let r = calculate_resistance(&pressure, Momentum(0.0), Scar(10.0), &weights, &config, 0.0);

        assert!((r.0 - (config.base_resistance + 10.0)).abs() < 1e-10);
    }
}
