#[derive(Debug, Clone, Copy)]
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
}
