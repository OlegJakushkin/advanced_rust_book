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
    title: "Match the need to the Rust tool",
    objective: "Practice choosing between `Any`, trait methods, macros, schemas, and plain explicit metadata.",
    starterPrompt:
      "Classify five needs: request extensions, plugin capabilities, admin docs, human-readable log labels, and public cross-service schema.",
    prompts: [
      "Which need wants `TypeId` plus `Any`?",
      "Which need wants explicit trait metadata rather than downcasting everywhere?",
      "Which need wants compile-time generation rather than runtime inspection?",
      "Which need wants a stable public contract instead of `type_name::<T>()` or `TypeId`?",
    ],
    acceptanceCriteria: [
      "You choose `Any` and `TypeId` only for a narrow erased-storage case.",
      "You choose explicit metadata for at least one plugin or admin-facing concern.",
      "You keep public schema and protocol keys explicit rather than runtime-derived.",
    ],
    hints: [
      "Ask whether the need is type identity, schema, diagnostics, or plugin metadata.",
      "The right answer is often smaller than 'runtime reflection.'",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Explain why `Any` is not general reflection",
    objective: "Read a failed design and explain the exact limit Rust is enforcing.",
    starterPrompt:
      "A teammate tries to store `View<'a> { route: &'a str }` inside a long-lived `Box<dyn Any>` registry and later expects to inspect its fields dynamically.",
    prompts: [
      "Why is the borrowed lifetime part of the problem for long-lived erased storage?",
      "Why does `Any` still not provide field enumeration even if the type were `'static`?",
      "What redesign would be calmer: own the data, keep the view local, or attach explicit metadata?",
    ],
    acceptanceCriteria: [
      "You explain that `Any` is usually for `'static` concrete types, not arbitrary borrowed views with wider lifetime claims.",
      "You explain that `Any` supports type recovery, not field walking or method discovery.",
      "You propose one ownership repair and one metadata repair.",
    ],
    hints: [
      "The issue is not only one trait bound. It is the ownership model behind the trait bound.",
      "A good answer distinguishes type identity from structural reflection.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Build a tiny `TypeId` registry",
    objective: "Implement a small typemap that stores heterogeneous values behind one erased boundary and recovers them safely.",
    starterPrompt:
      "Implement `TypeMap` with `insert<T: 'static>` and `get<T: 'static>` using `HashMap<TypeId, Box<dyn Any>>`.",
    prompts: [
      "Use `TypeId::of::<T>()` as the key.",
      "Store values as `Box<dyn Any>`.",
      "Recover with `downcast_ref::<T>()`.",
      "Do not use string keys for type identity.",
    ],
    acceptanceCriteria: [
      "The typemap stores heterogeneous values behind one erased owner.",
      "Lookup is keyed by `TypeId`, not by type name string.",
      "Recovery uses `downcast_ref::<T>()` safely.",
      "The runnable lab prints the expected port, label, and missing-type check.",
    ],
    hints: [
      "The key is concrete type identity, not a manually managed string.",
      "The getter returns `Option<&T>` because recovery may legitimately fail.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a plugin downcast boundary",
    objective: "Use trait metadata for the common path and add `as_any()` only for the specialized path that truly needs it.",
    starterPrompt:
      "You inherit `Vec<Box<dyn Plugin>>`, but one path needs to inspect whether a concrete `JsonPlugin` is configured for pretty output.",
    prompts: [
      "Which data should become ordinary trait metadata instead of a downcast target?",
      "Where does `as_any()` belong if the specialized path still needs a concrete check?",
      "How do you keep the rest of the codebase from turning every call into a downcast?",
    ],
    acceptanceCriteria: [
      "You keep common plugin facts on the trait surface or in an explicit metadata struct.",
      "You add `as_any()` only as a narrow escape hatch if it is still needed.",
      "You explain why repeated downcasting would be a design smell.",
    ],
    hints: [
      "The question is not whether downcasting can work. The question is whether it should be the main API.",
      "Treat the specialized concrete query as an exception path.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Design explicit metadata for a plugin system",
    objective: "Model a plugin registry without pretending the runtime can infer every important fact.",
    starterPrompt:
      "Design a plugin contract for exporters that need name, kind, version, config format, and capabilities, plus one optional specialized inspection path.",
    prompts: [
      "Which fields belong in a `PluginMetadata` struct?",
      "Which facts belong as capability enums instead of stringly typed free text?",
      "Which metadata should be available without any downcast at all?",
      "What test or observability hooks would you add around plugin registration?",
    ],
    acceptanceCriteria: [
      "You define an explicit metadata shape instead of relying on runtime type names.",
      "You keep at least one capability or kind as a stronger type than a raw string when appropriate.",
      "You mention at least one testing or observability hook, such as registration tests, config schema checks, or startup metadata logging.",
    ],
    hints: [
      "If operators need the fact, make it a normal API.",
      "A plugin registry is easier to operate when the metadata is boring and explicit.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose runtime introspection, macros, schema generation, or no reflection at all",
    objective: "Make the introspection choice from boundary shape instead of habit.",
    starterPrompt:
      "You are designing a platform with request-scoped extensions, a browser config form, an internal admin CLI, and a public event schema.",
    prompts: [
      "Which concern wants a typemap inside one process?",
      "Which concern wants compile-time schema generation from DTOs?",
      "Which concern wants ordinary explicit descriptor structs with no `Any` at all?",
      "Which concern should avoid `TypeId` and `type_name::<T>()` because the contract is public or persistent?",
    ],
    acceptanceCriteria: [
      "You map at least three concerns to different Rust-native tools.",
      "You keep public or persistent boundaries away from process-local type identity tricks.",
      "You justify one compile-time approach and one runtime approach in operational terms.",
    ],
    hints: [
      "One system can legitimately use more than one introspection style.",
      "The cleanest answer starts from the boundary contract, not from a favorite mechanism.",
    ],
  },
]

const reviewQuestions = [
  "Why does Rust offer `TypeId` and `Any` without offering general field reflection?",
  "What problem does `'static` solve in many `Any`-based designs?",
  "Why is `type_name::<T>()` useful for diagnostics but weak as a contract key?",
  "How does `as_any()` differ from ordinary trait methods as a design tool?",
  "Why should schema generation usually target DTOs rather than arbitrary live values?",
]

const workingLoop = [
  "Ask whether the need is type identity, schema, diagnostics, or explicit metadata.",
  "Prefer ordinary trait methods, enums, and structs first.",
  "Keep `TypeId` and `Any` inside one process and one narrow erased boundary.",
  "If the boundary is public or persistent, use explicit versions, names, and schema instead.",
]

export function PageCh21ReflectionAndTypeIntrospectionExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch21-reflection-and-type-introspection-exercises")
  const mainPageIndex = getPageIndexById("ch21-reflection-and-type-introspection")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 21 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice Rust-native introspection the way it appears in production: narrow erased registries, safe
          downcasting, explicit plugin metadata, and compile-time generation where the source already knows the shape.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a contract review. The strong answer does not say only “Rust has limited
                reflection.” It says which narrower tool fits the job and which boundary should stay explicit instead.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 21
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
                  Introspection drill
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
          title="Runnable lab · Tiny `TypeId` registry"
          description={
            <>
              Repair the starter so the typemap stores values by concrete type and recovers them safely. The checker
              expects the stored port, the stored label, and a missing-type lookup that still returns{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">true</code>.
            </>
          }
          filename="typemap_lab.rs"
          runKey="ch21_ex_typemap_lab"
          expectedOutput={"port = 8080\nlabel = billing\nmissing bool = true"}
          helperText={
            <>
              Tip: store by <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">TypeId::of::&lt;T&gt;()</code>,
              box the erased value once, and recover it with{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">downcast_ref::&lt;T&gt;()</code>.
            </>
          }
          initialCode={`use std::any::{Any, TypeId};\nuse std::collections::HashMap;\n\n#[derive(Default)]\nstruct TypeMap {\n    values: HashMap<TypeId, Box<dyn Any>>,\n}\n\nimpl TypeMap {\n    fn insert<T: 'static>(&mut self, value: T) {\n        // store by concrete type id\n    }\n\n    fn get<T: 'static>(&self) -> Option<&T> {\n        None\n    }\n}\n\nfn main() {\n    let mut map = TypeMap::default();\n    map.insert::<u16>(8080);\n    map.insert::<String>(String::from(\"billing\"));\n\n    println!(\"port = {}\", map.get::<u16>().copied().unwrap_or(0));\n    println!(\"label = {}\", map.get::<String>().map(String::as_str).unwrap_or(\"none\"));\n    println!(\"missing bool = {}\", map.get::<bool>().is_none());\n}`}
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
            By the end of this page, you should be able to choose between `Any`, trait metadata, macros, and schema
            generation without hand-waving, build a small type-keyed registry safely, and explain why explicit metadata
            usually beats broad runtime reflection in Rust systems.
          </p>
        </section>
      </div>
    </div>
  )
}
