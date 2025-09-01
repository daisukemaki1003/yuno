import React, {useState} from "react";
import {Button} from "@/shared/components/atoms/Button";
import {cn} from "@/lib/utils";
import {PlusIcon} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/atoms/dialog";
import {Input} from "@/shared/components/atoms/Input";
import {Label} from "@/shared/components/atoms/label";

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
  const [open, setOpen] = useState(false);
  const [meetUrl, setMeetUrl] = useState("");
  const [botName, setBotName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDialogOpen = () => {
    if (!isRecording) {
      setOpen(true);
    }
  };

  const handleStartRecording = async () => {
    if (!meetUrl || !botName) {
      alert("Google MeetのURLとボット名を入力してください。");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/meet/bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meetUrl,
          botName,
        }),
      });

      if (!response.ok) {
        throw new Error("ボットの追加に失敗しました");
      }

      const data = await response.json();
      console.log("Bot added successfully:", data);

      setOpen(false);
      setMeetUrl("");
      setBotName("");

      if (onClick) {
        onClick();
      }
    } catch (error) {
      console.error("Error adding bot:", error);
      alert("ボットの追加に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        onClick={isRecording ? onClick : handleDialogOpen}
        disabled={disabled}
        size="sm"
        variant={isRecording ? "rec" : "default"}
        className={cn("gap-2")}
      >
        {/* 録音インジケーター */}
        {isRecording && <RecIndicator isRecording={isRecording} />}

        {/* 録音開始ボタン */}
        {!isRecording && <PlusIcon className="h-4 w-4" />}

        {/* テキスト */}
        <span>{isRecording ? `録音中 ${recordingTime}` : "録音開始"}</span>
      </Button>

      <RecStartDialog
        open={open}
        setOpen={setOpen}
        meetUrl={meetUrl}
        setMeetUrl={setMeetUrl}
        botName={botName}
        setBotName={setBotName}
        isSubmitting={isSubmitting}
        handleStartRecording={handleStartRecording}
      />
    </>
  );
};

export default RecButton;

// 録音インジケーター
const RecIndicator = ({isRecording}: {isRecording: boolean}) => {
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

// 録音開始ダイアログ
interface RecStartDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  meetUrl: string;
  setMeetUrl: (meetUrl: string) => void;
  botName: string;
  setBotName: (botName: string) => void;
  isSubmitting: boolean;
  handleStartRecording: () => void;
}
const RecStartDialog = ({open, setOpen, meetUrl, setMeetUrl, botName, setBotName, isSubmitting, handleStartRecording}: RecStartDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Google Meetボットの設定</DialogTitle>
          <DialogDescription>
            Google MeetのURLとボット名を入力してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="meet-url" className="text-right">
              Meet URL
            </Label>
            <Input
              id="meet-url"
              value={meetUrl}
              onChange={(e) => setMeetUrl(e.target.value)}
              className="col-span-3"
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bot-name" className="text-right">
              ボット名
            </Label>
            <Input
              id="bot-name"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              className="col-span-3"
              placeholder="録音ボット"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
          <Button
            type="submit"
            onClick={handleStartRecording}
            disabled={isSubmitting || !meetUrl || !botName}
          >
            {isSubmitting ? "追加中..." : "録音開始"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
