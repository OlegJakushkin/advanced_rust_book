#[derive(Debug, Clone, Copy)]
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
}
