export default function GcodeMonogram({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="gcode-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="50%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      
      {/* Background circle */}
      <circle cx="50" cy="50" r="48" fill="url(#gcode-gradient)" />
      
      {/* Interlocking 'g' and 'c' */}
      <g transform="translate(50, 50)">
        {/* 'g' shape - curves from top, loops down */}
        <path
          d="M -15 -20 Q -25 -20 -25 -10 Q -25 0 -15 0 Q -10 0 -10 5 Q -10 10 -5 10 Q 0 10 0 5 Q 0 0 5 0 Q 10 0 10 5 Q 10 15 0 15 Q -10 15 -10 5"
          stroke="white"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* 'c' shape - curves from top right, interlocking with 'g' */}
        <path
          d="M 5 -20 Q 15 -20 15 -10 Q 15 0 5 0 Q -5 0 -5 -10 Q -5 -20 5 -20"
          stroke="white"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

