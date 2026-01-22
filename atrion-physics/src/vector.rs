/**
 * Vector mathematics with SIMD optimization.
 *
 * - AVX2 for x86_64 (native builds)
 * - SIMD128 for wasm32 (WASM builds)
 * - Scalar fallback for other architectures
 */
use crate::types::{PressureVector, SensitivityWeights};

// ============================================================================
// SIMD-OPTIMIZED MAGNITUDE
// ============================================================================

// x86_64 Native: AVX2
#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::*;

// wasm32: SIMD128
#[cfg(target_arch = "wasm32")]
use std::arch::wasm32::*;

/// Calculate vector magnitude using AVX2 SIMD (x86_64 only)
///
/// ~4x faster than scalar version
#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2")]
unsafe fn magnitude_simd_avx2(v: &PressureVector) -> f64 {
    let values = _mm256_set_pd(0.0, v.saturation, v.error, v.latency);
    let squared = _mm256_mul_pd(values, values);
    let sum = _mm256_hadd_pd(squared, squared);
    let hi128 = _mm256_extractf128_pd(sum, 1);
    let sum128 = _mm_add_pd(_mm256_castpd256_pd128(sum), hi128);

    let mut result: f64 = 0.0;
    _mm_store_sd(&mut result as *mut f64, sum128);
    result.sqrt()
}

/// Calculate vector magnitude using WASM SIMD128 (wasm32 only)
///
/// ~2x faster than scalar version in WASM
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn magnitude_simd_wasm(v: &PressureVector) -> f64 {
    // Load [latency, error] into v128 (2x f64)
    let low = f64x2(v.latency, v.error);
    // Load [saturation, 0.0] into v128
    let high = f64x2(v.saturation, 0.0);

    // Square components
    let low_sq = f64x2_mul(low, low);
    let high_sq = f64x2_mul(high, high);

    // Sum: latency² + error²
    let sum_low = f64x2_extract_lane::<0>(low_sq) + f64x2_extract_lane::<1>(low_sq);
    // Add: saturation²
    let total = sum_low + f64x2_extract_lane::<0>(high_sq);

    total.sqrt()
}

/// Safe wrapper for SIMD magnitude (x86_64)
#[cfg(target_arch = "x86_64")]
#[inline]
pub fn magnitude(v: &PressureVector) -> f64 {
    // TODO: Add runtime AVX2 detection with is_x86_feature_detected!
    unsafe { magnitude_simd_avx2(v) }
}

/// Safe wrapper for SIMD magnitude (wasm32)
#[cfg(target_arch = "wasm32")]
#[inline]
pub fn magnitude(v: &PressureVector) -> f64 {
    // WASM SIMD128 always available when enabled
    unsafe { magnitude_simd_wasm(v) }
}

/// Scalar fallback for other architectures
#[cfg(not(any(target_arch = "x86_64", target_arch = "wasm32")))]
#[inline]
pub fn magnitude(v: &PressureVector) -> f64 {
    (v.latency * v.latency + v.error * v.error + v.saturation * v.saturation).sqrt()
}

// ============================================================================
// DOT PRODUCT
// ============================================================================

/// Weighted dot product: P · W
#[inline]
pub fn dot_product(v: &PressureVector, weights: &SensitivityWeights) -> f64 {
    v.latency * weights.w_latency + v.error * weights.w_error + v.saturation * weights.w_saturation
}

/// Calculate positive stress magnitude (Check Valve Pattern)
///
/// CRITICAL: Only POSITIVE pressure causes trauma.
/// Negative values (system healthy) are clamped to 0 BEFORE squaring.
///
/// This matches the TypeScript implementation:
/// ```typescript
/// const positiveStressMagnitude = Math.sqrt(
///   Math.max(0, pressure.latency) ** 2 +
///   Math.max(0, pressure.error) ** 2 +
///   Math.max(0, pressure.saturation) ** 2,
/// );
/// ```
///
/// "Silence is not Trauma" - negative deviation (good performance)
/// does NOT accumulate scar tissue.
#[inline]
pub fn positive_stress_magnitude(v: &PressureVector) -> f64 {
    let lat = v.latency.max(0.0);
    let err = v.error.max(0.0);
    let sat = v.saturation.max(0.0);
    (lat * lat + err * err + sat * sat).sqrt()
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_magnitude_zero_vector() {
        let v = PressureVector::new(0.0, 0.0, 0.0);
        assert_eq!(magnitude(&v), 0.0);
    }

    #[test]
    fn test_magnitude_unit_vector() {
        let v = PressureVector::new(1.0, 0.0, 0.0);
        assert!((magnitude(&v) - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_magnitude_pythagorean() {
        let v = PressureVector::new(3.0, 4.0, 0.0);
        assert!((magnitude(&v) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_dot_product() {
        let v = PressureVector::new(0.5, 0.2, 0.3);
        let w = SensitivityWeights::new(8.0, 10.0, 5.0);
        let result = dot_product(&v, &w);
        assert!((result - (0.5 * 8.0 + 0.2 * 10.0 + 0.3 * 5.0)).abs() < 1e-10);
    }
}
