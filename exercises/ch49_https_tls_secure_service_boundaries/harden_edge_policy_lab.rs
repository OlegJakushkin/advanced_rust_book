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
    let cookie = SessionCookiePolicy {
        name: "session",
        secure: false,
        http_only: false,
        same_site: "None",
    };

    let policy = HttpSecurityPolicy {
        redirect_http: false,
        hsts_max_age_secs: 0,
        allowed_origin: "*",
    };

    println!("redirect = {}", policy.redirect_http);
    println!("cookie hardened = {}", cookie.is_hardened());
    println!("cors = {}", policy.cors_mode());
    println!("hsts = {}", policy.redirect_http && policy.hsts_max_age_secs > 0);
}
