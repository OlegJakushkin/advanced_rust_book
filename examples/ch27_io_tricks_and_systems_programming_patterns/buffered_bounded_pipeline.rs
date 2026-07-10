use std::io::{self, BufRead, BufReader, BufWriter, Cursor, Write};
use std::sync::mpsc;
use std::thread;

fn main() -> io::Result<()> {
    let input = Cursor::new("alpha\nbeta\ngamma\n".as_bytes());
    let mut reader = BufReader::new(input);
    let (tx, rx) = mpsc::sync_channel::<String>(1);

    let producer = thread::spawn(move || {
        let mut line = String::new();
        let mut sent = 0usize;

        loop {
            line.clear();
            let read = reader.read_line(&mut line).unwrap();
            if read == 0 {
                break;
            }

            tx.send(line.trim_end().to_string()).unwrap();
            sent += 1;
        }

        sent
    });

    let mut out = Vec::new();
    let mut received = 0usize;
    let mut batches = 0usize;
    let mut pending = Vec::with_capacity(2);

    {
        let mut writer = BufWriter::new(&mut out);

        while let Ok(line) = rx.recv() {
            pending.push(line);

            if pending.len() == 2 {
                for item in pending.drain(..) {
                    writeln!(writer, "{}", item)?;
                }
                batches += 1;
            }

            received += 1;
        }

        if !pending.is_empty() {
            for item in pending.drain(..) {
                writeln!(writer, "{}", item)?;
            }
            batches += 1;
        }

        writer.flush()?;
    }

    println!("sent = {}", producer.join().unwrap());
    println!("received = {}", received);
    println!("batches = {}", batches);
    println!("bytes = {}", out.len());
    Ok(())
}
