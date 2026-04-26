export const DEFAULT_CODES_CH49: Record<string, string> = {
  https_tls_topology_policy: `#[derive(Debug, Clone, Copy)]
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
}`,
  https_tls_security_defaults: `#[derive(Debug)]
struct SessionCookiePolicy {
    name: &'static str,
    secure: bool,
    http_only: bool,
    same_site: &'static str,
}

impl SessionCookiePolicy {
    fn is_hardened(&self) -> bool {
        self.secure && self.http_only && self.same_site != "None"
    }
}

#[derive(Debug)]
struct HttpSecurityPolicy {
    redirect_http: bool,
    hsts_max_age_secs: u64,
    allowed_origin: &'static str,
    renew_before_days: u16,
}

impl HttpSecurityPolicy {
    fn cors_mode(&self) -> &'static str {
        if self.allowed_origin == "*" {
            "wildcard"
        } else {
            "locked-down"
        }
    }

    fn hsts_enabled(&self) -> bool {
        self.redirect_http && self.hsts_max_age_secs > 0
    }

    fn rotate_now(&self, days_left: u16) -> bool {
        days_left <= self.renew_before_days
    }
}

fn main() {
    let cookie = SessionCookiePolicy {
        name: "__Host-session",
        secure: true,
        http_only: true,
        same_site: "Lax",
    };

    let policy = HttpSecurityPolicy {
        redirect_http: true,
        hsts_max_age_secs: 63_072_000,
        allowed_origin: "https://app.example.com",
        renew_before_days: 14,
    };

    println!("cookie = {}", cookie.name);
    println!("cookie secure = {}", cookie.is_hardened());
    println!("cors = {}", policy.cors_mode());
    println!("hsts = {}", policy.hsts_enabled());
    println!("rotate now = {}", policy.rotate_now(21));
}`,
}
