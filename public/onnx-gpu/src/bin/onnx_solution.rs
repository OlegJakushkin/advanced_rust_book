//! Chapter 54 — real ONNX inference from Rust, on the GPU (SOLUTION).
//!
//! Loads model.onnx (a 4-layer MLP), runs the same batch through ONNX Runtime
//! twice — once on the CPU execution provider, once on the CUDA execution
//! provider — checks the outputs agree, and reports the per-inference speedup.
//!
//! Genuine GPU work: ONNX Runtime dispatches the Gemm/Relu kernels to the CUDA
//! EP. The CUDA session uses `.error_on_failure()`, so it refuses to silently
//! fall back to CPU — the speedup you see is real device execution.

use ort::execution_providers::CUDAExecutionProvider;
use ort::session::{builder::GraphOptimizationLevel, Session};
use ort::value::Tensor;
use std::time::Instant;

const BATCH: usize = 128;
const DIN: usize = 1024;

fn build(cuda: bool) -> ort::Result<Session> {
    let builder = Session::builder()?.with_optimization_level(GraphOptimizationLevel::Level3)?;
    let builder = if cuda {
        builder.with_execution_providers([CUDAExecutionProvider::default().build().error_on_failure()])?
    } else {
        builder
    };
    builder.commit_from_file("model.onnx")
}

fn run_once(s: &mut Session, input: &[f32]) -> ort::Result<Vec<f32>> {
    let t = Tensor::from_array(([BATCH, DIN], input.to_vec()))?;
    let outputs = s.run(ort::inputs!["input" => t])?;
    let (_shape, data) = outputs["gemm3"].try_extract_tensor::<f32>()?;
    Ok(data.to_vec())
}

fn bench(label: &str, s: &mut Session, input: &[f32], iters: usize) -> ort::Result<(f64, Vec<f32>)> {
    let out = run_once(s, input)?; // warm up (allocations, kernel selection, etc.)
    let t = Instant::now();
    for _ in 0..iters {
        let _ = run_once(s, input)?;
    }
    let ms = t.elapsed().as_secs_f64() * 1e3 / iters as f64;
    println!("{label:11}= {ms:.2} ms / inference");
    Ok((ms, out))
}

fn main() -> ort::Result<()> {
    let input: Vec<f32> = (0..BATCH * DIN).map(|i| ((i % 97) as f32) * 0.01).collect();
    let iters = 50;

    let mut cpu = build(false)?;
    let (cpu_ms, cpu_out) = bench("cpu", &mut cpu, &input, iters)?;

    let mut gpu = build(true)?;
    let (gpu_ms, gpu_out) = bench("gpu (cuda)", &mut gpu, &input, iters)?;

    let (mut max_abs, mut max_val) = (0.0f32, 1.0f32);
    for (a, b) in cpu_out.iter().zip(gpu_out.iter()) {
        max_abs = max_abs.max((a - b).abs());
        max_val = max_val.max(a.abs());
    }

    println!("batch      = {BATCH}, model = 1024->4096->4096->4096->10 (f32)");
    println!("speedup    = {:.1}x", cpu_ms / gpu_ms);
    println!("agree      = {}", max_abs / max_val < 1e-3);
    Ok(())
}
