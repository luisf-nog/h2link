import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /**
   * altura em px (aplica no container). Mantém proporção.
   * default: 40
   */
  height?: number;
  className?: string;
  alt?: string;
  /** caminho do asset (ex: import logo from '@/assets/logo.png') */
  src?: string;
};

export function BrandLogo({ height = 40, className, alt = "H2Link", src }: BrandLogoProps) {
  return (
    <img
      src={src ?? "/placeholder.svg"}
      alt={alt}
      loading="eager"
      decoding="async"
      style={{ height }}
      className={cn("w-auto select-none", className)}
    />
  );
}
