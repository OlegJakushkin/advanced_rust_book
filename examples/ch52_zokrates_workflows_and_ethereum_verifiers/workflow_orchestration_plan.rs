use std::path::PathBuf;

#[derive(Debug, Clone)]
struct Invocation {
    stage: &'static str,
    program: &'static str,
    args: Vec<String>,
    artifact: PathBuf,
}

fn plan_for(circuit: &str, witness_args: &[&str]) -> Vec<Invocation> {
    let compiled = format!("artifacts/{}", circuit);
    vec![
        Invocation {
            stage: "compile",
            program: "zokrates",
            args: vec![
                "compile".into(),
                "-i".into(),
                format!("{}.zok", circuit),
                "-o".into(),
                compiled.clone(),
            ],
            artifact: PathBuf::from(&compiled),
        },
        Invocation {
            stage: "setup",
            program: "zokrates",
            args: vec!["setup".into(), "-i".into(), compiled.clone()],
            artifact: PathBuf::from("artifacts/proving.key"),
        },
        Invocation {
            stage: "compute-witness",
            program: "zokrates",
            args: {
                let mut args = vec![
                    "compute-witness".into(),
                    "-i".into(),
                    compiled.clone(),
                    "-a".into(),
                ];
                args.extend(witness_args.iter().map(|value| value.to_string()));
                args
            },
            artifact: PathBuf::from("artifacts/witness"),
        },
        Invocation {
            stage: "generate-proof",
            program: "zokrates",
            args: vec!["generate-proof".into(), "-i".into(), compiled.clone()],
            artifact: PathBuf::from("artifacts/proof.json"),
        },
        Invocation {
            stage: "export-verifier",
            program: "zokrates",
            args: vec!["export-verifier".into(), "-i".into(), compiled.clone()],
            artifact: PathBuf::from("artifacts/AgeCheckVerifier.sol"),
        },
        Invocation {
            stage: "verify",
            program: "zokrates",
            args: vec!["verify".into(), "-i".into(), compiled],
            artifact: PathBuf::from("artifacts/verify.log"),
        },
    ]
}

fn render(invocation: &Invocation) -> String {
    format!("{} {}", invocation.program, invocation.args.join(" "))
}

fn main() {
    let plan = plan_for("age_check", &["18", "21"]);

    println!("steps = {}", plan.len());
    println!("compile = {}", render(&plan[0]));
    println!("proof = {}", render(&plan[3]));
    println!("contract = {}", plan[4].artifact.display());
}
