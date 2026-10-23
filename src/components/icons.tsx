import type { ReactNode } from "react";

type IconProps = { className?: string };

function Icon({ children, className }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ? `control-icon ${className}` : "control-icon"}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function AgentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3H7.5A2.5 2.5 0 0 1 5 12.5v-6Z" />
      <path d="m12 7.2.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" />
    </Icon>
  );
}

export function PublishIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 15V4" />
      <path d="m8 8 4-4 4 4" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </Icon>
  );
}

export function IncidentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12h4l2.2-5.5 4.1 11L16 12h5" />
    </Icon>
  );
}
