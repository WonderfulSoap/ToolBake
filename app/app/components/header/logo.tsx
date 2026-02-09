interface LogoProps {
  className?: string;
}

// Logo component with theme-aware coloring that inherits from text color
export function Logo({ className = "h-8 w-8" }: LogoProps) {
  return (
    <svg
      viewBox="40 40 636 636"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ fillRule: "evenodd", clipRule: "evenodd" }}
    >
      <g transform="translate(-749.086 0)">
        {/* Dotted circle - uses currentColor to follow theme accent */}
        <g transform="translate(595.086 -154)">
          <circle
            cx="512"
            cy="512"
            r="288"
            pathLength="1000"
            style={{
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "14px",
              strokeLinecap: "round",
              strokeDasharray: "2 18",
            }}
          />
        </g>
        {/* Top dot - uses currentColor to follow theme accent */}
        <g transform="translate(206.086 -40.883)">
          <circle cx="760" cy="278" r="14" style={{ fill: "currentColor" }} />
        </g>
        {/* Spiral path - uses currentColor to follow theme accent */}
        <g transform="translate(650.086 -177)">
          <path
            d="M364,372C396,340 450,340 482,372L588,478C620,510 620,564 588,596L486,698C454,730 400,730 368,698L340,670C308,638 308,584 340,552L442,450"
            style={{
              fill: "none",
              fillRule: "nonzero",
              stroke: "currentColor",
              strokeWidth: "34px",
              strokeLinecap: "round",
              strokeLinejoin: "round",
            }}
          />
        </g>
        {/* Eye outer circle - light background with dark border */}
        <g transform="translate(650.086 -177)">
          <circle
            cx="406"
            cy="632"
            r="28"
            className="fill-primary/10 dark:fill-primary/20"
            style={{
              stroke: "rgb(15,23,42)",
              strokeWidth: "14px",
            }}
          />
        </g>
        {/* Eye pupil - dark center */}
        <g transform="translate(650.086 -177)">
          <circle cx="406" cy="632" r="9" style={{ fill: "rgb(15,23,42)" }} />
        </g>
      </g>
    </svg>
  );
}
