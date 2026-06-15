use std::io::{self, BufRead, BufReader, BufWriter, Cursor, Write};
use std::sync::mpsc;
use std::thread;

fn main() -> io::Result<()> {
    // Three newline-separated records living entirely in memory.
    let input = Cursor::new("red\nblue\ngreen\n".as_bytes());
    let mut reader = BufReader::new(input);

    // Bounded handoff: capacity 1 makes backpressure visible. A fast
    // producer cannot race ahead of a slow consumer because send blocks
    // once one item is in flight.
    let (tx, rx) = mpsc::sync_channel::<String>(1);

    let producer = thread::spawn(move || {
        let mut line = String::new();
        while reader.read_line(&mut line).unwrap() != 0 {
            // Hand an owned String across the thread boundary. The
            // borrowed line buffer stays with the producer and is reused.
            let owned = line.trim_end().to_string();
            tx.send(owned).unwrap();
            line.clear();
        }
    });

    let mut out = Vec::new();
    let mut received = 0usize;
    let mut batches = 0usize;
    let mut pending: Vec<String> = Vec::with_capacity(2);

    {
        // Buffered writer: many small writeln! calls coalesce into the
        // backing Vec rather than going out one record at a time.
        let mut writer = BufWriter::new(&mut out);

        while let Ok(line) = rx.recv() {
            pending.push(line);
            received += 1;

            // Logical batch size of 2: flush a full batch as soon as it forms.
            if pending.len() == 2 {
                for item in pending.drain(..) {
                    writeln!(writer, "{}", item)?;
                }
                batches += 1;
            }
        }

        // The trailing partial batch is the easy thing to forget. With three
        // records the last one is left over after the full batch.
        if !pending.is_empty() {
            for item in pending.drain(..) {
                writeln!(writer, "{}", item)?;
            }
            batches += 1;
        }

        writer.flush()?;
    }

    producer.join().unwrap();

    println!("capacity = {}", 1);
    println!("received = {}", received);
    println!("batches = {}", batches);
    println!("bytes = {}", out.len());
    Ok(())
}
