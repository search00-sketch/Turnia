// Íconos de línea (reemplazan a los emojis, que cambian según el teléfono).
type IconProps = { className?: string };

function Svg({ className = "h-5 w-5", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => <Svg {...p}><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" /></Svg>;
export const IconSearch = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>;
export const IconCalendar = (p: IconProps) => <Svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>;
export const IconUser = (p: IconProps) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></Svg>;
export const IconGrid = (p: IconProps) => <Svg {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Svg>;
export const IconPin = (p: IconProps) => <Svg {...p}><path d="M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></Svg>;
export const IconPhone = (p: IconProps) => <Svg {...p}><path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" /></Svg>;
export const IconChat = (p: IconProps) => <Svg {...p}><path d="M4 19l1.4-4A7.5 7.5 0 1 1 9 18.6z" /></Svg>;
export const IconRoute = (p: IconProps) => <Svg {...p}><path d="M12 2l8 20-8-5-8 5z" /></Svg>;
export const IconClock = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const IconBack = (p: IconProps) => <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
export const IconShare = (p: IconProps) => <Svg {...p}><path d="M12 15V3M8 7l4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" /></Svg>;
export const IconPlusBox = (p: IconProps) => <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></Svg>;
export const IconPlus = (p: IconProps) => <Svg {...p}><path d="M12 6v12M6 12h12" /></Svg>;
export const IconChevron = (p: IconProps) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>;
export const IconX = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
