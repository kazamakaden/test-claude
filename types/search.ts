/**
 * §18 global search.
 *
 * The entity set is closed and mirrors what public.search_all (0059) returns.
 * `attendance` is deliberately absent — §15 data is not searchable at all, by
 * anyone, and adding it here would be the first step toward making it so.
 */
export const searchEntities = ["member", "activity", "project", "document", "book"] as const;

export type SearchEntity = (typeof searchEntities)[number];

export function isSearchEntity(value: string): value is SearchEntity {
  return (searchEntities as readonly string[]).includes(value);
}

export interface SearchHit {
  entity: SearchEntity;
  id: string;
  title: string;
  /** Student ID, location or workflow status, depending on the entity. */
  subtitle: string | null;
  href: string;
}

export interface SearchResults {
  /** Grouped in the order of `searchEntities`, empty groups omitted. */
  groups: { entity: SearchEntity; hits: SearchHit[] }[];
  total: number;
}
