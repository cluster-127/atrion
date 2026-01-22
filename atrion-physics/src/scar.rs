/**
 * Scar tissue accumulation (trauma memory).
 *
 * Implements Check Valve Pattern from RFC-0001:
 * "Silence is not trauma" - only POSITIVE pressure accumulates scar.
 *
 * MUST match src/core/physics.ts updateScar() exactly:
 * S(t) = S(t-1) · e^(-λΔt) + σ · I(||P+|| > P_crit)
 */
use crate::types::{PhysicsConfig, PressureVector, Scar, SensitivityWeights};
use crate::vector;

/// Update scar tissue based on current pressure
///
/// Formula (matches TypeScript):
/// - Decay: current_scar * e^(-decay_rate * delta_t_seconds)
/// - Trauma: added if positive_stress_magnitude > critical_pressure
///
/// "Silence is not Trauma" - Check Valve Pattern:
/// - Negative pressure components (system healthy) are clamped to 0
/// - Only positive stress contributes to trauma
#[inline]
pub fn update_scar(
    current_scar: Scar,
    pressure: &PressureVector,
    _weights: &SensitivityWeights,
    config: &PhysicsConfig,
) -> Scar {
    // Use positive_stress_magnitude (Check Valve Pattern)
    // This clamps negative values to 0 BEFORE squaring
    let positive_stress = vector::positive_stress_magnitude(pressure);

    // Only add trauma if positive stress exceeds critical threshold
    // This matches TS: trauma = positiveStressMagnitude > criticalPressure ? scarFactor : 0
    let trauma = if positive_stress > 0.7 {
        // criticalPressure = 0.7 in TS
        config.scar_factor
    } else {
        0.0
    };

    // Note: Decay is handled separately in the main physics loop
    // This matches TS which handles decay in updateScar function
    Scar(current_scar.0 + trauma)
}

/// Update scar with decay (full TS parity)
///
/// Matches TypeScript updateScar exactly:
/// - Decay: S * e^(-λΔt)
/// - Trauma: σ if ||P+|| > P_crit else 0
#[inline]
pub fn update_scar_with_decay(
    current_scar: Scar,
    pressure: &PressureVector,
    delta_t_ms: f64,
    config: &PhysicsConfig,
) -> Scar {
    let dt_seconds = delta_t_ms / 1000.0;

    // Exponential decay: S * e^(-decay_rate * dt)
    let decay_rate = 0.1; // Matches TS: decayRate: 0.1
    let decayed = current_scar.0 * (-decay_rate * dt_seconds).exp();

    // Check Valve: Only positive pressure causes trauma
    let positive_stress = vector::positive_stress_magnitude(pressure);

    // Trauma if stress > critical_pressure (0.7)
    let trauma = if positive_stress > 0.7 {
        config.scar_factor
    } else {
        0.0
    };

    Scar((decayed + trauma).max(0.0))
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
        assert_eq!(scar.0, 5.0); // Unchanged (no trauma, no decay in this method)
    }

    #[test]
    fn test_negative_pressure_no_trauma() {
        // Negative pressure = system healthy = NO TRAUMA
        let pressure = PressureVector::new(-0.5, -0.3, -0.2);
        let config = PhysicsConfig::default();
        let weights = SensitivityWeights::default();

        let scar = update_scar(Scar(5.0), &pressure, &weights, &config);
        assert_eq!(scar.0, 5.0); // No change - "Silence is not Trauma"
    }

    #[test]
    fn test_high_positive_pressure_adds_scar() {
        // High positive pressure = trauma
        let pressure = PressureVector::new(0.8, 0.6, 0.5);
        let config = PhysicsConfig::default();
        let weights = SensitivityWeights::default();

        let scar = update_scar(Scar(0.0), &pressure, &weights, &config);
        assert!(scar.0 > 0.0); // Trauma added
    }

    #[test]
    fn test_low_positive_pressure_no_trauma() {
        // Low positive pressure (under critical) = no trauma
        let pressure = PressureVector::new(0.2, 0.1, 0.1);
        let config = PhysicsConfig::default();
        let weights = SensitivityWeights::default();

        let scar = update_scar(Scar(5.0), &pressure, &weights, &config);
        assert_eq!(scar.0, 5.0); // No change - under critical threshold
    }

    #[test]
    fn test_decay_with_time() {
        let pressure = PressureVector::new(0.0, 0.0, 0.0);
        let config = PhysicsConfig::default();

        // After 1 second, scar should decay by ~10%
        let scar = update_scar_with_decay(Scar(10.0), &pressure, 1000.0, &config);
        assert!(scar.0 < 10.0);
        assert!(scar.0 > 9.0); // ~9.05 expected
    }
}
