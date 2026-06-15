"use client"

// Chapter 19 · exercise workbook page (ch19-serialization-and-data-contracts-exercises).
// Exercise data consumed by the workbook PDF builder
// (exports/extract_chapter_prose.py reads the const blocks and the
// RustPracticeCard below). Not yet wired into app navigation; wiring
// requires lockstep edits to types.ts / index.ts / index.tsx.
// Intended component name: PageCh19SerializationAndDataContractsExercises

export {}

/*
interface Exercise {
  number: number
  kind: string
  title: string
  objective: string
  starterPrompt: string
  prompts?: string[]
  acceptanceCriteria: string[]
  hints: string[]
}

const exercises: Exercise[] = [
  {
    number: 1,
    kind: "warm-up comprehension",
    title: "Separate the domain model from the wire DTO",
    objective: "Explain why this chapter keeps internal domain types distinct from wire-facing DTOs and what that buys during schema evolution.",
    starterPrompt: "The chapter argues that an aggregate may want one shape while a public event or API contract wants another, and that Serde makes the conversion pleasant so you do not force one type to do both jobs badly. Reason about why that boundary matters before any bytes are written.",
    prompts: [
      "State in one sentence what a 'data contract' is for a service boundary, distinct from the in-memory model.",
      "Give two concrete pressures that push the wire shape and the domain shape in different directions.",
      "Describe what goes wrong if a single struct serves both the public API and the internal aggregate.",
      "Name where custom representation logic (decimal money text, legacy booleans) should live and why.",
    ],
    acceptanceCriteria: [
      "The answer defines a contract as the agreed external shape of the bytes, not the internal type layout.",
      "At least two divergent pressures (evolution cadence, human readability, payload size, compatibility) are named.",
      "The answer states that custom representation belongs at the serialization edge, not in the domain type.",
      "The answer explains that coupling the two types lets one old wire compromise contaminate the core model.",
    ],
    hints: [
      "Re-read the passage on keeping the internal unit cheap and precise, then translating at serialization time.",
      "Think about which side you can redeploy independently when the contract changes.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace the versioned event envelope",
    objective: "Read the versioned envelope listing and account for how tagging and versioning survive a JSON round trip.",
    starterPrompt: "Study the EventEnvelope and OrderEvent listing where the inner enum is internally tagged with #[serde(tag = \"kind\", rename_all = \"snake_case\")] and the envelope carries an explicit schema_version plus a #[serde(default)] trace_id. Trace one round trip by hand.",
    prompts: [
      "Write the JSON that serializing the OrderEvent::Created variant produces, including the \"kind\" tag.",
      "Explain what the internal tag lets a reader do that field-shape inference would not.",
      "Describe what #[serde(default)] on trace_id means for a payload that omits that field entirely.",
      "Identify which fields carry version and identity information across the boundary.",
    ],
    acceptanceCriteria: [
      "The reconstructed JSON places \"kind\":\"created\" inside the payload object alongside the variant's fields.",
      "The answer states the tag lets the reader dispatch on variant without guessing from present fields.",
      "The answer explains that a missing trace_id deserializes to None rather than failing.",
      "schema_version and event_id are correctly identified as the version and identity carriers.",
    ],
    hints: [
      "rename_all = \"snake_case\" controls the tag string value, so Created becomes \"created\".",
      "Internal tagging stores the discriminant in a key inside the same JSON object.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Add a forward-compatible optional field",
    objective: "Evolve the event envelope by adding an optional field that old readers can ignore and new readers can default.",
    starterPrompt: "The chapter states that adding an optional field with a default is invisible to existing readers, and that readers should survive additive fields and tolerate missing optional fields. Extend EventEnvelope with a new optional field under that discipline.",
    prompts: [
      "Add an optional field such as source_service: Option<String> with #[serde(default)] to EventEnvelope.",
      "Construct one new-format envelope that sets the field and one old-format JSON string that omits it.",
      "Deserialize both and confirm the omitted case yields None without error.",
      "State which direction of compatibility (forward, backward, both) this change preserves and why.",
    ],
    acceptanceCriteria: [
      "The new field is Option<T> and annotated so a missing key deserializes successfully.",
      "An old-format payload lacking the field round-trips into a value with the field set to None.",
      "A new-format payload sets and recovers the field correctly.",
      "The answer correctly classifies the change as additive and compatible in both directions (forward: old readers survive new writers; backward: new readers survive old writers).",
    ],
    hints: [
      "#[serde(default)] supplies Option::default(), which is None, when the key is absent.",
      "Test the old-reader case by deserializing JSON that simply never mentions the new key.",
    ],
  },
  {
    number: 4,
    kind: "implementation",
    title: "Write a money codec that does not lose cents",
    objective: "Implement a custom serialize and deserialize pair for an integer cents amount represented on the wire as decimal text.",
    starterPrompt: "The chapter warns that naive split-on-dot money parsing is a correctness trap: a reader that accepts \"12.5\" as 1205 cents has silently lost money. Mirror the cents_as_decimal and decimal_as_cents functions and harden the fractional-digit handling.",
    prompts: [
      "Serialize an amount_cents: u64 as a decimal string with exactly two fractional digits.",
      "Deserialize by splitting on the dot and validating that the fractional part is exactly two digits.",
      "Reject inputs like \"12.5\" or \"12.500\" with a clear error rather than a wrong amount.",
      "Confirm that \"12.50\" round-trips to 1250 cents and back to \"12.50\".",
    ],
    acceptanceCriteria: [
      "Serialization formats 1250 cents as exactly \"12.50\".",
      "Deserialization rejects a fractional part whose length is not exactly two digits.",
      "\"12.50\" deserializes to 1250 and re-serializes to the identical string.",
      "Parse failures surface as a deserialization error, not a panic or a silently wrong value.",
    ],
    hints: [
      "format!(\"{}.{:02}\", value / 100, value % 100) gives the two-digit fractional part.",
      "Check cents.len() == 2 before parsing, exactly as the chapter listing does.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Fix a borrowed field that escapes its buffer",
    objective: "Diagnose and repair a zero-copy deserialization design where a borrowed view is held past the lifetime of its input bytes.",
    starterPrompt: "The chapter's rule is to borrow while parsing if it reduces copying locally, but own the data once the message crosses a wider subsystem boundary, because a borrowed &str or Cow<'de, str> cannot outlive the buffer it points into. Start from this broken function that parses a local buffer and tries to return the borrowing struct:\n\n    fn parse(bytes: &[u8]) -> BorrowedAudit<'_> {\n        let text = String::from_utf8(bytes.to_vec()).unwrap(); // local buffer\n        serde_json::from_str(&text).unwrap() // borrows `text`, dropped on return\n    }\n\nThis does not compile: the returned struct borrows `text`, which is dropped when the function returns.",
    prompts: [
      "Explain the compiler error that arises when a function parses a local buffer and returns the borrowing struct.",
      "Decide which fields genuinely need zero-copy borrowing on the hot path and which should own.",
      "Refactor so the value that crosses the boundary owns its strings (for example via Cow into_owned or String).",
      "State the operational rule in one sentence: when to borrow and when to own.",
    ],
    acceptanceCriteria: [
      "The diagnosis names the buffer outliving issue: the borrow cannot exceed the input's lifetime.",
      "The refactor produces an owned type at the boundary so the buffer can be dropped safely.",
      "The hot-path parse may still borrow internally before the conversion to owned.",
      "The stated rule distinguishes local parsing from values crossing a wider boundary.",
    ],
    hints: [
      "Cow<'a, str> exposes into_owned() to convert a borrowed view into an owned String.",
      "A function that drops its buffer on return must not hand back anything that borrows from it.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Plan a mixed-version producer-consumer rollout",
    objective: "Design a deployment-safe schema change for an event stream where producers and consumers deploy on independent schedules.",
    starterPrompt: "The chapter frames a compatibility break as a deployment coordination problem, not only a code change, and warns that the most expensive serialization bug is silent contract drift that still compiles and deploys. Plan a rename plus a new required-looking field for the order event stream.",
    prompts: [
      "Lay out the rollout order for producers and consumers so no instant has a reader that cannot parse a live message.",
      "Explain how a field rename is made safe using a retained deprecated alias during the drain window.",
      "Decide how schema_version, tests, and logs make the version boundary visible before mixed versions meet.",
      "Describe how separating domain type from wire DTO with explicit conversion contains the blast radius.",
    ],
    acceptanceCriteria: [
      "The plan deploys tolerant readers before producers emit the new shape, so old and new coexist.",
      "The rename keeps a deprecated alias readable until old producers are fully drained.",
      "The version boundary is surfaced in data (schema_version), tests, and logs before rollout.",
      "The design routes compatibility work through an explicit DTO-to-domain conversion layer.",
    ],
    hints: [
      "The safe moves are the ones an old reader can survive without being redeployed first.",
      "An alias drained over a release window lets you delete the old name only once no producer uses it.",
    ],
  },
]

const reviewQuestions = [
  "Which schema changes are invisible to an existing reader, and which require the reader to be redeployed first?",
  "What does internal enum tagging (#[serde(tag = \"kind\")]) give a reader that field-shape inference does not?",
  "Why must a borrowed &str or Cow<'de, str> field not outlive the input buffer it was parsed from?",
  "Why is split-on-dot money parsing a correctness trap, and what validation prevents silently losing cents?",
  "Why is a compatibility break a deployment coordination problem rather than only a code change?",
  "Why must you never let Rust's in-memory struct layout serve as an FFI contract by default, and what are the two safe alternatives?",
]

const workingLoop = [
  "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
  "Write the smallest version that compiles, then make it correct.",
  "Check each acceptance criterion explicitly before moving on.",
  "Name one tradeoff or failure mode your solution accepts.",
]

<RustPracticeCard
  title={"Runnable lab · version-tolerant record decoding"}
  filename="versioned_record_lab.rs"
  runKey="ch19_ex_versioned"
  expectedOutput={"v2 currency = EUR\nv2 round trip ok = true\nv1 schema = 1\nv1 currency = USD\nv1 total cents = 999"}
  helperText={"Models forward/backward-compatible decoding in plain std Rust: a tagged key=value payload where a v2 reader defaults the added currency field for v1 input and silently ignores fields it does not recognize. Fill in the decode match arm."}
  initialCode={`//! Forward/backward-compatible decoding of a versioned record.

#[derive(Debug, PartialEq)]
struct Record {
    schema_version: u16,
    order_id: String,
    total_cents: u64,
    // Added in schema version 2. Old (v1) writers do not emit it.
    currency: String,
}

/// Encode a record as a tagged, line-oriented byte payload.
fn encode(rec: &Record) -> Vec<u8> {
    let body = format!(
        "v={};order_id={};total_cents={};currency={}",
        rec.schema_version, rec.order_id, rec.total_cents, rec.currency
    );
    body.into_bytes()
}

/// Decode a payload tolerantly: unknown fields are skipped, and a missing
/// \`currency\` field defaults so a v2 reader can still consume a v1 payload.
fn decode(bytes: &[u8]) -> Record {
    let text = String::from_utf8(bytes.to_vec()).unwrap();
    let mut schema_version = 0u16;
    let mut order_id = String::new();
    let mut total_cents = 0u64;
    let mut currency = String::from("USD");

    for field in text.split(';') {
        let (key, _value) = match field.split_once('=') {
            Some(pair) => pair,
            None => continue,
        };
        match key {
            // TODO: match each known key and assign its parsed value.
            // Leave currency at its default when the field is absent, and
            // ignore any key the reader does not recognize.
            _ => {}
        }
    }

    Record { schema_version, order_id, total_cents, currency }
}

fn main() {
    let v2 = Record {
        schema_version: 2,
        order_id: String::from("ord-7"),
        total_cents: 4200,
        currency: String::from("EUR"),
    };
    let round_trip = decode(&encode(&v2));
    println!("v2 currency = {}", round_trip.currency);
    println!("v2 round trip ok = {}", round_trip == v2);

    // A v1 producer omits \`currency\` and adds a field the reader has not seen.
    let v1_payload = b"v=1;order_id=ord-3;total_cents=999;region=eu";
    let upgraded = decode(v1_payload);
    println!("v1 schema = {}", upgraded.schema_version);
    println!("v1 currency = {}", upgraded.currency);
    println!("v1 total cents = {}", upgraded.total_cents);
}
`}
/>
*/
