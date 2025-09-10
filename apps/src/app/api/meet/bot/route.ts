import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
 *             required: [meetingUrl, botName]
 *             properties:
 *               meetingUrl:
 *                 type: string
 *                 example: "https://meet.google.com/abc-defg-hij"
 *               botName:
 *                 type: string
 *                 example: "AI Notetaker"
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
 *       401:
 *         description: 認証エラー
 *       400:
 *         description: リクエストエラー
 *       500:
 *         description: サーバーエラー
 */
export async function POST(req: NextRequest) {
  try {
    // セッション確認
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // リクエストボディの取得
    const body = await req.json();

    // 必須パラメータのバリデーション
    if (!body.meetingUrl || !body.botName) {
      return NextResponse.json(
        { error: "meetingUrl と botName が必要です" },
        { status: 400 }
      );
    }

    // API キーの取得
    const apiKey = process.env.MEETING_BAAS_API_KEY;
    if (!apiKey) {
      console.error("Meeting BaaS API key is not configured");
      return NextResponse.json(
        { error: "サーバー設定エラー" },
        { status: 500 }
      );
    }

    // Meeting BaaS API へのリクエスト
    const response = await fetch("https://api.meetingbaas.com/bots", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-meeting-baas-api-key": apiKey,
      },
      body: JSON.stringify({
        meeting_url: body.meetingUrl,
        bot_name: body.botName,
        reserved: false,
        recording_mode: "speaker_view",
        // bot_image: "https://example.com/bot.jpg",
        entry_message: "I am a good meeting bot :)",
        speech_to_text: {
          provider: "Default",
        },
        automatic_leave: {
          waiting_room_timeout: 600,
        },
      }),
    });

    // レスポンスの処理
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Meeting BaaS API error:", response.status, errorData);

      if (response.status === 401) {
        return NextResponse.json(
          { error: "API キーが無効です" },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: errorData?.message || "ボットの作成に失敗しました" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 成功レスポンス
    return NextResponse.json(
      {
        botId: data.bot_id,
        inputWsUrl: data.input_ws_url,
        outputWsUrl: data.output_ws_url,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating bot:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
