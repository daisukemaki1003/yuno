import Link from "next/link";
import { ROUTES } from "@/constants/routes";

interface LogoProps {
  size?: "sm" | "md" | "lg";
}

export default function Logo({ size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <Link href={ROUTES.HOME} className={`font-bold text-blue-600 ${sizeClasses[size]}`}>
      Yuno
    </Link>
  );
}
