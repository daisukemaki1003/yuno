import React from "react";
import ReactMarkdown from "react-markdown";
import "@/styles/markdown.css";

type MeetingNoteProps = {
  markdown: string;
};

const MeetingNote: React.FC<MeetingNoteProps> = ({ markdown }) => {
  return (
    <div className="markdown-body w-full bg-white p-[24px] rounded-[16px]">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
};

export default MeetingNote;
