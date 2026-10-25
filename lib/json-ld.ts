/**
 * Safe serializer for JSON-LD injected via `dangerouslySetInnerHTML`.
 *
 * `JSON.stringify` does NOT escape `<`, `>`, `&`, or the line/paragraph
 * separators. A raw `</script>` inside a string value therefore closes the
 * host <script> tag and lets attacker-controlled content (e.g. an event
 * title or notes field) break out and execute. We escape those characters
 * to their Unicode escapes, which is the recommended mitigation and keeps
 * the JSON valid.
 */
export function safeJsonLdStringify(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
