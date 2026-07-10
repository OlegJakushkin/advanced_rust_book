use tokio::sync::{mpsc, watch};

#[derive(Debug)]
enum InboundFrame {
    Text(String),
    Ping(u64),
    Close,
}

#[derive(Debug)]
enum OutboundFrame {
    Text(String),
    Pong(u64),
    Close,
}

#[tokio::main]
async fn main() {
    let (inbound_tx, mut inbound_rx) = mpsc::channel::<InboundFrame>(4);
    let (outbound_tx, mut outbound_rx) = mpsc::channel::<OutboundFrame>(4);
    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);

    let reader = tokio::spawn(async move {
        inbound_tx
            .send(InboundFrame::Text(String::from("ready")))
            .await
            .unwrap();
        inbound_tx.send(InboundFrame::Ping(7)).await.unwrap();
        inbound_tx.send(InboundFrame::Close).await.unwrap();
    });

    let app = tokio::spawn(async move {
        let mut inbound = 0_u32;

        while let Some(frame) = inbound_rx.recv().await {
            inbound += 1;

            match frame {
                InboundFrame::Text(text) => {
                    outbound_tx
                        .send(OutboundFrame::Text(format!("echo:{}", text)))
                        .await
                        .unwrap();
                }
                InboundFrame::Ping(nonce) => {
                    outbound_tx.send(OutboundFrame::Pong(nonce)).await.unwrap();
                }
                InboundFrame::Close => {
                    let _ = outbound_tx.send(OutboundFrame::Close).await;
                    shutdown_tx.send(true).unwrap();
                    break;
                }
            }
        }

        inbound
    });

    let writer = tokio::spawn(async move {
        let mut outbound = 0_u32;

        loop {
            tokio::select! {
                biased;
                Some(frame) = outbound_rx.recv() => {
                    match frame {
                        OutboundFrame::Text(_) | OutboundFrame::Pong(_) | OutboundFrame::Close => {
                            outbound += 1;
                        }
                    }
                }
                _ = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() {
                        while let Ok(frame) = outbound_rx.try_recv() {
                            match frame {
                                OutboundFrame::Text(_) | OutboundFrame::Pong(_) | OutboundFrame::Close => {
                                    outbound += 1;
                                }
                            }
                        }
                        break outbound;
                    }
                }
            }
        }
    });

    reader.await.unwrap();
    let inbound = app.await.unwrap();
    let outbound = writer.await.unwrap();

    println!("inbound = {}", inbound);
    println!("outbound = {}", outbound);
    println!("closed = {}", true);
}
