import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function Section({ title, children, className = "" }: SectionProps) {
  return (
    <section className={`iy-section ${className}`}>
      <h2 className="iy-section__title">{title}</h2>
      <div className="iy-section__body">{children}</div>
    </section>
  );
}
