use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::watch;

async fn handle(mut stream: tokio::net::TcpStream) -> std::io::Result<()> {
    stream.write_all(b"pong\n").await?;
    Ok(())
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;
    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);

    let server = tokio::spawn(async move {
        let mut accepted = 0_usize;

        loop {
            tokio::select! {
                changed = shutdown_rx.changed() => {
                    if changed.is_err() || *shutdown_rx.borrow() {
                        break accepted;
                    }
                }
                result = listener.accept() => {
                    match result {
                        Ok((stream, _peer)) => {
                            accepted += 1;
                            tokio::spawn(handle(stream));
                        }
                        Err(_e) => {
                            break accepted;
                        }
                    }
                }
            }
        }
    });

    let client_a = tokio::spawn(async move {
        let mut stream = tokio::net::TcpStream::connect(addr).await.unwrap();
        let mut buf = [0_u8; 5];
        stream.read_exact(&mut buf).await.unwrap();
        String::from_utf8_lossy(&buf).trim().to_string()
    });

    let client_b = tokio::spawn(async move {
        let mut stream = tokio::net::TcpStream::connect(addr).await.unwrap();
        let mut buf = [0_u8; 5];
        stream.read_exact(&mut buf).await.unwrap();
        String::from_utf8_lossy(&buf).trim().to_string()
    });

    let a = client_a.await.unwrap();
    let b = client_b.await.unwrap();

    shutdown_tx.send(true).unwrap();
    let accepted = server.await.unwrap();

    println!("accepted = {}", accepted);
    println!("client_a = {}", a);
    println!("client_b = {}", b);
    Ok(())
}
