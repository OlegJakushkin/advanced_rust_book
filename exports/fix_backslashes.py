# -*- coding: utf-8 -*-
"""Repair the two remaining default_codes.json entries whose extracted Rust has a
doubled backslash (a known extract_codes.py limitation: it does not JS-unescape
the .ts template literals). The .ts stays as-is (the app editor JS-evals it
correctly); only default_codes.json — the source the book PDF and public corpus
build from — is patched.

  serialization_contracts_custom_zero_copy (ch19):  \\"  ->  \"   (JSON in a Rust string)
  tokio_tcp_graceful_shutdown (ch25):               \\n  ->  \n   (newline in a byte string)
"""
import json, os

BS = chr(92)                  # one backslash
DQ = chr(34)                  # one double-quote
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, "default_codes.json")
c = json.load(open(p, encoding="utf-8"))

k19 = "serialization_contracts_custom_zero_copy"
k25 = "tokio_tcp_graceful_shutdown"

c[k19] = c[k19].replace(BS + BS + DQ, BS + DQ)   # \\"  -> \"
c[k25] = c[k25].replace(BS + BS + "n", BS + "n")  # \\n  -> \n

for k in (k19, k25):
    assert (BS + BS) not in c[k], f"{k} still contains a double backslash"

json.dump(c, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=0)

print("FIXED both keys.")
for k in (k19, k25):
    for line in c[k].splitlines():
        if "let raw" in line or "pong" in line:
            print(f"  {k}: {line.strip()!r}")
