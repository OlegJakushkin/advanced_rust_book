// A hand-built model of Solana's account + instruction model, no crates.
//
// On Solana a "program" is stateless code. The state it works on lives in
// separate "accounts" that the runtime passes in as mutable byte buffers.
// An instruction tells the program which operation to run and with what data.
//
// Here we model exactly that: an Account owns a data buffer and an owner
// field, process_instruction borrows the buffer mutably, decodes a u64
// counter by hand (the way Borsh would, little-endian), applies the op, and
// writes the counter back. main() drives a couple of instructions.

#[derive(Debug)]
struct Account {
    owner: &'static str,
    data: [u8; 8],
}

#[derive(Debug)]
enum Instruction {
    Increment,
    SetTo(u64),
}

#[derive(Debug)]
enum ProgramError {
    DataTooSmall,
}

// Decode the counter the way a by-hand Borsh reader would: a little-endian u64.
fn read_counter(data: &[u8]) -> Result<u64, ProgramError> {
    if data.len() < 8 {
        return Err(ProgramError::DataTooSmall);
    }
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&data[..8]);
    Ok(u64::from_le_bytes(bytes))
}

// Re-encode the counter back into the account buffer, little-endian.
fn write_counter(data: &mut [u8], value: u64) -> Result<(), ProgramError> {
    if data.len() < 8 {
        return Err(ProgramError::DataTooSmall);
    }
    data[..8].copy_from_slice(&value.to_le_bytes());
    Ok(())
}

// The "program entry point": stateless code over a mutable account buffer.
fn process_instruction(data: &mut [u8], instruction: &Instruction) -> Result<u64, ProgramError> {
    let current = read_counter(data)?;
    let next = match instruction {
        Instruction::Increment => current + 1,
        Instruction::SetTo(value) => *value,
    };
    write_counter(data, next)?;
    Ok(next)
}

fn main() {
    let mut account = Account {
        owner: "CounterProgram1111",
        data: [0u8; 8],
    };

    // The runtime hands the program a mutable view of account data each call.
    let after_set = process_instruction(&mut account.data, &Instruction::SetTo(41)).unwrap();
    let after_inc = process_instruction(&mut account.data, &Instruction::Increment).unwrap();

    let final_counter = read_counter(&account.data).unwrap();

    println!("after set = {}", after_set);
    println!("after increment = {}", after_inc);
    println!("counter = {}", final_counter);
    println!("owner = {}", account.owner);
}
