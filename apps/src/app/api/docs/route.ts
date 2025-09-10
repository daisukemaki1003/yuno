import { NextRequest } from "next/server";
import { swaggerSpec } from "@/swagger";
// import swaggerUi from "swagger-ui-express";
import { NextApiResponse } from "next";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Next.js App Routerでは Express ミドルウェアがそのまま使えないため、
  // 代わりに swagger.json を返して Swagger UI と組み合わせる方法を取ります
  return new Response(JSON.stringify(swaggerSpec), {
    headers: { "Content-Type": "application/json" },
  });
}
