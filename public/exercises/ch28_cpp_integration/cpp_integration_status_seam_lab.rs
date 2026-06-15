// Status codes mirror the C ABI seam from the chapter: 0 = success,
// nonzero = a distinct failure the caller can branch on without a Result.
const STATUS_OK: i32 = 0;
const STATUS_NULL_OUT: i32 = 1;
const STATUS_NULL_INPUT: i32 = 2;

// Models the exported `sum_i32s` seam: the caller owns both the input buffer
// and the output storage; this function only borrows them for the call.
// Option<&...> stands in for a possibly-null pointer; &mut i64 is the out slot.
fn sum_i32s(input: Option<&[i32]>, out_total: Option<&mut i64>) -> i32 {
    // TODO: implement the guard sequence and the sum.
    // 1. If out_total is None, return STATUS_NULL_OUT.
    // 2. If input is None, return STATUS_NULL_INPUT.
    // 3. Otherwise widen each i32 to i64, sum them, write the total
    //    through the out parameter, and return STATUS_OK.
    let _ = (&input, &out_total);
    STATUS_OK
}

fn main() {
    let values = [3_i32, 4, 5];

    let mut total = -1_i64;
    let status = sum_i32s(Some(&values), Some(&mut total));
    println!("status = {}", status);
    println!("total = {}", total);

    let mut ignored = 0_i64;
    println!("null input status = {}", sum_i32s(None, Some(&mut ignored)));
    println!("null out status = {}", sum_i32s(Some(&values), None));
}
