"use client"

// Chapter 9 · exercise workbook page (ch09-smart-pointers-and-pinning-exercises).
// Exercise data consumed by the workbook PDF builder
// (exports/extract_chapter_prose.py reads the const blocks and the
// RustPracticeCard below). Not yet wired into app navigation; wiring
// requires lockstep edits to types.ts / index.ts / index.tsx.
// Intended component name: PageCh09SmartPointersAndPinningExercises

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
    title: "Read each pointer type as an ownership statement",
    objective: "Restate what Box, Rc, Arc, RefCell, Mutex, and Weak each encode without conflating ownership count with mutation authority.",
    starterPrompt: "The chapter argues that a smart pointer encodes ownership count, mutation authority, thread sharing, and address stability. For each of Box<T>, Rc<T>, Arc<T>, RefCell<T>, Mutex<T>, and Weak<T>, write one sentence naming exactly what it provides and one naming what it does NOT provide.",
    prompts: [
      "State the owner count each type implies: one, many on one thread, or many across threads.",
      "Say which types add mutation through a shared handle and where the aliasing rule is enforced (compile time, runtime panic, or lock acquisition).",
      "Explain why Weak<T> is described as a non-owning edge and what upgrade() returns.",
      "Identify which single type in the list speaks to address stability rather than ownership.",
    ],
    acceptanceCriteria: [
      "Box<T> is described as one owner plus heap indirection, with no sharing, reference counting, or interior mutability.",
      "Rc<T> and Arc<T> are both shared ownership, differing only in non-atomic versus atomic counting and therefore single-thread versus cross-thread use.",
      "RefCell<T> is named as runtime-checked borrowing (panic on violation), Mutex<T> as exclusive access after lock acquisition, and neither is presented as adding owners by itself.",
      "Weak<T> is identified as not keeping the allocation alive, with upgrade() returning Option<Rc<T>> or Option<Arc<T>>; Pin is the only address-stability item.",
    ],
    hints: [
      "Ownership count and mutation authority are independent questions; a composite like Rc<RefCell<T>> answers both.",
      "Reread the 'Choosing the right pointer type' section: owners first, then thread boundary, then mutation model.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace the strong and weak edges in the tree sample",
    objective: "Read the chapter's Node sample and account for every reference-count change and borrow that occurs at runtime.",
    starterPrompt: "Work through the smart_pointers_tree sample, where Node holds parent: RefCell<Weak<Node>> and children: RefCell<Vec<Rc<Node>>>. Explain why the graph stays acyclic and what each printed line reports.",
    prompts: [
      "After root.children.borrow_mut().push(Rc::clone(&leaf)), state leaf's strong count and why it changed.",
      "After *leaf.parent.borrow_mut() = Rc::downgrade(&root), state root's strong count and weak count.",
      "Explain why leaf.parent.borrow().upgrade() must be handled as an Option rather than dereferenced directly.",
      "Justify the final value of Rc::strong_count(&root) printed by the program.",
    ],
    acceptanceCriteria: [
      "The answer states that pushing Rc::clone(&leaf) raises leaf's strong count to 2, and that downgrade adds a weak (not strong) count to root.",
      "Rc::strong_count(&root) is correctly explained as 1, because only the leaf-to-root edge is weak and no second strong handle to root exists.",
      "The answer explains that upgrade() returns Option because a Weak does not keep the allocation alive, so the owner may already be gone.",
      "The reader identifies the children edge as the owning (strong) edge and the parent edge as the observational (weak) edge, which is why no cycle forms.",
    ],
    hints: [
      "Each Rc::clone bumps the strong count; Rc::downgrade bumps the weak count instead.",
      "A strong cycle is two strong edges that point at each other; here one direction is deliberately weak.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Build a single-thread cache with Rc plus interior mutability",
    objective: "Compose shared ownership with the smallest sufficient interior-mutability tool instead of reaching for RefCell by reflex.",
    starterPrompt: "Implement a single-thread counter cache shared by several handles: a struct Stats holding hits: Cell<u32> and a label: String, wrapped as Rc<Stats>. Provide fn record_hit(stats: &Rc<Stats>) that increments the count and fn snapshot(stats: &Rc<Stats>) -> u32 that reads it.",
    prompts: [
      "Choose Cell<u32> rather than RefCell<u32> and justify the choice in one sentence.",
      "Implement record_hit using get and set (or a single update of the copied value), without handing out an interior reference.",
      "Clone the Rc<Stats> into a second handle and show that both handles observe the same incremented count.",
      "State what would change if a field needed an interior &mut reference instead of copy-out semantics.",
    ],
    acceptanceCriteria: [
      "Stats uses Cell<u32> for the count, and record_hit mutates it through a shared &Rc<Stats> without &mut.",
      "snapshot returns the current count by value and does not borrow an interior reference.",
      "Two cloned Rc handles are shown to read the same updated count, demonstrating shared ownership of one allocation.",
      "The answer notes that Cell is correct here because only whole-value copy/replace is needed, and RefCell would be required only if interior references were handed out.",
    ],
    hints: [
      "Cell::get copies the value out; Cell::set replaces it; no borrow token is involved.",
      "Cloning an Rc adds an owner of the same allocation, so both handles see one shared Cell.",
    ],
  },
  {
    number: 4,
    kind: "implementation",
    title: "Poll a hand-written future through Pin",
    objective: "Drive an address-sensitive value to completion using Pin and the poll contract from the chapter's pinning sample.",
    starterPrompt: "Following the smart_pointers_pin_poll sample, implement a future struct Ticker { remaining: u8 } whose poll returns Poll::Pending while remaining is above zero (decrementing each call) and Poll::Ready(\"fired\") at zero. Box::pin it and poll it in a loop until ready.",
    prompts: [
      "Give poll the exact signature fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>.",
      "Recover a mutable reference to the fields with self.get_mut() and explain why that is permitted here.",
      "Build a no-op Waker and Context, pin the future with Box::pin, and poll via Future::poll(task.as_mut(), &mut cx).",
      "Count how many Pending results precede the single Ready for remaining = 3.",
    ],
    acceptanceCriteria: [
      "poll has the signature taking Pin<&mut Self> and returns Poll::Ready(\"fired\") only when remaining reaches zero.",
      "self.get_mut() is used to reach the fields, with a note that it is sound because Ticker is movable (Unpin).",
      "The driver pins with Box::pin and polls task.as_mut() in a loop until Poll::Ready is returned.",
      "For remaining = 3 the program reports three Pending polls before the Ready result.",
    ],
    hints: [
      "get_mut is available because a plain struct of Copy fields is Unpin; the !Unpin restriction is what blocks projection elsewhere.",
      "Pin<&mut Self> is the temporary pinned view; Box::pin gives the owned pinned storage you poll repeatedly.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Break a reference cycle and fix a misused pointer",
    objective: "Diagnose a leak caused by two strong edges and a thread-safety mismatch, then repair both with the chapter's rules.",
    starterPrompt: "A single-thread graph defines Node { parent: RefCell<Option<Rc<Node>>>, children: RefCell<Vec<Rc<Node>>> } and is then moved across a thread boundary inside an Rc. The parent never drops, and the cross-thread move fails to compile. Find and fix both defects.",
    prompts: [
      "Explain why a strong parent edge plus a strong children edge prevents either strong count from reaching zero.",
      "Change the parent edge to the correct non-owning type and adjust how the parent is set and read.",
      "Explain why Rc<Node> cannot cross a thread boundary and name the minimal change for the cross-thread case.",
      "State whether switching to Arc alone makes shared mutation safe, and what additional mechanism is required.",
    ],
    acceptanceCriteria: [
      "The leak is correctly attributed to a strong-strong cycle, with neither side reaching a strong count of zero.",
      "The parent field is changed to RefCell<Weak<Node>>, set via Rc::downgrade and read via upgrade() returning an Option.",
      "The answer states Rc<Node> is not Send/Sync because its count is non-atomic, and that Arc<Node> is the cross-thread replacement.",
      "The answer makes clear that Arc fixes ownership count only, and shared mutation across threads still needs a Mutex (or message passing).",
    ],
    hints: [
      "Owning edges stay strong; observational back-edges become weak.",
      "Arc<Mutex<T>> reads as shared ownership plus synchronized mutation, two separate decisions.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose pointer types for a mixed-ownership service",
    objective: "Translate a service's ownership, threading, and mutation requirements into concrete composite pointer types.",
    starterPrompt: "Design the storage types for the service in the opening scenario: recursive parser state with a single owner, planning data shared on one thread, a schema shared read-only across worker threads, retry coordination mutated by several threads, and a future stored to be polled later.",
    prompts: [
      "Assign a pointer type to each of the five concerns and justify owner count and thread boundary for each.",
      "For each shared-and-mutable concern, name the enforcement model and read the composite type literally (for example, what Arc<Mutex<T>> means).",
      "Explain why the stored future uses Pin<Box<dyn Future>> rather than a plain Box.",
      "Flag the operational concerns the locking choice introduces (lock scope, contention, poisoning, deadlock).",
    ],
    acceptanceCriteria: [
      "Recursive parser state is Box<T> (one owner, heap indirection for finite size); shared planning data is Rc<T> or Rc<RefCell<T>> on one thread.",
      "The cross-thread read-only schema is Arc<T>, and the cross-thread mutable retry state is Arc<Mutex<T>>, each justified by owner count then thread boundary then mutation model.",
      "The stored future is Pin<Box<dyn Future>>, justified by the future's address-sensitive state machine needing to stay put while polled.",
      "The answer names at least two operational concerns the Mutex introduces, such as lock scope, contention, poisoning, or deadlock risk.",
    ],
    hints: [
      "Answer the questions in order: how many owners, one thread or many, does the shared value mutate, under which model.",
      "Read composites as layered statements; the type literal already documents the runtime story.",
    ],
  },
]

const reviewQuestions = [
  "What does Box<T> provide, and which three things that people often associate with smart pointers does it deliberately NOT provide?",
  "Rc<T> and Arc<T> both give shared ownership; what is the single implementation difference between them, and what consequence does it have for thread boundaries?",
  "Cell<T> and RefCell<T> are both single-thread interior-mutability tools; when must you choose RefCell<T> instead of Cell<T>, and what failure mode does RefCell add?",
  "Why can reference counting alone never reclaim a cycle, and what edge change turns a cyclic graph back into a collectable acyclic one?",
  "What invariant does Pin<T> protect, why does Future::poll take Pin<&mut Self>, and why does the distinction not matter for ordinary Unpin types?",
]

const workingLoop = [
  "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
  "Write the smallest version that compiles, then make it correct.",
  "Check each acceptance criterion explicitly before moving on.",
  "Name one tradeoff or failure mode your solution accepts.",
]

<RustPracticeCard
  title={"Runnable lab · strong edges own, weak edges observe"}
  filename="weak_parent_edge_lab.rs"
  runKey="ch09_ex_weakedge"
  expectedOutput={"root children = 1\nleaf parent = root\nroot strong = 1\nroot weak = 1\nleaf parent (after root drop) = none"}
  helperText={"Complete the attach function so the parent owns the child through a strong Rc and the child only observes the parent through a Weak handle. The printed counts and the post-drop lookup confirm the graph is acyclic."}
  initialCode={`use std::cell::RefCell;
use std::rc::{Rc, Weak};

#[derive(Debug)]
struct Node {
    name: String,
    parent: RefCell<Weak<Node>>,
    children: RefCell<Vec<Rc<Node>>>,
}

impl Node {
    fn new(name: &str) -> Rc<Node> {
        Rc::new(Node {
            name: String::from(name),
            parent: RefCell::new(Weak::new()),
            children: RefCell::new(Vec::new()),
        })
    }
}

// TODO: attach \`child\` under \`parent\` so the parent owns the child with a
// strong edge and the child observes the parent with a weak edge.
fn attach(_parent: &Rc<Node>, _child: &Rc<Node>) {
    // TODO: push a strong Rc::clone of \`child\` into \`parent.children\`,
    // then set \`child.parent\` to a weak handle via Rc::downgrade.
}

fn parent_name(node: &Rc<Node>) -> String {
    node.parent
        .borrow()
        .upgrade()
        .map(|p| p.name.clone())
        .unwrap_or_else(|| String::from("none"))
}

fn main() {
    let root = Node::new("root");
    let leaf = Node::new("leaf");

    attach(&root, &leaf);

    println!("root children = {}", root.children.borrow().len());
    println!("leaf parent = {}", parent_name(&leaf));
    println!("root strong = {}", Rc::strong_count(&root));
    println!("root weak = {}", Rc::weak_count(&root));
    println!("leaf parent (after root drop) = {}", {
        drop(root);
        parent_name(&leaf)
    });
}
`}
/>
*/
