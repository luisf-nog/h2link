import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  /**
   * altura em px (aplica no container). Mantém proporção.
   * default: 40
   */
  height?: number;
  className?: string;
};

export function BrandWordmark({
  height = 40,
  className,
}: BrandWordmarkProps) {
  // Calculate font size based on height (roughly 60% of height)
  const fontSize = Math.round(height * 0.55);
  
  return (
    <div 
      className={cn("flex items-center select-none", className)}
      style={{ height }}
    >
      <span 
        className="font-brand font-bold tracking-tight text-foreground"
        style={{ fontSize }}
      >
        H2 <span className="text-primary">Linker</span>
      </span>
    </div>
  );
}
