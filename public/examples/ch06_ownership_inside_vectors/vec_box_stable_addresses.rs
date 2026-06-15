use std::ptr;

#[derive(Debug)]
struct Job {
    name: String,
    attempts: usize,
    needs_retry: bool,
}

fn main() {
    let mut jobs: Vec<Box<Job>> = Vec::new();

    jobs.push(Box::new(Job {
        name: String::from("billing"),
        attempts: 1,
        needs_retry: true,
    }));

    let first_ptr: *const Job = &*jobs[0];

    jobs.push(Box::new(Job {
        name: String::from("search"),
        attempts: 1,
        needs_retry: false,
    }));
    jobs.push(Box::new(Job {
        name: String::from("indexer"),
        attempts: 1,
        needs_retry: false,
    }));

    let same_address = ptr::eq(first_ptr, &*jobs[0]);

    let retry_indices: Vec<usize> = jobs
        .iter()
        .enumerate()
        .filter_map(|(index, job)| job.needs_retry.then_some(index))
        .collect();

    for index in retry_indices {
        jobs[index].attempts += 1;
        jobs[index].needs_retry = false;
    }

    println!("same address = {}", same_address);
    println!("attempts = {}", jobs[0].attempts);
    println!("retry pending = {}", jobs.iter().filter(|job| job.needs_retry).count());
}
