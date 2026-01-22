/**
 * Momentum calculation (inertia/acceleration tracking).
 *
 * Momentum = weighted moving average of pressure changes.
 */
use crate::types::{Momentum, PhysicsConfig, PressureVector};
use crate::vector;

/// Update momentum based on pressure change
///
/// Uses exponential decay: M(t) = M(t-1) × e^(-Δt/halflife) + a × (1 - e^(-Δt/halflife))
///
/// Where:
/// - a = acceleration (pressure change / time)
/// - halflife = momentum_halflife config parameter
#[inline]
pub fn update_momentum(
    current_momentum: Momentum,
    previous_pressure: &PressureVector,
    current_pressure: &PressureVector,
    delta_t: f64,
    config: &PhysicsConfig,
) -> Momentum {
    // Exponential decay factor
    let decay = (-delta_t / config.momentum_halflife).exp();

    // Calculate pressure delta
    let delta_pressure = PressureVector {
        latency: current_pressure.latency - previous_pressure.latency,
        error: current_pressure.error - previous_pressure.error,
        saturation: current_pressure.saturation - previous_pressure.saturation,
    };

    // Acceleration = change in pressure / time
    let acceleration = if delta_t > 0.0 {
        vector::magnitude(&delta_pressure) / delta_t
    } else {
        0.0
    };

    // Exponentially weighted moving average
    let new_value = current_momentum.0 * decay + acceleration * (1.0 - decay);

    Momentum(new_value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_momentum_decay() {
        let prev = PressureVector::new(0.5, 0.2, 0.3);
        let curr = PressureVector::new(0.5, 0.2, 0.3); // No change
        let config = PhysicsConfig::default();

        let momentum = update_momentum(Momentum(10.0), &prev, &curr, 1000.0, &config);

        // Should decay toward zero
        assert!(momentum.0 < 10.0);
    }

    #[test]
    fn test_momentum_increase() {
        let prev = PressureVector::new(0.0, 0.0, 0.0);
        let curr = PressureVector::new(0.5, 0.2, 0.3); // Increasing
        let config = PhysicsConfig::default();

        let momentum = update_momentum(Momentum(0.0), &prev, &curr, 100.0, &config);

        // Should increase
        assert!(momentum.0 > 0.0);
    }

    #[test]
    fn test_zero_delta_t() {
        let prev = PressureVector::new(0.5, 0.2, 0.3);
        let curr = PressureVector::new(0.8, 0.4, 0.5);
        let config = PhysicsConfig::default();

        let momentum = update_momentum(Momentum(5.0), &prev, &curr, 0.0, &config);

        // Should preserve current momentum (no acceleration)
        assert_eq!(momentum.0, 5.0);
    }
}
