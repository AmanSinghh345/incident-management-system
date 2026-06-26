export interface CreateMonitorDto {
  name: string;
  url: string;
  intervalSeconds: number;
}

export interface UpdateMonitorDto {
  name?: string;
  url?: string;
  intervalSeconds?: number;
  isActive?: boolean;
}
