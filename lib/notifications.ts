import { interpolate } from "@/lib/i18n/interpolate";
import type { AppNotification } from "@/types/notifications";
import type { Dictionary } from "@/types/i18n";

/**
 * Turns a stored notification row into a sentence in the reader's language.
 *
 * Rows written by the 0036 triggers carry `message_key` + `message_params`
 * instead of prose, precisely because the writer cannot know the reader's
 * locale. Free-text rows (announcements, and the pre-0036 seeds) carry no key
 * and render `title` as-is.
 *
 * Falls back to `title` for a key the dictionary doesn't have. That is not
 * hypothetical: the database can start writing a new key the moment its
 * migration is applied, which may be before the deploy carrying the matching
 * dictionary entry — this project has already been bitten by exactly that kind
 * of schema/deploy skew. A real title beats a raw key or a blank line.
 */
export function notificationMessage(
  dict: Dictionary,
  notification: AppNotification
): string {
  const { messageKey, messageParams, title } = notification;
  if (!messageKey) return title;

  const messages: Record<string, string> = dict.notifications.messages;
  const template = messages[messageKey];
  if (!template) return title;

  return interpolate(template, localizeParams(dict, messageParams));
}

/**
 * `accountApproved` stores the raw enum value (`student`, `aft_teacher`), which
 * is a database identifier, not something to show a user. The dictionary
 * already names every role, so translate it here rather than storing a second
 * localized copy at write time.
 */
function localizeParams(
  dict: Dictionary,
  params: Record<string, string>
): Record<string, string> {
  if (!params.role) return params;

  const roles: Record<string, string> = dict.roles;
  const label = roles[params.role];

  return label ? { ...params, role: label } : params;
}
