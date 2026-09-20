import type { Filters, Rubric } from "../models/criteria";

interface Props {
  query: string;
  onChange: (q: string) => void;
  onSearch: () => void;
  loading: boolean;
}

export function SearchBar({ query, onChange, onSearch, loading }: Props) {
  return (
    <div className="search-row">
      <input
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
        placeholder="e.g. RDS developers, 4-7 years, startups, Bangalore"
      />
      <button
        className="btn btn-primary"
        onClick={onSearch}
        disabled={loading || !query.trim()}
      >
        {loading ? "Searching" : "Search"}
      </button>
    </div>
  );
}
