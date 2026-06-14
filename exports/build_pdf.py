# -*- coding: utf-8 -*-
"""Render Advanced Rust chapters 1 & 2 as an O'Reilly-style PDF.

Content lives here; all styling/highlighting/page-furniture comes from the
`oreilly-book-pdf` skill engine (.claude/skills/oreilly-book-pdf/).
"""
import os, sys

SKILL_SCRIPTS = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             "..", ".claude", "skills", "oreilly-book-pdf", "scripts")
sys.path.insert(0, os.path.abspath(SKILL_SCRIPTS))
from oreilly_pdf import *  # noqa

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Rust source samples (flush-left so indentation is exact)
# ---------------------------------------------------------------------------
CODE_PIPELINE = """fn critical_count(readings: &[i32], threshold: i32) -> usize {
    readings
        .iter()
        .copied()
        .filter(|reading| *reading >= threshold)
        .count()
}

fn main() {
    let readings = vec![42, 87, 91, 63, 99];
    let count = critical_count(&readings, 80);
    println!("critical count = {}", count);
}"""

CODE_THREAD = """use std::thread;

fn main() {
    let job = String::from("rebuild-search-index");

    let handle = thread::spawn(move || {
        println!("worker started: {}", job);
    });

    handle.join().unwrap();
}"""

CODE_MOVE_DROP = """struct FileHandle {
    name: String,
}

impl Drop for FileHandle {
    fn drop(&mut self) {
        println!("drop {}", self.name);
    }
}

fn ship(handle: FileHandle) {
    println!("shipping {}", handle.name);
}

fn main() {
    let handle = FileHandle {
        name: String::from("audit.log"),
    };

    println!("before move");
    ship(handle);
    println!("after ship");
}"""

CODE_BLOCKS_HEAP = """fn main() {
    let queue_depth = 2048;

    let status = if queue_depth > 1024 { "hot" } else { "steady" };

    let labels = {
        let mut labels = Vec::with_capacity(8);
        labels.push(String::from("ingest"));
        labels.push(String::from("priority"));
        labels
    };

    let capacity = {
        let heap_slots = labels.capacity();
        heap_slots
    };

    println!("status = {}", status);
    println!("capacity = {}", capacity);
}"""

CODE_PARSE_LIMIT = """fn parse_limit(input: Option<&str>) -> Result<usize, &'static str> {
    match input {
        None => Ok(0),
        Some(raw) => match raw.parse::<usize>() {
            Ok(limit) => Ok(limit),
            Err(_) => Err("invalid number"),
        },
    }
}

fn main() {
    println!("default = {:?}", parse_limit(None));
    println!("zero = {:?}", parse_limit(Some("0")));
    println!("value = {:?}", parse_limit(Some("25")));
}"""

CODE_CLASSIFY = """fn classify(depth: usize) -> (&'static str, usize) {
    let mut scaled = 0;

    if depth > 1000 {
        scaled = depth / 2;
        return ("hot", scaled);
    }

    scaled = depth + 50;
    ("steady", scaled)
}

fn main() {
    let (status_a, value_a) = classify(120);
    let (status_b, value_b) = classify(1200);
    println!("{} {}", status_a, value_a);
    println!("{} {}", status_b, value_b);
}"""

# ---------------------------------------------------------------------------
# Local helpers for content shapes the generic engine doesn't cover directly
# ---------------------------------------------------------------------------
def li_bold(term, rest):
    return f"<li><strong>{esc(term)}</strong> {ic(rest)}</li>"

def bold_list(pairs):
    return '<ul class="list">' + "".join(li_bold(t, r) for t, r in pairs) + "</ul>"

def concept_block(title, text, code, note):
    return (f'<div class="block"><span class="block-t">{ic(title)}</span>'
            f'<p>{ic(text)}</p>{snippet(code, note)}</div>')

def expr_block(code, text):
    return f'<div class="block">{snippet(code)}<p>{ic(text)}</p></div>'

P = []

# ===========================================================================
# CHAPTER 1
# ===========================================================================
P.append(chapter_open("Chapter 1 · Why Rust Feels Different", "Why Rust Feels Different",
    "Production Rust is valuable because ownership, failure handling, concurrency, and deployment rules become explicit contracts that teams can review before release."))

P.append(section("Opening scenario"))
P.append(body("A payments platform is moving latency-sensitive services to Rust after repeated incidents in resource ownership, failure recovery, and concurrent state updates. The business requirement is direct: make ownership, mutation authority, and fallibility explicit enough for release review before the system grows."))
P.append(sidebar("What Rust is asking you to state up front", ulist([
    "Name the owner of the data or resource.",
    "Say whether the next step only borrows, mutates exclusively, or takes ownership outright.",
    "Make fallibility and concurrency visible where the boundary actually changes.",
])))
P.append(sidebar("A reading checklist", olist([
    "Who owns the data or resource after this line?",
    "Does the next step need read-only access, exclusive mutation, or full ownership?",
    "Is fallibility visible in the signature or hidden in control flow?",
    "If concurrency appears, is the boundary message passing, shared immutable state, or synchronized shared mutation?",
])))

P.append(section("Mental model"))
P.append(body("Rust is not “C++ with a stricter compiler,” “C# without a GC,” or “Go with harder syntax.” The operational model is different: values have owners, borrows describe temporary access, and APIs must state whether they transfer responsibility, share read access, or require exclusive mutation."))
P.append(bold_list([
    ("Ownership", "says who is responsible for cleanup."),
    ("Borrowing", "says who may access a value temporarily."),
    ("Traits", "describe behavior; generics usually compile via monomorphization rather than dynamic dispatch."),
    ("Thread boundaries", "carry trait requirements like `Send` and `Sync`."),
]))

P.append(section("Core concepts"))
P.append(group([
    block("Rust’s core promise: control without unsafety by default",
          "Rust wants C-like control over layout, allocation, and destruction while keeping memory unsafety out of ordinary code. Safe Rust rules out use-after-free, double-free, and data races in the safe subset. When low-level work truly needs escape hatches, you use `unsafe` in small, auditable regions and document the invariants there."),
    block("Zero-cost abstractions in practice",
          "“Zero-cost” does not mean “free magic.” It means abstractions do not inherently add overhead relative to a hand-written equivalent. Iterator pipelines, enums, and generics often compile to code close to an explicit loop. Traits become dynamic only when you opt into trait objects; otherwise, generic code is usually monomorphized."),
    block("The senior-developer Rust learning curve",
          "The learning curve is mostly architectural, not syntactic. Rust pushes design choices earlier: where is ownership transferred, which references may outlive which scopes, which types are allowed across threads, and where should cloning be explicit? Later chapters go deeper on borrowing, traits, and async, but this chapter’s goal is to make the early discomfort interpretable."),
    block("Rust compared with C++, C#, and Go",
          "The most useful comparison is not syntax. It is where each language places trust: C++ trusts discipline around aliasing, C# trusts a managed runtime, Go trusts a runtime plus simplified concurrency primitives, and Rust spends more compile time to reduce what must be trusted in production."),
], cols=2))

P.append(sub("Comparison callout: what changes by background"))
P.append(group([
    block("C++ background", "RAII and move semantics carry over, but Rust turns aliasing and mutation rules into ordinary API design instead of team discipline. The biggest shift is not syntax. It is that the compiler now participates in resource-protocol review."),
    block("C# background", "Rust trades runtime-managed convenience for deterministic destruction and explicit fallibility. The design question moves earlier: who owns this resource, and what does the caller have to prove before using it?"),
    block("Go background", "Rust keeps the lightweight service instinct but removes much of the ambient trust around shared state and cross-thread ownership. Message passing, queues, and worker handoff still exist; the ownership contract just becomes explicit."),
], cols=3))

P.append(sub("Why this feels slower before it feels faster"))
P.append(group([
    block("The friction is concentrated at boundaries", "Small expressions are rarely the expensive part of learning Rust. APIs, shared state, queues, and worker handoff are where the language insists that ownership, mutation, and lifetime become explicit."),
    block("Your old instincts still help, but they need a new ordering", "C++ instincts help with layout and RAII, C# instincts help with modeling, and Go instincts help with service decomposition. Rust’s extra question is always: who owns this value right now, and who owns it after the next call?"),
    block("Compiler feedback is early architectural feedback", "A rejected ownership design is often cheaper than a late production incident. Rust surfaces protocol mistakes while the code is still small enough to reshape confidently."),
], cols=3))

_left = '<div class="col-lbl">Usually compile time</div>' + ulist([
    "Move-after-use and many lifetime mistakes",
    "Overlapping mutable borrows",
    "Thread-boundary safety via trait bounds",
    "Missing exhaustiveness in pattern matching",
], tight=True)
_right = '<div class="col-lbl">Still runtime work</div>' + ulist([
    "Allocation, syscalls, and network failures",
    "Bounds checks when data-dependent",
    "Parsing invalid input and I/O availability",
    "Contention, cache misses, and real performance costs",
], tight=True)
P.append(sidebar("Compile-time guarantees vs runtime checks", two_col(_left, _right)))

P.append(sub("Reading compiler errors productively"))
P.append(olist([
    "Read the violated rule first, not just the red text.",
    "Find the origin span: where was the move, borrow, or trait bound introduced?",
    "Change ownership shape before changing syntax.",
    "Only clone or heap-share after deciding that duplication or sharing is actually correct.",
]))
P.append(sidebar("A practical reading loop", olist([
    "Name the violated rule first: move, borrow exclusivity, trait bound, lifetime relationship, or exhaustiveness.",
    "Find the first ownership mistake, not only the last line the compiler highlighted.",
    "Rewrite the ownership story in plain English before editing the code.",
    "Then choose the repair deliberately: borrow, return ownership, shorten scope, clone on purpose, or change the boundary.",
])))

P.append(group([
    diag_block("error[E0382]", "borrow of moved value",
        "Ownership already moved, so this binding is no longer the one allowed to use the value.",
        "Decide whether the boundary should borrow, return ownership, or clone deliberately. The repair is about API shape before it is about syntax."),
    diag_block("error[E0499]", "cannot borrow as mutable more than once",
        "Rust is protecting exclusive mutation. Two active mutable paths to the same state would violate Rust’s exclusive-mutation rule.",
        "Shorten the first borrow, split the state, or centralize mutation in one owner instead of working around the borrow checker."),
    diag_block("error[E0277]", "type cannot be sent between threads safely",
        "The thread boundary demands stronger guarantees than the captured type can currently provide.",
        "Move owned data, share immutable data via shared references, or introduce a thread-safe ownership model such as Arc at the boundary that actually needs it."),
], cols=3))

P.append(section("Production patterns"))
P.append(group([plain_block(x) for x in [
    "Turn parse-time bytes into owned domain values before queue, task, or thread boundaries where the caller can no longer guarantee lifetime.",
    "Use borrowing for narrow read paths, not as a way to carry request-local state deeper into the system than it belongs.",
    "Prefer enums, Result, and explicit ownership transitions over sentinel values, ambient mutation, or class-shaped state machines.",
    "Start concrete, then generalize only after the second real implementation or boundary appears.",
]], cols=2))

P.append(section("Pitfalls and tradeoffs"))
P.append(group([plain_block(x) for x in [
    "Cloning to quiet the borrow checker before deciding whether the callee needed ownership at all.",
    "Recreating inheritance or shared-mutable object graphs when a struct, enum, or one-owner workflow would have fit the problem better.",
    "Wrapping broad state in `Arc<Mutex<T>>` as the first move instead of deciding who should own mutation.",
    "Treating 'zero-cost abstraction' like 'zero work.' Iteration, hashing, parsing, allocation, and contention still cost what they cost.",
]], cols=2))
P.append(admonition("A borrow-checker error is not an obstacle to work around. It is exposing an ownership protocol you have not stated clearly enough yet. Treat that as design feedback, especially in production code.", "warn"))

P.append(section("Examples"))
P.append(example("1-1", "zero_cost_pipeline.rs", "an iterator pipeline with no extra abstraction tax",
                 CODE_PIPELINE, output="critical count = 3"))
P.append(admonition("Confirm the baseline output, then change the threshold or the input data and note how the pipeline stays readable while the result stays correct. The CPU still walks the slice, evaluates the predicate, branches, and counts matches — zero-cost abstractions remove abstraction tax, not the cost of real work.", "tip", label="Try it"))
P.append(example("1-2", "ownership_thread_handoff.rs", "ownership handoff into a worker thread",
                 CODE_THREAD, output="worker started: rebuild-search-index"))
P.append(admonition("The `move` closure consumes captured non-`Copy` data so the worker owns what it needs, which makes the handoff explicit instead of leaving lifetime questions to convention. Queues, threads, and async tasks are all ownership boundaries: borrow locally when you can, but hand off owned work items when execution may outlive the current scope.", "note"))

P.append(section("Summary"))
P.append(ulist([
    "Rust feels different because it makes resource protocols part of the type-checked API instead of part of team folklore.",
    "The goal is not abstract safety rhetoric. It is earlier feedback on ownership, mutation, and thread-boundary mistakes.",
    "Zero-cost abstractions remove abstraction tax, not the real cost of parsing, allocation, synchronization, or IO.",
    "Once you can read compiler errors as design notes, later chapters get much easier to use well.",
]))
P.append(CHAPTER_CLOSE)

# ===========================================================================
# CHAPTER 1 — EXERCISES
# ===========================================================================
P.append(chapter_open("Chapter 1 · Exercises", "Chapter 01 Exercises",
    "Exercises to turn “Rust feels strict” into a repeatable review habit around ownership, diagnostics, and production design."))
P.append(sidebar("How to use this page",
    f'<p>{ic("These exercises are intentionally solution-free in the repository. Treat the objective, starter prompt, acceptance criteria, and hints as a working spec. Aim for explicit ownership choices, concrete tradeoff language, and short architectural explanations another senior engineer could review quickly.")}</p>'))
P.append(sidebar("Suggested working loop", olist([
    "Restate the exercise in ownership language before you write code.",
    "Decide whether the boundary wants borrowing, ownership transfer, or explicit cloning.",
    "Work the lab, then explain the result by naming the ownership or borrowing rule involved.",
    "Write down one tradeoff you accepted: allocation, duplication, indirection, or API complexity.",
])))

P.append(exercise(1, "warm-up comprehension", "Translate a familiar lifecycle pattern into Rust",
    "Map one resource-management idea from C++, C#, or Go to idiomatic Rust ownership and cleanup semantics.",
    "Choose one familiar lifecycle pattern and restate it as a Rust ownership design for a resource owner named `Session` or `LogWriter`.",
    ["Start from a single owner that is responsible for cleanup.",
     "Decide which methods should take `&self`, which should take `&mut self`, and which should consume `self`.",
     "Explain where deterministic cleanup happens and why it does not depend on a garbage collector or inheritance."],
    ["Your design identifies a single owner responsible for cleanup.",
     "You explain why borrowed methods do or do not allow mutation.",
     "Cleanup is deterministic and does not rely on a garbage collector or inheritance."],
    ["Think in terms of a struct plus methods, not a class hierarchy.",
     "If cleanup must always happen, describe the role of Drop even if you do not fully implement it yet."]))

P.append(exercise(2, "code reading", "Find the zero-cost part and the real runtime cost",
    "Identify which parts of a Rust abstraction are compile-time structure and which parts still do real work at runtime.",
    "Study an iterator-based function that filters high-priority jobs from a slice, then annotate which parts are compile-time abstraction structure and which parts still cost CPU cycles.",
    ["Call out which parts are likely monomorphized or optimized as abstraction structure.",
     "List the runtime work that still exists: iteration, branching, cache behavior, and any downstream materialization cost.",
     "Explain where dynamic dispatch would appear if the return type changed to a trait object."],
    ["You identify iterator adapters and impl Iterator as abstraction mechanisms that do not imply dynamic dispatch by default.",
     "You name the runtime work that still exists: iteration, branching, cache behavior, and any downstream allocation if materialized.",
     "You explain that a trait object would opt into dynamic dispatch."],
    ["Separate 'how the code is expressed' from 'what the machine still has to do.'",
     "Look for where values are actually stored, allocated, or compared."]))

P.append(exercise(3, "implementation", "Make fallibility explicit instead of implicit",
    "Replace a sentinel-value style API with Rust’s explicit Option and Result modeling.",
    "Implement `parse_limit(input: Option<&str>) -> Result<usize, &'static str>` so missing input uses the default value `100`, `\"0\"` is invalid, non-numeric input is invalid, and valid positive integers return `Ok(limit)`.",
    ["Do not use `panic!`, `unwrap`, or sentinel values such as `-1`.",
     "Keep the failure mode explicit in the type system so callers cannot ignore it accidentally."],
    ["The function returns Result<usize, &'static str> exactly.",
     "Missing input becomes the default value without error.",
     "Invalid input is represented as an Err, not as a magic number or log-only failure."],
    ["Handle Option first, then parse the string branch.",
     "The type system should make invalid states harder to ignore at call sites."]))

P.append(exercise(4, "debugging or refactoring", "Interpret three compiler diagnostics and propose repairs",
    "Practice reading Rust diagnostics as ownership and concurrency design feedback.",
    "For each diagnostic, explain the rule Rust is enforcing, sketch the likely shape of the buggy code, and propose one or two valid repair strategies.",
    ["E0382: borrow of moved value: request",
     "E0499: cannot borrow buffer as mutable more than once at a time",
     "E0277: Rc<String> cannot be sent between threads safely"],
    ["Your explanation of E0382 mentions ownership transfer and alternatives such as borrowing, returning ownership, or intentional cloning.",
     "Your explanation of E0499 mentions exclusive mutable access and proposes scope shortening or data-structure redesign.",
     "Your explanation of E0277 mentions thread-safety trait bounds and distinguishes Rc from thread-safe sharing approaches such as Arc."],
    ["Focus on the violated rule first, then the syntax.",
     "A good repair changes ownership shape before reaching for shared mutable state."]))

P.append(exercise(5, "design or production scenario", "Design a worker pipeline with explicit ownership boundaries",
    "Choose Rust-native boundaries for parsing, validation, dispatch, and cross-thread communication in a production-style service.",
    "You are designing an ingestion service with the flow `socket bytes -> parse -> validate -> route to workers -> emit metrics`.",
    ["At what boundary do bytes become owned domain values?",
     "What data is borrowed only locally?",
     "What types are allowed to cross thread boundaries?",
     "Where do you use `Result` or enums to represent failure and state?"],
    ["You place ownership boundaries before cross-thread or queued work.",
     "You avoid defaulting to a single global `Arc<Mutex<HashMap<...>>>` as the first design move.",
     "You make error handling explicit with Result, enums, or both.",
     "You justify at least one tradeoff involving performance, safety, or maintainability."],
    ["Prefer message passing of owned work items over broad shared mutability.",
     "If you need sharing, explain why the sharing is semantically real rather than just convenient."]))

P.append(sub("Runnable lab · Exercise 3"))
P.append(body("Implement the explicit-fallibility version of `parse_limit`. The checker expects a default value for missing input, an explicit rejection for zero, and a successful positive parse. Keep the type as `Result<usize, &'static str>`, handle `None` first, then validate and parse the `Some` branch."))
P.append(example("1-3", "parse_limit_lab.rs", "starter — make it produce the target output",
                 CODE_PARSE_LIMIT,
                 output='default = Ok(100)\nzero = Err("limit must be greater than 0")\nvalue = Ok(25)',
                 out_label="Target output (after your fix)"))
P.append(admonition("The listing above is the starter: it returns the default as `Ok(0)` and accepts zero. Your task is to make it produce the target output instead.", "note"))

P.append(sub("Questions to ask for each error"))
P.append(group([
    block("E0382", "What moved, and should this call site borrow, return ownership, or clone intentionally?"),
    block("E0499", "Which mutable borrow stayed alive too long, and how can the scopes or data shape be narrowed?"),
    block("E0277", "Which thread boundary requires `Send` or `Sync`, and is sharing actually necessary here?"),
], cols=3))

P.append(sub("Review questions"))
P.append(ulist([
    "Why does Rust often feel harder at API boundaries than inside small local functions?",
    "What is the practical difference between a generic function using traits and a trait object?",
    "Name one category of bug Rust usually catches at compile time and one category it cannot remove from runtime reality.",
    "Why is 'just clone it' sometimes correct and sometimes a design smell?",
    "How would you explain `Send` and `Sync` to a teammate coming from Go or C#?",
]))
P.append(sidebar("What success looks like",
    f'<p>{ic("By the end of these exercises, you should be able to explain Rust strictness in ownership-contract terms, diagnose common move, borrow, and thread-boundary failures, and defend at least one production design in Rust-native language instead of translating it mechanically from C++, C#, or Go.")}</p>'))
P.append(CHAPTER_CLOSE)

# ===========================================================================
# CHAPTER 2
# ===========================================================================
P.append(chapter_open("Chapter 2 · The Rust Mental Model", "The Rust Mental Model",
    "Reliable Rust services depend on a precise model of values, ownership transfer, drops, stack and heap storage, expressions, and references. This chapter defines that model for code review and debugging."))
P.append(sidebar("Builds on Chapter 1",
    f'<p>{ic("Chapter 1 explained why Rust feels different at a high level. This chapter turns that intuition into an operational model: who owns a value, what actually moves, what gets dropped, and why lifetimes are proofs about references rather than a runtime memory system.")}</p>'))

P.append(section("Opening scenario"))
P.append(body("A message-ingestion service parses inbound bytes, enriches records, and dispatches owned jobs to workers. The business requirement is a precise value lifecycle: where data is created, which component owns it, where heap storage is used, and when cleanup occurs."))
P.append(sidebar("Operational checklist", olist([
    "What value exists here, and which binding owns it right now?",
    "If the value is heap-backed, which part is inline metadata and which part owns separate storage?",
    "Where does scope end, and therefore where does deterministic cleanup happen?",
    "If a reference appears, which owner keeps it valid?",
])))

P.append(section("Mental model"))
P.append(group([
    block("Values are the thing; bindings are scope-local names", "A Rust `let` binding is not a little object wrapper with secret identity. It is a name in a scope. The value can move, be borrowed temporarily, or be dropped when its owner goes out of scope."),
    block("Moves transfer responsibility, not data by magic", "For non-`Copy` types such as `String`, `Vec<T>`, and most structs, assignment or argument passing usually transfers ownership. After the move, the previous binding is simply no longer the owner."),
    block("Lifetimes describe borrowed reach, not object survival", "A lifetime annotation does not keep data alive and does not behave like a garbage collector. It only states a compile-time relationship: this reference must not outlive the owner it points into."),
], cols=3))

P.append(section("Core concepts"))
P.append(group([
    concept_block("Values, bindings, moves, and drops",
        "Think operationally: values exist, bindings name them, ownership determines who will run cleanup, moves transfer ownership, and `Drop` runs when the owner leaves scope. This model is simpler than class identity plus hidden runtime memory management, but it is more explicit.",
        "let b = a;", "For a non-Copy value, ownership moved and the original binding no longer owns cleanup."),
    concept_block("Stack vs heap allocation",
        "Do not confuse the owner with the storage behind it. A `String` value is a small stack-resident handle, but its bytes live on the heap. A `Vec<T>` owns a heap buffer; the `Vec` metadata itself is a fixed-size value. Heap allocation buys flexibility, not free performance.",
        'let payload = String::from("ok");', "The handle is local data; the string bytes are heap-backed."),
    concept_block("Immutability by default",
        "Bindings are immutable unless you write `mut`. This makes state changes stand out in APIs and local code. It does not mean Rust is globally immutable; it means mutation is opt-in and therefore easier to audit.",
        "let mut y = 1;", "Mutation is explicit at the binding where it is needed."),
    concept_block("Expressions, statements, and blocks",
        "Most constructs in Rust produce values. `if`, `match`, and blocks can return a result. This makes it natural to build values with local scratch state and then expose only the final immutable result.",
        'let timeout_ms = if bursty { 200 } else { 50 };', "Control flow can compute a value directly instead of widening mutation."),
    concept_block("RAII and deterministic destruction",
        "Rust inherits the RAII spirit familiar to C++ engineers, but makes the ownership rules visible in ordinary code. Scope exit triggers deterministic destruction in reverse lexical order. That matters for files, sockets, locks, buffers, and transaction guards.",
        "{ let file = open_log(); }", "Cleanup happens when the owner leaves scope, not when a GC eventually notices it."),
    concept_block("Lifetimes as compile-time reasoning, not garbage collection",
        "Lifetimes are attached to references, not owned values. They let the compiler verify that borrowed data is still valid where used. They are not runtime tags, object regions, or reachability roots.",
        "fn pick<'a>(left: &'a str, right: &'a str) -> &'a str", "The annotation constrains the returned reference; it does not extend any owner’s lifetime."),
], cols=2))

P.append(sub("Comparison callout: translating prior instincts"))
P.append(group([
    block("C++ background", "RAII and move semantics will feel familiar, but Rust refuses casual aliasing patterns that C++ often permits. References are more constrained, and safe code cannot quietly rely on discipline alone."),
    block("C# background", "There is no GC extending object reachability behind the scenes. If a value must survive, some owner must hold it. If a reference is returned, the compiler proves the referent outlives that use."),
    block("Go background", "Go hides many storage decisions behind escape analysis and a garbage collector. Rust exposes ownership more directly: borrowed local views stay local, while owned values cross threads, queues, and subsystem boundaries."),
], cols=3))

P.append(sub("Two corrections that remove a lot of confusion"))
P.append(group([
    block("A move is not “copy then invalidate” as a user model", "The useful model is simpler: ownership transferred. For small fixed-size `Copy` values the data is copied. For non-`Copy` types, think of the old binding as no longer owning the value. That is the rule that matters when reading APIs and diagnostics."),
    block("A lifetime does not keep anything alive", "Owned values live until their owner is dropped. Lifetimes constrain references that point at those values. If the owner is dropped, no annotation can keep a reference to it valid."),
], cols=2))

P.append(sub("Expressions, statements, and blocks in one pass"))
P.append(group([
    expr_block("let retries = 3;", "A statement performs work in the enclosing scope. It does not become the value of that scope."),
    expr_block("if bursty { 200 } else { 50 }", "An expression produces a value. In Rust, `if`, `match`, and blocks are often value-producing tools, not only control-flow syntax."),
    expr_block("{ let base = 40; base + 2 }", "The last line without a semicolon becomes the block’s value. Add a trailing semicolon and the block evaluates to `()` instead."),
], cols=3))

P.append(admonition("When a lifetime error appears, repair ownership before you reach for annotations. Usually the real choice is one of two shapes: borrow from caller-owned input that already lives long enough, or return an owned value so the function transfers data instead of a reference. Randomly adding `'a` to a signature rarely fixes the model, because lifetimes describe valid borrowing relationships; they do not extend how long an owner lives.", "tip", label="Rule of thumb"))

P.append(section("Production patterns"))
P.append(group([plain_block(x) for x in [
    "Use borrowed views for short local work, but convert to owned values before task queues, worker handoff, cache storage, or long-lived structs.",
    "Prefer block expressions to assemble validated immutable values. Local mutation inside a short block is often clearer than a wider mutable scope.",
    "Treat `Drop` as the last line of defense for releasing resources, not as a general business-logic callback mechanism.",
    "Model ownership at subsystem boundaries first; performance work is easier once the movement and lifetime of data are explicit.",
]], cols=2))

P.append(section("Pitfalls and tradeoffs"))
P.append(group([plain_block(x) for x in [
    "Confusing a binding with object identity. Rebinding a name is not the same thing as preserving one owner.",
    "Using a reference as if it could extend lifetime. References describe access; they do not keep the referenced value alive.",
    "Marking wide state as `mut` early and then fighting borrow conflicts that were really scope-design problems.",
    "Trying to return references to function-local data instead of deciding who should own the result.",
    "Putting slow, fallible, or order-sensitive business logic inside `Drop` instead of keeping destructors small and unsurprising.",
    "Adding lifetime annotations before the ownership model is clear enough to justify them.",
]], cols=2))
P.append(admonition("Deterministic destruction is powerful, but it is not magic. Destructors should release resources and maintain invariants, not hide slow network calls, lock acquisition chains, or critical business logic that is hard to reason about during unwinding and shutdown.", "warn"))

P.append(section("Examples"))
P.append(example("2-1", "move_and_drop_timeline.rs", "move a value and observe deterministic drop",
                 CODE_MOVE_DROP, output="before move\nshipping audit.log\ndrop audit.log\nafter ship"))
P.append(admonition("The binding in `main` stops owning the value after the function call, and cleanup runs when the new owner leaves scope. Trace the output by hand, then rename the file or move more fields through the handoff to make the ownership timeline concrete.", "tip", label="Try it"))
P.append(example("2-2", "expression_blocks_and_heap.rs", "build owned heap data with narrow mutation",
                 CODE_BLOCKS_HEAP, output="status = hot\ncapacity = 8"))
P.append(admonition("The outer bindings stay immutable while a short inner block uses mutation to assemble the final value. Confirm the expected output, then vary the block contents to see how narrow mutation still yields an owned final value.", "tip", label="Try it"))

P.append(section("Summary"))
P.append(ulist([
    "Rust gets calmer when you treat bindings as names and ownership as the cleanup contract.",
    "Stack and heap explain storage placement; ownership explains who is responsible for the value that uses it.",
    "Immutability by default and expression-oriented blocks push mutation into narrower, more reviewable scopes.",
    "RAII in Rust is explicit and deterministic, which is exactly why `Drop` should stay small and unsurprising.",
    "Lifetimes talk only about borrowed references. They never extend the life of owned data.",
]))
P.append(CHAPTER_CLOSE)

# ===========================================================================
# CHAPTER 2 — EXERCISES
# ===========================================================================
P.append(chapter_open("Chapter 2 · Exercises", "Chapter 02 Exercises",
    "Exercises for reasoning about moves, drops, allocation shape, expression-oriented code, and lifetime constraints."))
P.append(sidebar("How to use this page",
    f'<p>{ic("Work from ownership and scope first, then syntax. For each exercise, explain who owns the value, when it can be borrowed, and where destruction happens. The repository keeps exercises solution-free on purpose: treat the objective and acceptance criteria as your spec.")}</p>'))
P.append(sidebar("Suggested working loop", olist([
    "Name the owner first, then describe the borrow or move.",
    "Separate storage shape from ownership shape before you optimize the design in your head.",
    "Explain where scope ends and what gets dropped there.",
    "If a reference appears, state which owner keeps it valid.",
])))

P.append(exercise(1, "warm-up comprehension", "Predict the ownership timeline",
    "Practice narrating which binding owns a value after each move and where `Drop` is guaranteed to run.",
    "Read a short ownership-transfer sequence with `service`, `alias`, and `consume`, then narrate the owner after each move in plain English.",
    ["Which binding owns the string after each line?",
     "At what scope does the string get dropped?",
     "Which extra line could you add that would fail to compile, and why?"],
    ["You explain that ownership moves from `service` to `alias`, then from `alias` into `consume`.",
     "You identify the end of `consume` as the drop point for the owned `String`.",
     "Your failing-line example correctly refers to using a moved binding after ownership transfer."],
    ["For non-`Copy` types, assignment normally transfers ownership.",
     "Describe ownership one scope at a time instead of thinking about hidden object identity."]))

P.append(exercise(2, "code reading", "Map stack and heap storage precisely",
    "Explain which parts of a composite value are inline and which parts own heap allocations.",
    "Analyze a `Batch` struct that stores a fixed array plus a `Vec<String>`, then write a short note about which pieces are inline and which pieces own heap allocations.",
    ["Which parts of `Batch` are stored inline in the local value?",
     "What heap allocations exist?",
     "Which value owns each heap allocation?"],
    ["You identify the fixed-size array as inline in the `Batch` value.",
     "You explain that `Vec<String>` contains inline metadata while its element buffer is heap allocated.",
     "You note that each `String` element owns its own heap-backed bytes."],
    ["Separate the outer struct layout from the storage used by each field’s owned data.",
     "A `Vec<T>` is a fixed-size handle that owns a separate buffer."]))

P.append(exercise(3, "implementation", "Refactor imperative mutation into expression-oriented Rust",
    "Rewrite a function so temporary state stays narrow and the final result is produced by expressions.",
    "Refactor `classify(depth: usize) -> (&'static str, usize)` so the tuple comes directly from an expression instead of a wide mutable temporary.",
    ["Keep the return type the same.",
     "Prefer `if` and block expressions.",
     "Do not introduce heap allocation or cloning."],
    ["Your final version avoids the wide `mut scaled` binding.",
     "The result is still `(&'static str, usize)`.",
     "The control flow is expression-oriented rather than early-return driven everywhere."],
    ["An `if` expression can return a tuple.",
     "A short inner block can compute a value without widening mutable scope."]))

P.append(exercise(4, "debugging or refactoring", "Explain the lifetime bug instead of fighting the annotation",
    "Diagnose why returning a reference to local data fails and propose correct repairs.",
    "Diagnose a function that tries to return the first line of a local `String` by reference, then explain why that borrow cannot outlive the owner.",
    ["What rule Rust is enforcing",
     "Why adding a random lifetime annotation does not solve it",
     "Two valid repairs with different tradeoffs"],
    ["You explain that the returned reference would outlive the local `String` owner.",
     "You state that lifetimes describe valid borrowing relationships and do not extend object lifetime.",
     "You propose at least two real repairs, such as returning an owned `String` or borrowing from caller-provided input."],
    ["Ask who owns `text` and when that owner is dropped.",
     "A repair is valid only if the referenced data outlives the returned reference."]))

P.append(exercise(5, "design or production scenario", "Choose owned versus borrowed data at a queue boundary",
    "Make an ownership plan for a realistic parser-to-worker pipeline.",
    "You are designing an ingest path with the flow `&[u8] request bytes -> parse headers -> build Event -> send to worker queue -> persist -> emit metrics`.",
    ["Which data stays borrowed only inside parsing?",
     "Which data becomes owned inside `Event` before the queue boundary?",
     "Where is cloning acceptable, and where is it a smell?",
     "What cleanup should rely on ordinary scope exit or `Drop`?"],
    ["You keep borrowed data local to parsing or validation where possible.",
     "You convert data that crosses the queue boundary into owned values.",
     "You justify cloning as an explicit economic choice rather than a default response.",
     "You describe cleanup in terms of ownership and scope, not hidden runtime behavior."],
    ["A worker queue is usually an ownership boundary.",
     "Try to name the owner at each subsystem edge."]))

P.append(sub("Runnable lab · Exercise 3"))
P.append(body("Refactor the starter so `classify` returns its tuple from an expression. The checker looks for the correct branch values and for the wide mutable temporary to disappear. Aim for an `if` expression that returns `(\"hot\", depth / 2)` or `(\"steady\", depth + 50)` directly."))
P.append(example("2-3", "classify_lab.rs", "starter — refactor toward an expression",
                 CODE_CLASSIFY, output="steady 170\nhot 600",
                 out_label="Target output (after your refactor)"))

P.append(sub("Review questions"))
P.append(ulist([
    "What is the difference between a value and a binding in Rust?",
    "Where do `Vec<T>` metadata and `Vec<T>` elements usually live?",
    "What does a lifetime annotation constrain, and what does it not do?",
    "Why can block expressions reduce mutation pressure in production code?",
    "When is `Drop` useful, and what kinds of logic should usually stay out of it?",
]))
P.append(sidebar("What success looks like",
    f'<p>{ic("By the end of this page, you should be able to narrate ownership transfer without hand-waving, distinguish stack layout from heap-backed ownership precisely, refactor toward expression-oriented Rust when it improves clarity, and explain why a lifetime error is really an ownership error with references on top.")}</p>'))
P.append(CHAPTER_CLOSE)

# Expose ch01-02 parts so `build_complete_pdf.py` can reuse them verbatim.
CH01_CH02_PARTS = list(P)

# ===========================================================================
# RENDER (standalone ch01-02 build; skipped when imported)
# ===========================================================================
if __name__ == "__main__":
    pdf, html = build_book(
        P,
        os.path.join(OUT_DIR, "rust-book-ch01-ch02.pdf"),
        book_title="Advanced Rust",
        author="O. Iakushkin",
    )
    print("PDF:", pdf)
    print("HTML:", html)
