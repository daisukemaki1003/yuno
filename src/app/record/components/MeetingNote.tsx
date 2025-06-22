import React from "react";
import ReactMarkdown from "react-markdown";
import "github-markdown-css";
import "@/styles/github-markdown-override.css";

interface MeetingNoteProps {
  content?: string;
}

const MeetingNote: React.FC<MeetingNoteProps> = ({ content }) => {
  // デフォルトのMarkdownコンテンツ
  const defaultContent = `
## 1. 課題

こちらはダミーテキストです、文字の大きさや書体のサンプルです
こちらはダミーテキストです、文字の大きさや書体のサンプルです
こちらはダミーテキストです、文字の大きさや書体のサンプルです
こちらはダミーテキストです、文字の大きさや書体のサンプルです

- こちらはダミーテキストです
  こちらはダミーテキストです
  - こちらはダミーテキストです
  - こちらはダミーテキストです
- こちらはダミーテキストです
  こちらはダミーテキストです
  こちらはダミーテキストです
  こちらはダミーテキストです

## 2. スケジュール

こちらはダミーテキストです、文字の大きさや書体のサンプルです
こちらはダミーテキストです、文字の大きさや書体のサンプルです
こちらはダミーテキストです、文字の大きさや書体のサンプルです
こちらはダミーテキストです、文字の大きさや書体のサンプルです

### 2-1. コーディング工数

こちらはダミーテキストです、文字の大きさや書体のサンプルです

こちらはダミーテキストです
こちらはダミーテキストです

こちらはダミーテキストです
こちらはダミーテキストです
こちらはダミーテキストです

### 2-2. 日程の調整

こちらはダミーテキストです、文字の大きさや書体のサンプルです

こちらはダミーテキストです
こちらはダミーテキストです
こちらはダミーテキストです

- こちらはダミーテキストです
  こちらはダミーテキストです
- こちらはダミーテキストです
  こちらはダミーテキストです
- こちらはダミーテキストです[リンク](https://example.com)こちらはダミーテキストです
`;

  return (
    <div className="w-full rounded-lg bg-white p-8">
      <div className="markdown-body">
        <ReactMarkdown>{content || defaultContent}</ReactMarkdown>
      </div>
    </div>
  );
};

export default MeetingNote;
