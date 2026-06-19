type TagPillsProps = {
  tags: string[];
  size?: "sm" | "md";
  category?: string;
};

export function TagPills({ tags, size = "md", category }: TagPillsProps) {
  if (tags.length === 0) return null;

  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";

  return (
    <div className="flex flex-wrap gap-1.5">
      {category && (
        <span className="text-[10px] uppercase tracking-wider text-teal-300/60 w-full">
          {category}
        </span>
      )}
      {tags.map((tag) => (
        <span
          key={tag}
          className={`${sizeClass} rounded-full bg-teal-800/60 text-teal-100 border border-teal-700/50`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
