export const DEFAULT_CODES_CH37: Record<string, string> = {
  cuda_gpu_kernel_launch_wrapper: `#[derive(Debug, Clone, Copy)]
struct LaunchConfig {
    threads_per_block: u32,
    blocks: u32,
}

#[derive(Debug)]
struct DeviceBuffer {
    len: usize,
    bytes: usize,
}

impl DeviceBuffer {
    fn for_f32(len: usize) -> Self {
        Self {
            len,
            bytes: len * std::mem::size_of::<f32>(),
        }
    }
}

fn build_launch_config(len: usize, threads_per_block: u32) -> Result<LaunchConfig, &'static str> {
    if len == 0 {
        return Err("empty input");
    }

    if threads_per_block == 0 {
        return Err("threads_per_block must be > 0");
    }

    let blocks = ((len as u32) + threads_per_block - 1) / threads_per_block;

    Ok(LaunchConfig {
        threads_per_block,
        blocks,
    })
}

unsafe fn raw_launch_vec_add(
    config: LaunchConfig,
    a: &DeviceBuffer,
    b: &DeviceBuffer,
    out: &mut DeviceBuffer,
) -> Result<(), &'static str> {
    // Defensive: the safe wrapper already guarantees equal lengths and a valid
    // launch config. These checks restate the invariant the SAFETY comment relies
    // on, so the authoritative gate stays in `launch_vec_add` below.
    if a.len != b.len || a.len != out.len {
        return Err("shape mismatch");
    }

    if config.blocks == 0 || config.threads_per_block == 0 {
        return Err("invalid launch");
    }

    Ok(())
}

fn launch_vec_add(len: usize, threads_per_block: u32) -> Result<(LaunchConfig, usize), &'static str> {
    let config = build_launch_config(len, threads_per_block)?;
    let a = DeviceBuffer::for_f32(len);
    let b = DeviceBuffer::for_f32(len);
    let mut out = DeviceBuffer::for_f32(len);

    unsafe {
        // SAFETY:
        // - this wrapper creates all three device buffers with the same logical length.
        // - build_launch_config guarantees nonzero block and thread counts.
        // - the raw launch does not outlive these local buffers in this demo.
        raw_launch_vec_add(config, &a, &b, &mut out)?;
    }

    Ok((config, a.bytes + b.bytes + out.bytes))
}

fn main() {
    let (config, device_bytes) = launch_vec_add(4_096, 256).unwrap();

    println!("blocks = {}", config.blocks);
    println!("threads = {}", config.threads_per_block);
    println!("device bytes = {}", device_bytes);
}`,
  cuda_gpu_transfer_budget: `#[derive(Debug, Clone, Copy)]
struct Workload {
    elements: usize,
    flops_per_element: u64,
    input_buffers: usize,
    output_buffers: usize,
}

fn transfer_bytes(work: Workload) -> usize {
    work.elements * std::mem::size_of::<f32>() * (work.input_buffers + work.output_buffers)
}

fn arithmetic_intensity(work: Workload) -> f64 {
    work.flops_per_element as f64
        / (std::mem::size_of::<f32>() as f64 * (work.input_buffers + work.output_buffers) as f64)
}

fn should_use_gpu(work: Workload, launch_us: u64) -> bool {
    let bytes = transfer_bytes(work);
    let intensity = arithmetic_intensity(work);

    bytes >= 8_000_000 && intensity >= 4.0 && launch_us <= 50
}

fn main() {
    let work = Workload {
        elements: 1_000_000,
        flops_per_element: 64,
        input_buffers: 2,
        output_buffers: 1,
    };
    let launch_us = 25_u64;

    println!("transfer bytes = {}", transfer_bytes(work));
    println!("intensity = {:.2}", arithmetic_intensity(work));
    println!("gpu faster = {}", should_use_gpu(work, launch_us));
}`,
}
