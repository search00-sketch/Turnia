import { APP_NAME } from "@/lib/config";

/** "turnia." — el punto en rosa. `onDark` para fondos ciruela. */
export default function Logo({ onDark = false, className = "text-2xl" }: { onDark?: boolean; className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${onDark ? "text-white" : "text-plum-900"} ${className}`}>
      {APP_NAME.toLowerCase()}
      <span className={onDark ? "text-brand-300" : "text-brand-600"}>.</span>
    </span>
  );
}
