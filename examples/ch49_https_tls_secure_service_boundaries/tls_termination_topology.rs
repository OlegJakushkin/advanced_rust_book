#[derive(Debug, Clone, Copy)]
enum TlsTermination {
    LoadBalancer,
    ReverseProxy,
    InProcess,
}

#[derive(Debug, Clone, Copy)]
enum PeerAuth {
    Off,
    Mtls,
}

#[derive(Debug)]
struct ServiceEdge {
    external_tls: TlsTermination,
    internal_peer_auth: PeerAuth,
    trusted_proxy_hops: u8,
    app_protocol: &'static str,
}

impl ServiceEdge {
    fn external_mode(&self) -> &'static str {
        match self.external_tls {
            TlsTermination::LoadBalancer => "load-balancer",
            TlsTermination::ReverseProxy => "reverse-proxy",
            TlsTermination::InProcess => "in-process",
        }
    }

    fn internal_mode(&self) -> &'static str {
        match self.internal_peer_auth {
            PeerAuth::Off => "tls-only",
            PeerAuth::Mtls => "mtls",
        }
    }

    fn forwarded_proto_policy(&self) -> &'static str {
        if self.trusted_proxy_hops > 0 {
            "trusted-proxy-only"
        } else {
            "ignore-forwarded-proto"
        }
    }

    fn alpn(&self) -> &'static str {
        self.app_protocol
    }
}

fn main() {
    let edge = ServiceEdge {
        external_tls: TlsTermination::LoadBalancer,
        internal_peer_auth: PeerAuth::Mtls,
        trusted_proxy_hops: 1,
        app_protocol: "h2",
    };

    println!("external = {}", edge.external_mode());
    println!("internal = {}", edge.internal_mode());
    println!("forwarded proto = {}", edge.forwarded_proto_policy());
    println!("alpn = {}", edge.alpn());
}
