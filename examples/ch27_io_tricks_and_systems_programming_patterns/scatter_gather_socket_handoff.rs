use std::io::{self, IoSlice, Read, Write};
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
}
