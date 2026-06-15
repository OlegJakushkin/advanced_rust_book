// A crate-free model of a Solana-style program over an external account buffer.
// State lives in the account's byte buffer; the program is stateless code that
// borrows the buffer, decodes a little-endian u64 by hand (as Borsh would),
// applies an instruction, validates, and writes the bytes back.

#[derive(Debug)]
enum Instruction {
    Increment,
    Add(u64),
}

#[derive(Debug)]
enum ProgramError {
    DataTooSmall,
    Overflow,
}

fn read_counter(data: &[u8]) -> Result<u64, ProgramError> {
    if data.len() < 8 {
        return Err(ProgramError::DataTooSmall);
    }
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&data[..8]);
    Ok(u64::from_le_bytes(bytes))
}

fn write_counter(data: &mut [u8], value: u64) -> Result<(), ProgramError> {
    if data.len() < 8 {
        return Err(ProgramError::DataTooSmall);
    }
    data[..8].copy_from_slice(&value.to_le_bytes());
    Ok(())
}

// Stateless entry point: decode, apply, validate against overflow, re-encode.
fn process_instruction(data: &mut [u8], instruction: &Instruction) -> Result<u64, ProgramError> {
    let current = read_counter(data)?;
    let next = match instruction {
        Instruction::Increment => current.checked_add(1),
        Instruction::Add(value) => current.checked_add(*value),
    };
    let next = next.ok_or(ProgramError::Overflow)?;
    write_counter(data, next)?;
    Ok(next)
}

fn main() {
    let mut data = [0u8; 8];

    let a = process_instruction(&mut data, &Instruction::Add(40)).unwrap();
    let b = process_instruction(&mut data, &Instruction::Increment).unwrap();

    // A hostile instruction that would overflow must be rejected, not wrap.
    let mut maxed = u64::MAX.to_le_bytes();
    let bad = process_instruction(&mut maxed, &Instruction::Increment);

    println!("after add = {}", a);
    println!("after increment = {}", b);
    println!("counter = {}", read_counter(&data).unwrap());
    println!("overflow rejected = {}", bad.is_err());
}
