"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { PAGES } from "../types"
import { Button } from "@/components/ui/button"
import { RustPracticeCard } from "../rust-practice-card"

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
    title: "Compare buffered and unbuffered file reads from the workload",
    objective: "Practice deciding when buffering is a real win and when it is mostly noise relative to the rest of the pipeline.",
    starterPrompt:
      "Compare three cases: reading one large file sequentially with many tiny line parses, reading one small config file once at startup, and reading already memory-resident bytes in a request-local parser.",
    prompts: [
      "Which case benefits most from `BufReader` because it reduces many small underlying reads?",
      "Which case may not care because the file is tiny and the operation is rare?",
      "Which case already has bytes in memory and therefore is not a kernel-read buffering question anymore?",
    ],
    acceptanceCriteria: [
      "You identify at least one strong buffering case and one weak buffering case.",
      "You distinguish kernel-read amortization from in-process parsing cost clearly.",
      "You avoid treating buffering as a universal optimization slogan.",
    ],
    hints: [
      "Ask where the expensive boundary really is: storage, socket, queue, or CPU parse work.",
      "A buffer helps most when the underlying source would otherwise see many tiny operations.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Identify the ownership responsibilities for a file descriptor",
    objective: "Read a handle handoff and state exactly who owns close responsibility and where duplication changes semantics.",
    starterPrompt:
      "A function opens a file, passes the raw descriptor integer to two helpers, then one helper rebuilds an owning file object from the raw value while the original `File` is still alive.",
    prompts: [
      "Where is the double-close or use-after-close risk hiding?",
      "Which path should move the handle instead of borrowing or rebuilding ownership from a raw integer?",
      "When would `try_clone` be the honest design, and what semantic cost would it introduce?",
    ],
    acceptanceCriteria: [
      "You explain the single-owner close invariant concretely.",
      "You identify at least one repair based on moving the owner instead of reconstructing ownership unsafely.",
      "You explain why duplicating a handle is a semantic change, not a free borrow substitute.",
    ],
    hints: [
      "A raw descriptor integer is not a lifetime or ownership proof by itself.",
      "If two places both believe they own close responsibility, the design is already broken.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Build a backpressure-aware buffered pipeline",
    objective: "Implement a small line pipeline that uses bounded handoff plus buffered output instead of one write per record.",
    starterPrompt:
      "Read three lines from an in-memory source, move owned strings through a bounded channel, batch them two at a time, and write them through a `BufWriter`.",
    prompts: [
      "Use a visible bounded capacity of `1`.",
      "Keep the logical batch size at `2`.",
      "Flush the trailing partial batch after the receive loop ends.",
      "Print the queue capacity, received line count, batch count, and written byte count.",
    ],
    acceptanceCriteria: [
      "The pipeline uses `sync_channel(1)` or an equivalent bounded queue.",
      "The consumer batches two records before writing and flushes the final partial batch.",
      "The output is buffered rather than written one record at a time with no grouping.",
      "The runnable lab prints the expected capacity, received count, batch count, and byte count.",
    ],
    hints: [
      "A bounded queue and a batch size are both policy choices. Keep both visible in code.",
      "The trailing partial batch is the easiest thing to forget in pipelines like this.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a scatter/gather write path that assumes too much",
    objective: "Fix a vectored write design that assumes one syscall always transmits the whole logical response.",
    starterPrompt:
      "A handler builds two `IoSlice` values, calls `write_vectored` once, and assumes the entire header and body are gone forever.",
    prompts: [
      "Why is one successful vectored write call still not a full-response guarantee?",
      "Would you loop until the logical message is complete, or switch to a different buffering strategy?",
      "When is vectored IO still worth keeping despite the extra state machine for partial writes?",
    ],
    acceptanceCriteria: [
      "You explain the partial-write risk concretely.",
      "You propose one repair that is mechanically correct rather than hopeful.",
      "You justify whether vectored IO remains worth the complexity for the workload.",
    ],
    hints: [
      "The primitive promises one write attempt over several buffers, not automatic completion of a logical message.",
      "Small demos often get away with this assumption. Production code should not rely on luck.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Choose memory mapping, buffered reads, or owned copies honestly",
    objective: "Map three different file workloads to the right boundary tool instead of reaching for mmap by reflex.",
    starterPrompt:
      "You are designing a search service with a large read-only term index, a one-pass log replayer, and a retry queue that stores small file-derived records for later async work.",
    prompts: [
      "Which workload is a good candidate for read-only mapping because random access dominates?",
      "Which workload only wants buffered sequential reading because the data is streamed once?",
      "Which workload wants an owned conversion before the async or retry boundary even if the parse started from borrowed bytes?",
    ],
    acceptanceCriteria: [
      "You choose at least one mapping case and at least one buffered-read case deliberately.",
      "You call out page faults, truncation, or external-mutation caveats for the mapped case.",
      "You choose owned handoff before the long-lived retry or async boundary.",
    ],
    hints: [
      "Mmap is an access-pattern tool, not a general performance charm.",
      "Queues and retries are ownership boundaries even when the input started as a borrowed file view.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Profile and tune an IO-heavy service without folklore",
    objective: "Decide which signals to measure before changing buffering, socket options, async boundaries, or queue sizes.",
    starterPrompt:
      "You run a proxy with bursty small responses, one bounded internal work queue, and a read-mostly file-backed config snapshot. Latency rose after a traffic shift.",
    prompts: [
      "Which metrics would tell you whether the pain is flush frequency, syscall count, queue backlog, CPU parsing, or blocked runtime workers?",
      "Which socket option or batching change would you test first, and why that one first?",
      "What would you measure before declaring memory mapping, async rewrites, or a larger queue to be the correct fix?",
    ],
    acceptanceCriteria: [
      "You name at least three concrete signals such as bytes per write, queue depth, syscall rate, p99 latency, or blocking-pool pressure.",
      "You propose one measured first experiment rather than a large rewrite-by-instinct.",
      "You keep the explanation tied to workload shape instead of generic 'optimize IO' advice.",
    ],
    hints: [
      "A strong answer separates diagnosis from treatment.",
      "The first experiment should be the one that most directly tests the suspected bottleneck.",
    ],
  },
]

const reviewQuestions = [
  "What does buffered IO change, and what does it not change?",
  "Why is a borrowed slice not automatically end-to-end zero-copy?",
  "When is moving a handle calmer than duplicating it?",
  "Why can one vectored write still be only a partial logical response?",
  "What signals tell you a queue needs a bound or a smaller bound?",
  "Why should mmap, async rewrites, and socket tuning all be justified by measured behavior rather than by taste?",
]

const workingLoop = [
  "State the expensive boundary first: file, socket, queue, parse loop, or task handoff.",
  "State the owner second: who owns the bytes or the handle before and after the boundary?",
  "Choose buffering, batching, or bounded admission only after the boundary is clear.",
  "Name one metric that would confirm the design is behaving the way you think it is.",
]

export function PageCh27IoTricksAndSystemsProgrammingPatternsExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 53
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 27 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice IO the way it behaves in production: buffered versus unbuffered reads, bounded pipelines, scatter/gather
          tradeoffs, descriptor ownership, and profiling choices grounded in real workload shape.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a systems review. The strongest answer names the boundary, the owner, the overload
                policy, and the measurement plan before it reaches for a technique name.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(52)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 27
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Suggested working loop</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            {workingLoop.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="grid gap-4">
          {exercises.map((exercise) => (
            <article key={exercise.number} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3 flex-col md:flex-row md:items-center mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">
                    Exercise {exercise.number} · {exercise.kind}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{exercise.title}</h3>
                </div>
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  IO systems drill
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">Objective</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{exercise.objective}</p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">Starter prompt</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{exercise.starterPrompt}</p>
                  {exercise.prompts?.length ? (
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                      {exercise.prompts.map((prompt) => (
                        <li key={prompt}>{prompt}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-card p-4">
                <h4 className="font-medium text-foreground mb-2">Acceptance criteria</h4>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {exercise.acceptanceCriteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </div>

              <details className="mt-4 rounded-lg border border-border bg-card p-4">
                <summary className="cursor-pointer list-none flex items-center gap-2 font-medium text-foreground">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Optional hints
                </summary>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {exercise.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </section>

        <RustPracticeCard
          title="Runnable lab · Backpressure-aware buffered pipeline"
          description={
            <>
              Repair the starter so the line pipeline uses a bounded queue, batches two records per flush, and writes the
              trailing partial batch before exit. The checker expects the exact output below.
            </>
          }
          filename="buffered_pipeline_lab.rs"
          runKey="ch27_ex_buffered_pipeline"
          expectedOutput={"capacity = 1\nreceived = 3\nbatches = 2\nbytes = 15"}
          helperText={
            <>
              Tip: switch from <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">channel()</code> to{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">sync_channel(1)</code>, change the batch
              threshold to <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">2</code>, and remember to
              flush the leftover batch after the receive loop ends.
            </>
          }
          initialCode={`use std::io::{self, BufRead, BufReader, BufWriter, Cursor, Write};\nuse std::sync::mpsc;\nuse std::thread;\n\nfn main() -> io::Result<()> {\n    let input = Cursor::new(\"red\\nblue\\ngreen\\n\".as_bytes());\n    let mut reader = BufReader::new(input);\n    let (tx, rx) = mpsc::channel::<String>();\n\n    let producer = thread::spawn(move || {\n        let mut line = String::new();\n        while reader.read_line(&mut line).unwrap() != 0 {\n            let owned = line.trim_end().to_string();\n            tx.send(owned).unwrap();\n            line.clear();\n        }\n    });\n\n    let mut out = Vec::new();\n    let mut writer = BufWriter::new(&mut out);\n    let mut received = 0usize;\n    let mut batches = 0usize;\n    let mut pending = Vec::new();\n\n    while let Ok(line) = rx.recv() {\n        pending.push(line);\n\n        if pending.len() == 0 {\n            for item in pending.drain(..) {\n                writeln!(writer, \"{}\", item)?;\n            }\n            batches += 1;\n        }\n\n        received += 1;\n    }\n\n    producer.join().unwrap();\n    writer.flush()?;\n\n    println!(\"capacity = {}\", 1);\n    println!(\"received = {}\", received);\n    println!(\"batches = {}\", batches);\n    println!(\"bytes = {}\", out.len());\n    Ok(())\n}`}
        />

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Review questions</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {reviewQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">What success looks like</h3>
          <p className="text-sm text-muted-foreground leading-6">
            By the end of this page, you should be able to explain when buffering actually matters, trace file-descriptor
            ownership through a subsystem, design a bounded IO pipeline with explicit batch policy, and choose profiling
            signals that tell you whether the next fix should target syscalls, copies, queues, or scheduling.
          </p>
        </section>
      </div>
    </div>
  )
}
