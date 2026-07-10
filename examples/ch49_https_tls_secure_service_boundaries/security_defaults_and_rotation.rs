#[derive(Debug)]
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
        self.hsts_max_age_secs > 0
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
    println!("cookie hardened = {}", cookie.is_hardened());
    println!("cors = {}", policy.cors_mode());
    println!("hsts = {}", policy.hsts_enabled());
    println!("rotate now = {}", policy.rotate_now(21));
}
