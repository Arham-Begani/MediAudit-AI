import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const ScanIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M3 12h18" />
  </svg>
);

export const ShieldIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3 5 6v5c0 4.4 3 7.7 7 9 4-1.3 7-4.6 7-9V6l-7-3Z" />
    <path d="m9.5 12 1.8 1.8 3.2-3.6" />
  </svg>
);

export const LockIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
);

export const ChevronDown = (p: P) => (
  <svg {...base} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const ArrowRight = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="m5 12.5 4.5 4.5L19 6.5" />
  </svg>
);

export const PhoneIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 5.5C4.5 4.7 5.2 4 6 4h2.2c.6 0 1.1.4 1.3 1l.9 3c.2.5 0 1.1-.4 1.4l-1.4 1.1a12 12 0 0 0 5 5l1.1-1.4c.3-.4.9-.6 1.4-.4l3 .9c.6.2 1 .7 1 1.3V19c0 .8-.7 1.5-1.5 1.5A15.5 15.5 0 0 1 4.5 5.5Z" />
  </svg>
);

export const CopyIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </svg>
);

export const AlertIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10.3 3.8 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3l-7.9-13.7a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4.5M12 17h.01" />
  </svg>
);

export const StampIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 4.5A2.5 2.5 0 0 1 11.5 2h1A2.5 2.5 0 0 1 15 4.5c0 1.6-1.3 2.6-1.3 4.2 0 .8.6 1.3 1.4 1.3h2.4a3 3 0 0 1 3 3V14H3v-1a3 3 0 0 1 3-3h2.5c.8 0 1.4-.5 1.4-1.3C9.9 7.1 9 6.1 9 4.5Z" />
    <path d="M3.5 17.5h17" />
  </svg>
);

export const ScaleIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3v18M7 21h10M5 7l-2.5 6a3 3 0 0 0 5 0L5 7Zm14 0-2.5 6a3 3 0 0 0 5 0L19 7ZM5 7l7-1.5L19 7" />
  </svg>
);

export const DecodeIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-2" />
    <path d="M8 9h4M8 12h8M8 15h6" />
  </svg>
);

export const PulseIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 12h4l2.5-6 5 12L17 12h4" />
  </svg>
);

export const PinIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

export const PenIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14.5 5.5 18.5 9.5M4 20l1-4L16 5a2 2 0 0 1 3 0 2 2 0 0 1 0 3L8 19l-4 1Z" />
  </svg>
);

export const RefreshIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 11a8 8 0 0 1 13.7-5.3L20 8M20 4v4h-4M20 13a8 8 0 0 1-13.7 5.3L4 16M4 20v-4h4" />
  </svg>
);

export const UploadIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
);

export const ImageIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m4.5 17 4.5-4 3 2.5L16 11l3.5 3.5" />
  </svg>
);

export const FileIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M14 3v5h5" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const CameraIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 8.5A2 2 0 0 1 6 6.5h1.6l1-2h4.8l1 2H16a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5Z" />
    <circle cx="11" cy="12.5" r="3" />
  </svg>
);

export const SparkleIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3.5c.6 3.7 1.8 4.9 5.5 5.5-3.7.6-4.9 1.8-5.5 5.5-.6-3.7-1.8-4.9-5.5-5.5 3.7-.6 4.9-1.8 5.5-5.5Z" />
    <path d="M18.5 14.5c.3 1.6.8 2.1 2.5 2.5-1.7.3-2.2.9-2.5 2.5-.3-1.6-.8-2.2-2.5-2.5 1.7-.4 2.2-.9 2.5-2.5Z" />
  </svg>
);
