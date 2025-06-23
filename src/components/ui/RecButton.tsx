import React from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { PlusIcon } from "lucide-react";

interface RecButtonProps {
  isRecording: boolean;
  recordingTime?: string;
  onClick?: () => void;
  disabled?: boolean;
}

const RecButton: React.FC<RecButtonProps> = ({
  isRecording,
  recordingTime = "00:00:00",
  onClick,
  disabled = false,
}) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size="sm"
      variant={isRecording ? "secondary" : "default"}
      className={cn(
        "gap-2",
        isRecording && "bg-gray-600 text-white hover:bg-gray-700",
        !isRecording && "bg-primary text-primary-foreground hover:bg-[#3E5DE3]"
      )}
    >
      {/* 録音インジケーター */}
      {isRecording && <RecIndicator isRecording={isRecording} />}

      {/* 録音開始ボタン */}
      {!isRecording && <PlusIcon className="h-4 w-4" />}

      {/* テキスト */}
      <span>{isRecording ? `録音中 ${recordingTime}` : "録音開始"}</span>
    </Button>
  );
};

export default RecButton;

// 録音インジケーター
const RecIndicator = ({ isRecording }: { isRecording: boolean }) => {
  return (
    <div className="relative h-3 w-3">
      {isRecording && (
        <div className="absolute h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
      )}
      <div
        className={cn(
          "absolute inset-0 m-auto h-2 w-2 rounded-full",
          isRecording ? "bg-red-500" : "bg-white"
        )}
      />
    </div>
  );
};
