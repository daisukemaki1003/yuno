export interface AddBotRequestPayload {
  meetingUrl: string;
  botName: string;
}

export interface AddBotResponse {
  botId: string;
  meetingId: string;
  status: string;
}
