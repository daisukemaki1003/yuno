// src/swagger.ts
import path from "path";
import swaggerJSDoc from "swagger-jsdoc";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0", // OpenAPIのバージョン
    info: {
      title: "Meeting Bot API", // APIのタイトル（画面に表示される）
      version: "1.0.0",         // APIのバージョン
      description: "Google Meetボット用のAPI仕様書", // 説明
    },
  },
  // JSDocコメントを探す範囲
  apis: [
    path.resolve(process.cwd(), "src/app/api/**/*.ts"),
    path.resolve(process.cwd(), "src/app/api/**/*.tsx"),
  ],

};

// swaggerSpec をエクスポート
export const swaggerSpec = swaggerJSDoc(options);
