import { cn } from "@/lib/utils";
import h2linkLogo from "@/assets/h2link-logo.jpg";
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
export function BrandLogo({
  height = 40,
  className,
  alt = "H2 Linker",
  src
}: BrandLogoProps) {
  return <img src={src ?? h2linkLogo} alt={alt} loading="eager" decoding="async" style={{
    height
  }} className={cn("w-auto select-none object-cover", className)} />;
}