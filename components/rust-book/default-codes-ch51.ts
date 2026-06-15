export const DEFAULT_CODES_CH51: Record<string, string> = {
  zkp_statement_witness_proof: `#[derive(Debug, Clone, Copy)]
struct Statement {
    public_total: u64,
    public_limit: u64,
}

#[derive(Debug, Clone, Copy)]
struct Witness {
    left: u64,
    right: u64,
}

#[derive(Debug, Clone, Copy)]
struct ProofArtifact {
    public_total: u64,
    public_limit: u64,
    proof_bytes_len: usize,
}

fn prove(statement: Statement, witness: Witness) -> Result<ProofArtifact, &'static str> {
    if witness.left + witness.right != statement.public_total {
        return Err("sum constraint failed");
    }

    if statement.public_total > statement.public_limit {
        return Err("public statement not admissible");
    }

    Ok(ProofArtifact {
        public_total: statement.public_total,
        public_limit: statement.public_limit,
        proof_bytes_len: 96,
    })
}

fn verify(statement: Statement, proof: ProofArtifact) -> bool {
    // Minimal demo: we only re-check the public fields and that proof bytes
    // exist. In a real system the proof bytes themselves encode the
    // total <= limit constraint, so the verifier does not re-run it here.
    // (The lab adds an explicit total <= limit guard as a belt-and-braces check.)
    statement.public_total == proof.public_total
        && statement.public_limit == proof.public_limit
        && proof.proof_bytes_len > 0
}

fn main() {
    let statement = Statement {
        public_total: 45,
        public_limit: 50,
    };
    let witness = Witness { left: 20, right: 25 };
    let proof = prove(statement, witness).unwrap();

    println!("public total = {}", statement.public_total);
    println!("proof bytes = {}", proof.proof_bytes_len);
    println!("verified = {}", verify(statement, proof));
}`,
  zkp_transcript_domain_separation: `#[derive(Debug)]
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
        // Toy polynomial accumulator, not FNV-1a (which would XOR before
        // multiplying); domain separation still holds. Never use this for
        // real challenge derivation.
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
}`,
}
