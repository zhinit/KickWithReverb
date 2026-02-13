export interface KickData {
  id: number;
  name: string;
  audioUrl: string;
}

export interface KickListResponse {
  kicks: KickData[];
  remainingGensToday: number;
  totalGensCount: number;
}

export interface GenerateKickResponse extends KickData {
  remainingGensToday: number;
  totalGensCount: number;
}
