/**
 * Scar tissue accumulation (trauma memory).
 *
 * "Silence is not trauma" - only positive pressure accumulates scar.
 */
use crate::types::{PhysicsConfig, PressureVector, Scar, SensitivityWeights};
use crate::vector;

/// Update scar tissue based on current pressure
///
/// Rule: Only positive pressure creates trauma
/// - Negative pressure (system healthy) does NOT reduce scar
/// - Scar decays naturally over time (handled elsewhere)
#[inline]
pub fn update_scar(
    current_scar: Scar,
    pressure: &PressureVector,
    _weights: &SensitivityWeights, // Reserved for future weighting
    config: &PhysicsConfig,
) -> Scar {
    let pressure_magnitude = vector::magnitude(pressure);

    // "Silence is not trauma"
    if pressure_magnitude <= 0.0 {
        return current_scar;
    }

    // Trauma proportional to pressure magnitude
    let trauma = pressure_magnitude * config.scar_factor;
    Scar(current_scar.0 + trauma)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zero_pressure_no_scar() {
        let pressure = PressureVector::new(0.0, 0.0, 0.0);
        let config = PhysicsConfig::default();
        let weights = SensitivityWeights::default();

        let scar = update_scar(Scar(5.0), &pressure, &weights, &config);
        assert_eq!(scar.0, 5.0); // Unchanged
    }

    #[test]
    fn test_positive_pressure_adds_scar() {
        let pressure = PressureVector::new(0.5, 0.2, 0.3);
        let config = PhysicsConfig::default();
        let weights = SensitivityWeights::default();

        let scar = update_scar(Scar(0.0), &pressure, &weights, &config);
        assert!(scar.0 > 0.0);
    }

    #[test]
    fn test_scar_accumulation() {
        let pressure = PressureVector::new(0.5, 0.2, 0.3);
        let config = PhysicsConfig::default();
        let weights = SensitivityWeights::default();

        let scar1 = update_scar(Scar(10.0), &pressure, &weights, &config);
        assert!(scar1.0 > 10.0);
    }
}
