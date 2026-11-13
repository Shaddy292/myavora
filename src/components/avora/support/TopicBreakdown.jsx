/** Open-vs-total requests per ticket topic, as proportional bars. */
export default function TopicBreakdown({ topics = [] }) {
  if (topics.length === 0) {
    return <p className="px-4 py-6 text-[12.5px] text-[#9A8CA8]">No requests recorded yet.</p>;
  }

  const max = Math.max(...topics.map((topic) => topic.total || 0), 1);

  return (
    <ul className="space-y-3 px-4 py-4">
      {topics.map((topic) => (
        <li key={topic.topic}>
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="truncate font-semibold text-[#1B1024]">{topic.topic}</span>
            <span className="shrink-0 text-[#8B7A9C]">
              {topic.open} open · {topic.total} total
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#F3ECF9]">
            <div
              className="h-full rounded-full bg-[#4B2080]"
              style={{ width: `${Math.max(4, Math.round(((topic.total || 0) / max) * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
