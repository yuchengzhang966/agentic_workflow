/** Inline SVG icon set — stroke icons, no icon-font dependency. */
import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}

function svg(
  paths: React.ReactNode,
  { size = 16, color = 'currentColor', style, className }: IconProps,
  filled = false,
) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={filled ? 'none' : color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

export const HexIcon = (p: IconProps) =>
  svg(<path d="M12 2.5 21 7.5v9L12 21.5 3 16.5v-9Z" />, p);

export const EyeIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>,
    p,
  );

export const CodeIcon = (p: IconProps) =>
  svg(<><path d="m9 18 6-12" /><path d="m16 8 4 4-4 4" /><path d="m8 16-4-4 4-4" /></>, p);

export const ArrowRightIcon = (p: IconProps) =>
  svg(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>, p);

export const ChevronLeftIcon = (p: IconProps) => svg(<path d="m15 6-6 6 6 6" />, p);
export const ChevronRightIcon = (p: IconProps) => svg(<path d="m9 6 6 6-6 6" />, p);
export const ChevronDownIcon = (p: IconProps) => svg(<path d="m6 9 6 6 6-6" />, p);

export const LockIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>,
    p,
  );

export const ExternalIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </>,
    p,
  );

export const CopyIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>,
    p,
  );

export const CheckIcon = (p: IconProps) => svg(<path d="m5 13 4 4L19 7" />, p);
export const XIcon = (p: IconProps) => svg(<><path d="M6 6 18 18" /><path d="M18 6 6 18" /></>, p);

export const FolderIcon = (p: IconProps) =>
  svg(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />, p);

export const FileIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M14 3v5h5" />
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    </>,
    p,
  );

export const RefreshIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7-3.3" />
      <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7 3.3" />
      <path d="M21 4v5h-5" />
      <path d="M3 20v-5h5" />
    </>,
    p,
  );

export const LoaderIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M12 3v4" opacity="1" />
      <path d="M12 17v4" opacity="0.3" />
      <path d="m5.6 5.6 2.9 2.9" opacity="0.6" />
      <path d="m15.5 15.5 2.9 2.9" opacity="0.3" />
      <path d="M3 12h4" opacity="0.5" />
      <path d="M17 12h4" opacity="0.3" />
      <path d="m5.6 18.4 2.9-2.9" opacity="0.4" />
      <path d="m15.5 8.5 2.9-2.9" opacity="0.8" />
    </>,
    p,
  );

export const AlertIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16.5v.5" />
    </>,
    p,
  );

export const BracketsIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M8 4H6a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-2" />
    </>,
    p,
  );

export const GearIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>,
    p,
  );
