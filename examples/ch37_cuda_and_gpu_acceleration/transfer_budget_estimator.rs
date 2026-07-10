#[derive(Debug, Clone, Copy)]
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
}
