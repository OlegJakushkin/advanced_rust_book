#[derive(Debug)]
struct Transcript {
    domain: &'static str,
    bytes: Vec<u8>,
}

impl Transcript {
    fn new(domain: &'static str) -> Self {
        Self {
            domain,
            bytes: domain.as_bytes().to_vec(),
        }
    }

    fn append_u64(&mut self, label: &str, value: u64) {
        self.bytes.extend_from_slice(label.as_bytes());
        self.bytes.extend_from_slice(&value.to_le_bytes());
    }

    fn challenge(&self) -> u64 {
        self.bytes.iter().fold(1_469_598_103_934_665_603_u64, |acc, byte| {
            acc.wrapping_mul(1_099_511_628_211).wrapping_add(*byte as u64)
        })
    }
}

fn challenge_for(domain: &'static str, public_total: u64, public_commitment: u64) -> u64 {
    let mut transcript = Transcript::new(domain);
    transcript.append_u64("public_total", public_total);
    transcript.append_u64("public_commitment", public_commitment);
    transcript.challenge()
}

fn main() {
    let domain = "billing-proof:v1";
    let prover_challenge = challenge_for(domain, 45, 9_001);
    let verifier_challenge = challenge_for(domain, 45, 9_001);
    let other_domain_challenge = challenge_for("inventory-proof:v1", 45, 9_001);

    println!("domain = {}", domain);
    println!("challenge match = {}", prover_challenge == verifier_challenge);
    println!("domain separation = {}", prover_challenge != other_domain_challenge);
}
