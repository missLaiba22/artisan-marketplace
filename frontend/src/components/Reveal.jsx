import { useInView } from "../hooks/useInView";

// Thin wrapper: fades + lifts children into place once they scroll into
// view. `delay` (ms) lets sibling items stagger instead of popping together.
export default function Reveal({ children, delay = 0, className = "" }) {
  const [ref, inView] = useInView();

  return (
    <div
      ref={ref}
      className={`reveal ${inView ? "reveal-visible" : ""} ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}