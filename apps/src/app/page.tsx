import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

export default function HomePage() {
  // middlewareでリダイレクト処理を行うため、
  // このページは通常表示されない
  redirect(ROUTES.SIGNIN);
}