//! Chapter 37 — real CUDA from Rust (SOLUTION).
//!
//! Multiplies two N x N f32 matrices on the GPU with a CUDA kernel (compiled at
//! run time by NVRTC, launched through cudarc), times it against a cache-friendly
//! CPU baseline, checks the two results agree, and prints the speedup.
//!
//! Run:  cargo run --release --bin matmul_solution [N]      (default N = 1024)

use cudarc::driver::{CudaDevice, LaunchAsync, LaunchConfig};
use cudarc::nvrtc::compile_ptx;
use std::time::Instant;

/// One CUDA thread computes one output element C[row][col].
const KERNEL: &str = r#"
extern "C" __global__ void matmul(const float* A, const float* B, float* C, int N) {
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int col = blockIdx.x * blockDim.x + threadIdx.x;
    if (row < N && col < N) {
        float acc = 0.0f;
        for (int k = 0; k < N; ++k) {
            acc += A[row * N + k] * B[k * N + col];
        }
        C[row * N + col] = acc;
    }
}
"#;

/// CPU baseline in i-k-j order so the inner loop walks memory sequentially —
/// a fair fight, not a strawman.
fn cpu_matmul(a: &[f32], b: &[f32], n: usize) -> Vec<f32> {
    let mut c = vec![0.0f32; n * n];
    for i in 0..n {
        for k in 0..n {
            let aik = a[i * n + k];
            let brow = &b[k * n..k * n + n];
            let crow = &mut c[i * n..i * n + n];
            for j in 0..n {
                crow[j] += aik * brow[j];
            }
        }
    }
    c
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let n: usize = std::env::args().nth(1).and_then(|s| s.parse().ok()).unwrap_or(1024);
    let a: Vec<f32> = (0..n * n).map(|i| ((i % 13) as f32) * 0.5).collect();
    let b: Vec<f32> = (0..n * n).map(|i| ((i % 7) as f32) * 0.25).collect();

    // --- CPU ---
    let t = Instant::now();
    let c_cpu = cpu_matmul(&a, &b, n);
    let cpu_ms = t.elapsed().as_secs_f64() * 1e3;

    // --- GPU setup: open the device, compile the kernel, fetch the function ---
    let dev = CudaDevice::new(0)?;
    dev.load_ptx(compile_ptx(KERNEL)?, "matmul_mod", &["matmul"])?;
    let func = dev.get_func("matmul_mod", "matmul").unwrap();

    let block = 16u32;
    let grid = (n as u32).div_ceil(block);
    let cfg = LaunchConfig {
        grid_dim: (grid, grid, 1),
        block_dim: (block, block, 1),
        shared_mem_bytes: 0,
    };

    // --- GPU run: time the end-to-end path and the kernel on its own ---
    let t_total = Instant::now();
    let a_d = dev.htod_copy(a)?;
    let b_d = dev.htod_copy(b)?;
    let mut c_d = dev.alloc_zeros::<f32>(n * n)?;
    dev.synchronize()?;

    let t_kernel = Instant::now();
    unsafe { func.launch(cfg, (&a_d, &b_d, &mut c_d, n as i32))?; }
    dev.synchronize()?;
    let kernel_ms = t_kernel.elapsed().as_secs_f64() * 1e3;

    let c_gpu = dev.dtoh_sync_copy(&c_d)?;
    let total_ms = t_total.elapsed().as_secs_f64() * 1e3;

    // --- correctness: max relative difference between CPU and GPU results ---
    let (mut max_abs, mut max_val) = (0.0f32, 1.0f32);
    for (x, y) in c_cpu.iter().zip(c_gpu.iter()) {
        max_abs = max_abs.max((x - y).abs());
        max_val = max_val.max(x.abs());
    }
    let correct = (max_abs / max_val) < 1e-3;

    println!("device     = {}", dev.name()?);
    println!("matrix     = {n} x {n} (f32)");
    println!("cpu        = {cpu_ms:.1} ms");
    println!("gpu kernel = {kernel_ms:.2} ms");
    println!("gpu total  = {total_ms:.1} ms  (incl. host<->device copies)");
    println!("speedup    = {:.1}x kernel, {:.1}x end-to-end", cpu_ms / kernel_ms, cpu_ms / total_ms);
    println!("correct    = {correct}");
    Ok(())
}
