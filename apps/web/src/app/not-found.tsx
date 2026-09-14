import { EmptyState } from "@/components/shell";
export default function NotFound() {
  return (
    <EmptyState
      title="This find has wandered off"
      description="The page you’re looking for doesn’t exist. There’s plenty more to discover nearby."
      href="/"
      label="Back to discovering"
    />
  );
}
