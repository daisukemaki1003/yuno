import type {
  MeetingDetail,
  MeetingListItem,
  MinutesSectionsEvent,
  TranscriptEvent,
} from "@/shared/types/meetings";

export const mockMeetings: MeetingListItem[] = [
  {
    id: "mock-meeting-001",
    title: "Webアプリ開発キックオフ",
    category: "ブレインストーミング",
    description:
      "Webアプリを新規で作成するためのミーティングです。プロジェクトの目標設定、技術スタック選定、チーム体制について議論しました。",
    tags: ["開発", "コーポレートサイトリニューアル", "XXX株式会社"],
    date: "2025/01/15",
  },
  {
    id: "mock-meeting-002",
    title: "営業戦略アップデート",
    category: "営業",
    description:
      "第2四半期の営業戦略と各チームのアクションプランについて確認しました。",
    tags: ["営業", "戦略", "四半期レビュー"],
    date: "2025/02/10",
  },
];

export const mockMeetingDetail: MeetingDetail = {
  id: "mock-meeting-001",
  title: "2025年6月 営業戦略ミーティング",
  date: "2025年6月5日（木） 14:00〜15:00",
  category: "製品開発, UI/UX",
  templateName: "営業会議テンプレート",
  minutesMarkdown: `## 議題\n1. 前回の営業活動の振り返り\\n2. 第2四半期の営業目標設定\\n3. 新規顧客獲得戦略\\n4. 営業チームの体制について\n\n### 1. 前回の営業活動の振り返り\n- 売上目標達成率: 95%（前年比+5%）\n- 新規顧客獲得数: 12社（目標15社）\n- 既存顧客からの追加受注: 8件（前年比+2件）`,
  transcriptText: `（14:00）\nA: それでは営業戦略ミーティングを始めます。\nB: よろしくお願いします。まずは前回の営業活動の振り返りから。\nA: 売上目標達成率は95%でした。新規顧客は12社獲得できました。\nB: 目標には少し届きませんでしたが、既存顧客からの追加受注が増えています。`,
};

export const mockTranscriptEvents: TranscriptEvent[] = [
  {
    type: "transcript",
    timestamp: Date.now(),
    data: {
      kind: "transcript",
      text: "ミーティングを開始します。目的とアジェンダを再確認してください。",
      lang: "ja",
      isFinal: true,
      ts: Date.now(),
      confidence: 0.92,
    },
  },
  {
    type: "transcript",
    timestamp: Date.now() + 1500,
    data: {
      kind: "transcript",
      text: "営業目標の達成率は95%で推移しています。",
      lang: "ja",
      isFinal: true,
      ts: Date.now() + 1500,
      confidence: 0.88,
    },
  },
];

export const mockMinutesEvents: MinutesSectionsEvent[] = [
  {
    meetingId: "mock-meeting-001",
    emittedAt: Date.now(),
    update: {
      meeting_id: "mock-meeting-001",
      changed_sections: [
        {
          id: "sec_overview",
          title: "営業状況の概要",
          status: "active",
          bullets: [
            "売上目標達成率は95%",
            "既存顧客からの追加受注が前年比+2件",
          ],
          actions: [
            {
              owner: "田中",
              task: "既存顧客へのフォローアップ計画を作成",
              due: "2025-06-12",
              confidence: 0.8,
            },
          ],
        },
      ],
      change_summary: {
        created_sections: ["sec_overview"],
        updated_sections: [],
        closed_sections: [],
      },
    },
    delta: {
      summaries: [
        "売上目標達成率は95%で推移し、既存顧客の追加受注が増加。",
      ],
      actions: [
        {
          owner: "田中",
          task: "既存顧客へのフォローアップ計画を作成",
          due: "2025-06-12",
          confidence: 0.8,
        },
      ],
      decisions: [],
      questions: [],
    },
    retry: false,
  },
];
