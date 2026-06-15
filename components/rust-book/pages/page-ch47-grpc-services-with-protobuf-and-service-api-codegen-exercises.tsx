"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
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
    title: "Choose unary, server streaming, client streaming, or bidirectional streaming from the contract",
    objective:
      "Practice selecting the RPC shape from data flow and pacing instead of choosing streaming by novelty.",
    starterPrompt:
      "Classify four endpoints: create one invoice, watch invoice events over time, upload many invoices then get one summary, and a long-lived sync conversation where both peers keep sending updates.",
    prompts: [
      "Which endpoint is a unary call and why?",
      "Which endpoint wants server streaming because one request opens one subscription?",
      "Which endpoint wants client streaming because the client owns accumulation into one summary result?",
      "Which endpoint truly wants bidirectional streaming, and what backpressure question appears immediately after that choice?",
    ],
    acceptanceCriteria: [
      "You map each workload to a plausible gRPC method shape with a transport reason.",
      "You identify at least one pacing or buffering implication for the streaming cases.",
      "You avoid using bidirectional streaming as the default when a simpler shape already fits.",
    ],
    hints: [
      "Ask who sends once, who sends many times, and who controls pace.",
      "A streaming method is also a lifecycle and buffer contract.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Read generated transport types without contaminating the domain model",
    objective:
      "Explain where generated protobuf messages belong and where a hand-written application command should begin.",
    starterPrompt:
      "A service method currently accepts `CreateInvoiceRequest` directly from generated code and passes it unchanged into a domain aggregate constructor.",
    prompts: [
      "Which fields or types are transport concerns rather than domain concerns?",
      "Where should tenant, caller identity, or metadata-derived fields be attached?",
      "Which hand-written command type would make the service boundary calmer?",
      "What becomes easier to test once the mapping seam exists explicitly?",
    ],
    acceptanceCriteria: [
      "You distinguish generated DTOs from domain or application commands clearly.",
      "You identify at least one metadata-derived field that should be attached outside generated message code.",
      "You name at least one testing or refactoring benefit of the separated seam.",
    ],
    hints: [
      "Generated messages are transport types with field tags and serialization rules attached.",
      "The application service usually wants a smaller, more domain-specific command.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Map a generated request into a domain command",
    objective:
      "Build the small adapter that moves one generated transport request into one application command without leaking gRPC into business code.",
    starterPrompt:
      "Implement `into_command(request, tenant)` so it validates the generated request, moves owned fields into a separate command type, and returns a typed result.",
    prompts: [
      "Reject empty customer IDs or empty line sets explicitly.",
      "Move owned Strings and Vecs into the command rather than cloning them gratuitously.",
      "Keep the result type small and transport-facing only at the adapter layer.",
      "Print tenant, customer, and total cents from the mapped command in the runnable lab.",
    ],
    acceptanceCriteria: [
      "The mapping step returns a separate command type rather than the generated request type itself.",
      "The adapter validates at least one transport-level shape problem explicitly.",
      "The runnable lab prints the expected tenant, customer, and total cents.",
      "The code does not make the downstream service depend on gRPC request wrappers or metadata APIs.",
    ],
    hints: [
      "This is the same seam you would unit test heavily even if the live service used tonic.",
      "Move data once. The generated message already owns its fields.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Diagnose a deadline, cancellation, or streaming backpressure bug",
    objective:
      "Repair one of the most common production problems in gRPC systems: work keeps flowing after the caller or the stream has already told you to stop.",
    starterPrompt:
      "A streaming handler keeps buffering items into a local channel even after the client disconnects, and one unary handler keeps doing CPU-heavy work after the deadline has already expired.",
    prompts: [
      "Where should cancellation or deadline checks happen relative to expensive work?",
      "Which queue or buffer should be bounded before the stream fan-out gets large?",
      "Which status code should the server or client surface for deadline expiry or caller cancellation?",
      "What metric or trace field would prove the repair helped?",
    ],
    acceptanceCriteria: [
      "You place at least one cancellation or deadline check at a meaningful work boundary.",
      "You propose at least one boundedness repair for stream buffering or worker admission.",
      "You identify one observability signal such as in-flight stream items, cancelled RPC count, or deadline-exceeded count.",
    ],
    hints: [
      "A disconnected client is a pacing signal, not only a transport curiosity.",
      "If the buffer is unbounded, the stream still has an ownership bug even before it has a cancellation bug.",
    ],
  },
  {
    number: 5,
    kind: "testing or ci design",
    title: "Test generated APIs and prevent breaking protobuf changes",
    objective:
      "Design the CI and test surface that catches schema drift before partner teams regenerate or deploy stale code.",
    starterPrompt:
      "You added one field, removed another, and changed one method shape from unary to streaming. Now several languages regenerate from the same .proto.",
    prompts: [
      "Which changes are additive and which are breaking?",
      "Which contract artifact should be diffed or checked in CI?",
      "Which transport tests should run against generated client and server code?",
      "Which protobuf tags or names should be reserved after removal?",
    ],
    acceptanceCriteria: [
      "You classify at least one additive change and one breaking change correctly.",
      "You define at least one schema-drift or breaking-change CI gate.",
      "You mention one generated-client or generated-server compile or contract test.",
      "You explicitly reserve removed field tags or names in the policy.",
    ],
    hints: [
      "Changing a method shape is usually a bigger break than adding an optional field.",
      "Broken codegen drift is still contract drift even if the Rust server compiles locally.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Design a polyglot gRPC service lane with auth, tracing, and retries",
    objective:
      "Turn the chapter topics into one production design another language team can consume safely.",
    starterPrompt:
      "You are designing a billing gRPC service consumed by Go workers, a C# admin tool, and one C++ plugin process. Operators require auth metadata, tracing, retry guidance, and bounded streaming behavior.",
    prompts: [
      "Which metadata should travel on every call or stream session?",
      "Which status codes should clients treat as retryable and under what idempotency rule?",
      "Which routes or methods deserve stream-specific queue budgets or concurrency caps?",
      "What telemetry should exist before rollout?",
    ],
    acceptanceCriteria: [
      "You define at least one auth or caller-context rule and one trace-propagation rule.",
      "You classify retryable versus terminal status behavior explicitly.",
      "You include at least one boundedness or concurrency rule for a streaming path.",
      "You mention at least three observability hooks such as status code family counts, stream lifetime, cancelled RPCs, or queue age.",
    ],
    hints: [
      "The contract is polyglot, so review the .proto and retry guidance as public artifacts.",
      "A stream without boundedness policy is already under-specified for production.",
    ],
  },
]

const reviewQuestions = [
  "Why should generated protobuf types usually stop at the transport boundary instead of becoming the domain model?",
  "What makes field tags more durable than field names in protobuf evolution?",
  "Why are deadlines, cancellation, and backpressure part of the API design rather than only runtime behavior?",
  "What is the practical difference between a retryable Unavailable and a non-retryable InvalidArgument?",
  "Why should generated client and server artifacts be rebuilt or checked in CI whenever the .proto changes?",
]

const workingLoop = [
  "Choose the RPC shape first from the pacing contract: unary, server stream, client stream, or bidi.",
  "Keep generated types at the transport edge and map them into application commands explicitly.",
  "Classify deadlines, cancellation, retries, and terminal failures before clients learn policy by folklore.",
  "Add schema-drift and generated-artifact checks before rollout, not after one partner team breaks.",
]

const grpcChecklist = [
  "Generated request and response types stay in the transport layer.",
  "Transport adapters map into application commands and typed service results.",
  "Retry guidance, status-code policy, and deadline behavior are documented and tested.",
  "Streaming paths have bounded buffers or bounded in-flight work.",
  "Schema evolution is protected by CI drift or breaking-change checks.",
]

export function PageCh47GrpcServicesWithProtobufAndServiceApiCodegenExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch47-grpc-services-with-protobuf-and-service-api-codegen-exercises")
  const mainPageIndex = getPageIndexById("ch47-grpc-services-with-protobuf-and-service-api-codegen")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 47 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice gRPC the way it survives review: protobuf contract first, generated transport code second, domain
          mapping by hand, and deadline, retry, and streaming behavior made explicit before rollout.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a transport-and-contract review. The strongest answer does not stop at “use
                tonic.” It says which RPC shape fits the workload, how generated types are contained, and how retry,
                deadline, and schema-drift policy remain observable.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 47
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

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Minimal gRPC review checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {grpcChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
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
                  gRPC drill
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
          title="Runnable lab · Map a generated request into a domain command"
          description={
            <>
              Repair the starter so the generated request type is translated into a separate command type, not passed
              inward unchanged. Unlike Example 1 in the chapter, this lab omits the <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">InvoiceService</code>{" "}
              call, so three output lines are expected. The checker expects the exact output below.
            </>
          }
          filename="grpc_transport_mapping_lab.rs"
          runKey="ch47_ex_transport_mapping"
          expectedOutput={"tenant = acme\ncustomer = cust-7\ntotal cents = 4200"}
          helperText={
            <>
              Tip: move the owned <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">String</code> and{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Vec&lt;u64&gt;</code> from the request into a
              separate command, and keep validation at the adapter seam.
            </>
          }
          initialCode={`#[derive(Debug, Clone)]\nstruct CreateInvoiceRequest {\n    customer_id: String,\n    line_totals: Vec<u64>,\n}\n\n#[derive(Debug, Clone)]\nstruct CreateInvoiceCommand {\n    tenant: String,\n    customer_id: String,\n    line_totals: Vec<u64>,\n}\n\nfn into_command(\n    request: CreateInvoiceRequest,\n    tenant: &str,\n) -> Result<CreateInvoiceCommand, &'static str> {\n    Err(\"unfinished\")\n}\n\nfn main() {\n    let request = CreateInvoiceRequest {\n        customer_id: String::from(\"cust-7\"),\n        line_totals: vec![1_200_u64, 3_000],\n    };\n\n    let command = into_command(request, \"acme\").unwrap();\n    let total_cents: u64 = command.line_totals.iter().copied().sum();\n\n    println!(\"tenant = {}\", command.tenant);\n    println!(\"customer = {}\", command.customer_id);\n    println!(\"total cents = {}\", total_cents);\n}`}
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
            By the end of this page, you should be able to choose the right gRPC method shape, contain generated transport
            types to the edge, design retry and deadline policy from caller action, and protect a protobuf contract
            against accidental breaking change in a polyglot service fleet.
          </p>
        </section>
      </div>
    </div>
  )
}
