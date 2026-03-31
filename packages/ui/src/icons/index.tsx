import Svg, { Path, Circle, Rect, type SvgProps } from "react-native-svg";

export interface IconProps extends SvgProps {
  size?: number;
  color?: string;
}

const defaults = { size: 24, color: "#0F172A" };

/** Padel racket icon */
export function RacketIcon({ size = defaults.size, color = defaults.color, ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M15.5 2C18.54 2 21 4.46 21 7.5c0 2.76-2.04 5.05-4.7 5.44L13 16.24V19h1.5a.75.75 0 010 1.5H13V22a.75.75 0 01-1.5 0v-1.5H10a.75.75 0 010-1.5h1.5v-2.76L8.2 12.94C5.54 12.55 3.5 10.26 3.5 7.5 3.5 4.46 5.96 2 9 2h6.5z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 5.5v4M12.25 5.5v4M15.5 5.5v4M6.5 7h11"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.5}
      />
    </Svg>
  );
}

/** Court icon (top-down view) */
export function CourtIcon({ size = defaults.size, color = defaults.color, ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Rect
        x={2}
        y={4}
        width={20}
        height={16}
        rx={2}
        stroke={color}
        strokeWidth={1.5}
      />
      <Path d="M12 4v16" stroke={color} strokeWidth={1.5} />
      <Rect
        x={5}
        y={7}
        width={14}
        height={10}
        rx={1}
        stroke={color}
        strokeWidth={1}
        opacity={0.4}
      />
      <Path d="M12 7v10" stroke={color} strokeWidth={1} opacity={0.4} />
    </Svg>
  );
}

/** Ball icon */
export function BallIcon({ size = defaults.size, color = defaults.color, ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
      <Path
        d="M7.5 4.5C9.5 7 9.5 17 7.5 19.5M16.5 4.5C14.5 7 14.5 17 16.5 19.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
