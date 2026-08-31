export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  // A sentinel's shield with a watch-beam notch — the gate that config must pass.
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 2.5 27 6.5v9c0 7.2-4.7 12.4-11 14.9C9.7 27.9 5 22.7 5 15.5v-9L16 2.5Z"
        fill="url(#prahari-shield)"
        stroke="rgba(34,197,94,0.5)"
        strokeWidth="1.2"
      />
      <path
        d="m11 16.2 3.4 3.4L21.5 12"
        stroke="#22C55E"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="prahari-shield" x1="5" y1="2.5" x2="27" y2="30.4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#16223A" />
          <stop offset="1" stopColor="#0D1526" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Logo />
      <span className="font-mono text-lg font-semibold tracking-tight text-ink">prahari</span>
    </span>
  );
}
