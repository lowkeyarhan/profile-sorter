import type { ApiError } from "../api/http";

interface Props {
  error: string | null;
  onDismiss: () => void;
}

export function ErrorBox({ error, onDismiss }: Props) {
  if (!error) return null;
  return (
    <div className="error-banner">
      {error}
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  );
}
