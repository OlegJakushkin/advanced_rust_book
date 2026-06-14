export const DEFAULT_CODES_CH27: Record<string, string> = {
  io_patterns_buffered_backpressure: `use std::io::{self, BufRead, BufReader, BufWriter, Cursor, Write};
use std::sync::mpsc;
use std::thread;

fn main() -> io::Result<()> {
    let input = Cursor::new("alpha\\nbeta\\ngamma\\n".as_bytes());
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
}`,
  io_patterns_scatter_gather_socket: `use std::io::{self, IoSlice, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;

fn write_all_vectored(stream: &mut TcpStream, mut parts: &mut [IoSlice<'_>]) -> io::Result<()> {
    while !parts.is_empty() {
        let wrote = stream.write_vectored(parts)?;
        if wrote == 0 {
            return Err(io::Error::new(
                io::ErrorKind::WriteZero,
                "socket closed before full response",
            ));
        }
        IoSlice::advance_slices(&mut parts, wrote);
    }

    Ok(())
}

fn main() -> io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let addr = listener.local_addr()?;

    let server = thread::spawn(move || -> io::Result<(bool, usize)> {
        let (mut stream, _) = listener.accept()?;
        stream.set_nodelay(true)?;

        let mut parts = [IoSlice::new(b"hdr:"), IoSlice::new(b"payload")];
        write_all_vectored(&mut stream, &mut parts)?;
        stream.flush()?;
        Ok((stream.nodelay()?, parts.len()))
    });

    let mut client = TcpStream::connect(addr)?;
    let mut buf = [0_u8; 11];
    client.read_exact(&mut buf)?;

    let (nodelay, parts) = server.join().unwrap()?;
    println!("nodelay = {}", nodelay);
    println!("vectored parts = {}", parts);
    println!("client = {}", String::from_utf8_lossy(&buf));
    Ok(())
}`,
}
