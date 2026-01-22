/**
 * Core type definitions for Atrion physics engine.
 *
 * Uses "NewType" pattern for type safety (Zero-Cost Abstraction).
 */
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// ============================================================================
// BRANDED TYPES
// ============================================================================

/// Electrical resistance (Ohms)
#[derive(Debug, Copy, Clone, PartialEq, PartialOrd, Serialize, Deserialize)]
#[repr(transparent)]
pub struct Ohms(pub f64);

/// Accumulated trauma (Scar Tissue)
#[derive(Debug, Copy, Clone, PartialEq, PartialOrd, Serialize, Deserialize)]
#[repr(transparent)]
pub struct Scar(pub f64);

/// Momentum magnitude
#[derive(Debug, Copy, Clone, PartialEq, PartialOrd, Serialize, Deserialize)]
#[repr(transparent)]
pub struct Momentum(pub f64);

// ============================================================================
// VECTORS
// ============================================================================

/// Normalized pressure vector [0, 1]³
#[derive(Debug, Copy, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct PressureVector {
    pub latency: f64,
    pub error: f64,
    pub saturation: f64,
}

#[wasm_bindgen]
impl PressureVector {
    #[wasm_bindgen(constructor)]
    pub fn new(latency: f64, error: f64, saturation: f64) -> Self {
        Self {
            latency,
            error,
            saturation,
        }
    }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/// Physics engine configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct PhysicsConfig {
    pub base_resistance: f64,
    pub damping_factor: f64,
    pub scar_factor: f64,
    pub momentum_halflife: f64,
    pub bootstrap_ticks: u32,
    pub break_threshold: f64,
    pub recovery_threshold: f64,
}

#[wasm_bindgen]
impl PhysicsConfig {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }
}

impl Default for PhysicsConfig {
    fn default() -> Self {
        Self {
            // MUST match src/core/config.ts DEFAULT_CONFIG
            base_resistance: 10.0,     // TS: 10
            damping_factor: 20.0,      // TS: 20
            scar_factor: 5.0,          // TS: 5
            momentum_halflife: 5000.0, // Not in TS, kept as-is
            bootstrap_ticks: 10,       // TS: 10
            break_threshold: 100.0,    // TS: breakMultiplier * baseResistance = 10*10
            recovery_threshold: 50.0,
        }
    }
}

/// Sensitivity weights for pressure components
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct SensitivityWeights {
    pub w_latency: f64,
    pub w_error: f64,
    pub w_saturation: f64,
}

#[wasm_bindgen]
impl SensitivityWeights {
    #[wasm_bindgen(constructor)]
    pub fn new(w_latency: f64, w_error: f64, w_saturation: f64) -> Self {
        Self {
            w_latency,
            w_error,
            w_saturation,
        }
    }
}

impl Default for SensitivityWeights {
    fn default() -> Self {
        // MUST match deriveWeights(DEFAULT_SLO) from src/core/config.ts
        // TS: wLatency = log(1 + 5) = log(6) ≈ 1.79
        // TS: wError = log(1 + 8) = log(9) ≈ 2.20
        // TS: wSaturation = log(1 + 3) = log(4) ≈ 1.39
        Self {
            w_latency: 1.791759469228055,     // ln(6)
            w_error: 2.1972245773362196,      // ln(9)
            w_saturation: 1.3862943611198906, // ln(4)
        }
    }
}

// ============================================================================
// OPERATIONAL MODE
// ============================================================================

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[wasm_bindgen]
pub enum OperationalMode {
    Bootstrap,
    Operational,
    CircuitBreaker,
}
