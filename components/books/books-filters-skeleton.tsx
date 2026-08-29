import { Skeleton } from "@/components/ui/skeleton";

export function BooksFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Skeleton className="h-8 min-w-48 flex-1 sm:max-w-64" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-8 w-32" />
    </div>
  );
}
