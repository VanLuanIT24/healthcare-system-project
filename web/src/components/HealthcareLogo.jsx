export default function HealthcareLogo() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="healthcare-logo">
      {/* Heart */}
      <defs>
        <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0084ff" />
          <stop offset="100%" stopColor="#00d4aa" />
        </linearGradient>
      </defs>
      
      {/* Heart shape */}
      <path
        d="M100,170 C30,130 10,100 10,75 C10,50 25,35 40,35 C50,35 60,42 70,52 C80,42 90,35 100,35 C115,35 130,50 130,75 C130,100 110,130 100,170 Z"
        fill="url(#heartGradient)"
      />
      
      {/* Heartbeat line */}
      <path
        d="M50,80 L55,80 L57,75 L60,85 L65,80 L75,80 L80,70 L150,70"
        stroke="white"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Bars chart */}
      <g transform="translate(85, 90)">
        <rect x="0" y="15" width="6" height="25" fill="#66ff00" rx="3" />
        <rect x="12" y="8" width="6" height="32" fill="#99ff00" rx="3" />
        <rect x="24" y="5" width="6" height="35" fill="#00ff00" rx="3" />
        <rect x="36" y="12" width="6" height="28" fill="#66ff00" rx="3" />
      </g>
      
      {/* Curve */}
      <path
        d="M40,150 Q100,170 160,140"
        stroke="#0084ff"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
