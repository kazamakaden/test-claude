/**
 * Replaces `{token}` placeholders in a dictionary string with values from
 * `params`.
 *
 * Notifications (0036) store a `message_key` plus a jsonb `message_params`
 * blob rather than a rendered sentence, so one stored row renders in
 * whichever language the reader is using. This is the only thing that turns
 * those two columns back into a sentence.
 *
 * An unknown token is left verbatim rather than blanked: a visible
 * "{title}" in the UI is a legible bug, a silently truncated sentence is
 * not. No escaping is performed or needed — callers render the result as a
 * React text node, which escapes it.
 */
export function interpolate(
  template: string,
  params?: Record<string, string> | null
): string {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? params[key] : token
  );
}
