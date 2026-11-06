export type OperatingHours = {
  enabled: boolean
  timezone: string
  days: number[]
  opensAt: string
  closesAt: string
  offlineGreeting: string
}

export type NotificationPreferences = {
  assignment: boolean
  reply: boolean
  mention: boolean
  followUp: boolean
  desktop: boolean
}

export type WorkspaceSettings = {
  operatingHours: OperatingHours
  notifications: NotificationPreferences
  routingEnabled: boolean
  assignmentMode: 'manual' | 'round-robin'
  defaultAssignee: string
  defaultAssigneeId?: string | null
  integrations: Record<string, { displayName: string; accountReference: string; savedAt: string }>
}

export const defaultWorkspaceSettings: WorkspaceSettings = {
  operatingHours: { enabled: true, timezone: 'Africa/Johannesburg', days: [1, 2, 3, 4, 5], opensAt: '08:00', closesAt: '17:00', offlineGreeting: 'Thanks for reaching out. Our team is currently offline and will reply during business hours.' },
  notifications: { assignment: true, reply: true, mention: true, followUp: true, desktop: false },
  routingEnabled: true,
  assignmentMode: 'manual',
  defaultAssignee: '',
  integrations: {},
}

export function mergeWorkspaceSettings(settings?: Partial<WorkspaceSettings>): WorkspaceSettings {
  return {
    ...defaultWorkspaceSettings,
    ...settings,
    operatingHours: { ...defaultWorkspaceSettings.operatingHours, ...settings?.operatingHours },
    notifications: { ...defaultWorkspaceSettings.notifications, ...settings?.notifications },
    integrations: { ...defaultWorkspaceSettings.integrations, ...settings?.integrations },
  }
}

export function isWithinOperatingHours(hours: OperatingHours, date: Date | number = Date.now()): boolean {
  if (!hours.enabled) return true
  try {
    const currentDate = typeof date === 'number' ? new Date(date) : date
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: hours.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(currentDate)
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find(part => part.type === 'weekday')?.value || '')
    const time = `${parts.find(part => part.type === 'hour')?.value}:${parts.find(part => part.type === 'minute')?.value}`
    return hours.days.includes(weekday) && time >= hours.opensAt && time < hours.closesAt
  } catch {
    return false
  }
}

export function isPreviewWithinHours(hours: OperatingHours, weekday: number, time: string): boolean {
  return !hours.enabled || (hours.days.includes(weekday) && time >= hours.opensAt && time < hours.closesAt)
}
