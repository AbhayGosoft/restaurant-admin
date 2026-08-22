import type { LucideIcon } from "lucide-react";
import { WifiOff } from "lucide-react";
import { Button } from "./Button";

export function LoadingGrid() {
  return <div className="loading-grid">{[1, 2, 3, 4].map((i) => <div className="skeleton" key={i} />)}</div>;
}

export function StateView({ icon: Icon = WifiOff, title, message, action }: {
  icon?: LucideIcon; title: string; message: string; action?: () => void;
}) {
  return (
    <div className="state-view">
      <span className="state-view__icon"><Icon size={24} /></span>
      <h3>{title}</h3><p>{message}</p>
      {action && <Button variant="secondary" onClick={action}>Try again</Button>}
    </div>
  );
}
