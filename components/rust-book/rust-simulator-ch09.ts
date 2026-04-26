export function simulateCh09Output(code: string, key?: string): string | null {
  if (key === "smart_pointers_tree") {
    const rootName =
      code.match(/let\s+root\s*=\s*Rc::new\(Node\s*{[\s\S]*?name:\s*String::from\("([^"]+)"\)/)?.[1] ?? "root"
    const childCount = (code.match(/children\.borrow_mut\(\)\.push/g) ?? []).length || 1
    const hasWeakParent = /Rc::downgrade\(&root\)/.test(code)
    const parentName = hasWeakParent ? rootName : "none"

    return `root children = ${childCount}\nleaf parent = ${parentName}\nroot strong = 1`
  }

  if (key === "smart_pointers_pin_poll") {
    const startCount = Number(
      code.match(/Box::pin\(\s*Countdown\s*{\s*remaining:\s*(\d+)/)?.[1] ??
        code.match(/remaining:\s*(\d+)/)?.[1] ??
        "2"
    )
    const readyValue = code.match(/Poll::Ready\(\s*"([^"]+)"\s*\)/)?.[1] ?? "done"
    const outputs: string[] = []

    if (startCount > 0) {
      for (let next = startCount - 1; next >= 0; next -= 1) {
        outputs.push(`pending = ${next}`)
      }
    }

    outputs.push(`ready = ${readyValue}`)
    return outputs.join("\n")
  }

  if (key === "ch09_ex_weak_parent") {
    const usesWeakParent = /Rc::downgrade\(&root\)/.test(code)
    return `root strong = 1\nleaf parent upgrade = ${usesWeakParent}`
  }

  return null
}
