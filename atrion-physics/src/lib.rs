/**
 * Atrion Physics Engine - WASM Entry Point
 *
 * High-performance physics core for admission control.
 */

// Enable allocator for WASM only
#[cfg(target_arch = "wasm32")]
#[global_allocator]
static ALLOC: lol_alloc::AssumeSingleThreaded<lol_alloc::FreeListAllocator> =
    unsafe { lol_alloc::AssumeSingleThreaded::new(lol_alloc::FreeListAllocator::new()) };

use wasm_bindgen::prelude::*;

pub mod momentum;
pub mod resistance;
pub mod scar;
pub mod types;
pub mod vector;

use types::*;

/// Main physics engine for WASM
#[wasm_bindgen]
pub struct PhysicsEngine {
    config: PhysicsConfig,
    weights: SensitivityWeights,
}

#[wasm_bindgen]
impl PhysicsEngine {
    /// Create new physics engine
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            config: PhysicsConfig::default(),
            weights: SensitivityWeights::default(),
        }
    }

    /// Create with custom config
    #[wasm_bindgen(js_name = withConfig)]
    pub fn with_config(config: PhysicsConfig, weights: SensitivityWeights) -> Self {
        Self { config, weights }
    }

    /// Calculate resistance (main hot path)
    #[wasm_bindgen(js_name = calculateResistance)]
    pub fn calculate_resistance(
        &self,
        pressure: &PressureVector,
        momentum: f64,
        scar: f64,
        staleness: f64,
    ) -> f64 {
        let result = resistance::calculate_resistance(
            pressure,
            Momentum(momentum),
            Scar(scar),
            &self.weights,
            &self.config,
            staleness,
        );
        result.0
    }

    /// Update scar tissue
    #[wasm_bindgen(js_name = updateScar)]
    pub fn update_scar(&self, current_scar: f64, pressure: &PressureVector) -> f64 {
        let result = scar::update_scar(Scar(current_scar), pressure, &self.weights, &self.config);
        result.0
    }

    /// Update momentum
    #[wasm_bindgen(js_name = updateMomentum)]
    pub fn update_momentum(
        &self,
        current_momentum: f64,
        previous_pressure: &PressureVector,
        current_pressure: &PressureVector,
        delta_t: f64,
    ) -> f64 {
        let result = momentum::update_momentum(
            Momentum(current_momentum),
            previous_pressure,
            current_pressure,
            delta_t,
            &self.config,
        );
        result.0
    }

    /// Calculate vector magnitude (exposed for testing)
    #[wasm_bindgen(js_name = vectorMagnitude)]
    pub fn vector_magnitude(pressure: &PressureVector) -> f64 {
        vector::magnitude(pressure)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_creation() {
        let engine = PhysicsEngine::new();
        assert_eq!(engine.config.base_resistance, 10.0);
    }

    #[test]
    fn test_resistance_calculation() {
        let engine = PhysicsEngine::new();
        let pressure = PressureVector::new(0.5, 0.2, 0.3);
        let r = engine.calculate_resistance(&pressure, 0.0, 0.0, 0.0);
        assert!(r > engine.config.base_resistance);
    }
}
