import NextLink, { LinkProps as NextLinkProps } from "next/link";
import { ReactNode } from "react";

interface LinkProps extends NextLinkProps {
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}

export default function Link({
  children,
  variant = "primary",
  className = "",
  ...props
}: LinkProps) {
  const variantClasses = {
    primary: "text-blue-500 hover:text-blue-600",
    secondary: "text-gray-500 hover:text-gray-600",
  };

  return (
    <NextLink
      className={`transition-colors ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </NextLink>
  );
}
