import { NextRequest, NextResponse } from "next/server";

/**
 * @openapi
 * /api/meet/bot:
 *   post:
 *     summary: Google Meet にボットを追加
 *     description: Meeting BaaS を使ってボットを会議に追加します
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [meetingUrl]
 *             properties:
 *               meetingUrl:
 *                 type: string
 *                 example: "https://meet.google.com/abc-defg-hij"
 *     responses:
 *       200:
 *         description: ボット作成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 botId:
 *                   type: string
 *                   example: bot_123
 *                 inputWsUrl:
 *                   type: string
 *                   example: wss://example.com/in/bot_123
 *                 outputWsUrl:
 *                   type: string
 *                   example: wss://example.com/out/bot_123
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.meetingUrl) {
      return NextResponse.json({ error: "meetingUrl が必要です" }, { status: 400 });
    }

    // TODO: 実際には Meeting BaaS API を叩く
    const mockResponse = {
      botId: "bot_123",
      inputWsUrl: "wss://example.com/in/bot_123",
      outputWsUrl: "wss://example.com/out/bot_123",
    };

    return NextResponse.json(mockResponse, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "無効なリクエスト" }, { status: 400 });
  }
}
