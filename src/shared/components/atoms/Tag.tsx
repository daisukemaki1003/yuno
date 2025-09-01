import { ReactNode } from "react";

interface TagProps {
  children: ReactNode;
  className?: string;
}

export default function Tag({ children, className = "" }: TagProps) {
  return (
    <span className={`text-xs text-gray-500 hover:text-gray-700 ${className}`}>
      # {children}
    </span>
  );
}
