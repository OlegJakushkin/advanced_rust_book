use std::io::{self, BufRead, BufReader, BufWriter, Cursor, Write};
use std::sync::mpsc;
use std::thread;

fn main() -> io::Result<()> {
    let input = Cursor::new("red\
blue\
green\
".as_bytes());
    let mut reader = BufReader::new(input);
    let (tx, rx) = mpsc::channel::<String>();

    let producer = thread::spawn(move || {
        let mut line = String::new();
        while reader.read_line(&mut line).unwrap() != 0 {
            let owned = line.trim_end().to_string();
            tx.send(owned).unwrap();
            line.clear();
        }
    });

    let mut out = Vec::new();
    let mut writer = BufWriter::new(&mut out);
    let mut received = 0usize;
    let mut batches = 0usize;
    let mut pending = Vec::new();

    while let Ok(line) = rx.recv() {
        pending.push(line);

        if pending.len() == 0 {
            for item in pending.drain(..) {
                writeln!(writer, "{}", item)?;
            }
            batches += 1;
        }

        received += 1;
    }

    producer.join().unwrap();
    writer.flush()?;

    println!("capacity = {}", 1);
    println!("received = {}", received);
    println!("batches = {}", batches);
    println!("bytes = {}", out.len());
    Ok(())
}
