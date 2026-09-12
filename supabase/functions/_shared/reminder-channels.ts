export type ReminderChannel = "in_app" | "email";

export type ReminderChannelConfig = {
  resendKey?: string | null;
  resendFrom?: string | null;
};

export function reminderChannelIsAvailable(channel: ReminderChannel, config: ReminderChannelConfig) {
  if (channel === "in_app") return true;
  return Boolean(config.resendKey?.trim() && config.resendFrom?.trim());
}
