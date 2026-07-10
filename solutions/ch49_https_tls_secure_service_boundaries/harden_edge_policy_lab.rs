#[derive(Debug)]
struct SessionCookiePolicy {
    name: &'static str,
    secure: bool,
    http_only: bool,
    same_site: &'static str,
}

#[derive(Debug)]
struct HttpSecurityPolicy {
    redirect_http: bool,
    hsts_max_age_secs: u64,
    allowed_origin: &'static str,
}

impl SessionCookiePolicy {
    fn is_hardened(&self) -> bool {
        self.secure && self.http_only && self.same_site != "None"
    }
}

impl HttpSecurityPolicy {
    fn cors_mode(&self) -> &'static str {
        if self.allowed_origin == "*" {
            "wildcard"
        } else {
            "locked-down"
        }
    }
}

fn main() {
    // Hardened session cookie: Secure + HttpOnly, and SameSite is no longer
    // "None". The "__Host-" prefix is honored only when the cookie is Secure,
    // has Path=/, and carries no Domain, so the name encodes part of the policy.
    let cookie = SessionCookiePolicy {
        name: "__Host-session",
        secure: true,
        http_only: true,
        same_site: "Lax",
    };

    // Hardened transport policy: HTTP is redirected to HTTPS, a non-zero HSTS
    // max-age pins the browser to HTTPS, and the CORS origin is one exact host
    // instead of the wildcard "*".
    let policy = HttpSecurityPolicy {
        redirect_http: true,
        hsts_max_age_secs: 63_072_000, // two years
        allowed_origin: "https://app.example.com",
    };

    println!("redirect = {}", policy.redirect_http);
    println!("cookie hardened = {}", cookie.is_hardened());
    println!("cors = {}", policy.cors_mode());
    println!(
        "hsts = {}",
        policy.redirect_http && policy.hsts_max_age_secs > 0
    );
}
