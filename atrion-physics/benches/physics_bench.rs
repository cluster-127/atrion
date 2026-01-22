use atrion_physics::types::*;
use atrion_physics::*;
/**
 * Criterion Benchmarks for Atrion Physics
 *
 * Measures performance of core physics functions.
 */
use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};

// ============================================================================
// SETUP
// ============================================================================

fn setup() -> (PhysicsConfig, SensitivityWeights, PressureVector) {
    let config = PhysicsConfig::default();
    let weights = SensitivityWeights::default();
    let pressure = PressureVector::new(0.5, 0.3, 0.2);
    (config, weights, pressure)
}

// ============================================================================
// VECTOR MATH BENCHMARKS
// ============================================================================

fn bench_vector_magnitude(c: &mut Criterion) {
    let pressure = PressureVector::new(0.5, 0.3, 0.2);

    c.bench_function("vector::magnitude", |b| {
        b.iter(|| vector::magnitude(black_box(&pressure)))
    });
}

fn bench_vector_dot_product(c: &mut Criterion) {
    let pressure = PressureVector::new(0.5, 0.3, 0.2);
    let weights = SensitivityWeights::default();

    c.bench_function("vector::dot_product", |b| {
        b.iter(|| vector::dot_product(black_box(&pressure), black_box(&weights)))
    });
}

// ============================================================================
// RESISTANCE BENCHMARKS
// ============================================================================

fn bench_calculate_resistance(c: &mut Criterion) {
    let (config, weights, pressure) = setup();

    c.bench_function("resistance::calculate", |b| {
        b.iter(|| {
            resistance::calculate_resistance(
                black_box(&pressure),
                black_box(Momentum(0.5)),
                black_box(Scar(10.0)),
                black_box(&weights),
                black_box(&config),
                black_box(0.1),
            )
        })
    });
}

// ============================================================================
// SCAR BENCHMARKS
// ============================================================================

fn bench_update_scar(c: &mut Criterion) {
    let (config, weights, pressure) = setup();

    c.bench_function("scar::update", |b| {
        b.iter(|| {
            scar::update_scar(
                black_box(Scar(5.0)),
                black_box(&pressure),
                black_box(&weights),
                black_box(&config),
            )
        })
    });
}

// ============================================================================
// MOMENTUM BENCHMARKS
// ============================================================================

fn bench_update_momentum(c: &mut Criterion) {
    let config = PhysicsConfig::default();
    let prev_pressure = PressureVector::new(0.3, 0.2, 0.1);
    let curr_pressure = PressureVector::new(0.5, 0.3, 0.2);

    c.bench_function("momentum::update", |b| {
        b.iter(|| {
            momentum::update_momentum(
                black_box(Momentum(0.3)),
                black_box(&prev_pressure),
                black_box(&curr_pressure),
                black_box(100.0),
                black_box(&config),
            )
        })
    });
}

// ============================================================================
// FULL ENGINE BENCHMARK
// ============================================================================

fn bench_physics_engine(c: &mut Criterion) {
    let engine = PhysicsEngine::new();
    let pressure = PressureVector::new(0.5, 0.3, 0.2);

    c.bench_function("PhysicsEngine::calculateResistance", |b| {
        b.iter(|| {
            engine.calculate_resistance(
                black_box(&pressure),
                black_box(0.5),
                black_box(10.0),
                black_box(0.1),
            )
        })
    });
}

// ============================================================================
// THROUGHPUT BENCHMARK (ops/s)
// ============================================================================

fn bench_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("throughput");
    let engine = PhysicsEngine::new();

    for size in [100, 1000, 10_000, 100_000].iter() {
        group.throughput(criterion::Throughput::Elements(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let pressures: Vec<_> = (0..size)
                .map(|i| {
                    let f = i as f64 / size as f64;
                    PressureVector::new(f * 0.5, f * 0.3, f * 0.2)
                })
                .collect();

            b.iter(|| {
                for pressure in &pressures {
                    black_box(engine.calculate_resistance(pressure, 0.5, 10.0, 0.1));
                }
            });
        });
    }
    group.finish();
}

// ============================================================================
// CRITERION GROUPS
// ============================================================================

criterion_group!(
    vector_benches,
    bench_vector_magnitude,
    bench_vector_dot_product
);

criterion_group!(
    physics_benches,
    bench_calculate_resistance,
    bench_update_scar,
    bench_update_momentum
);

criterion_group!(engine_benches, bench_physics_engine, bench_throughput);

criterion_main!(vector_benches, physics_benches, engine_benches);
