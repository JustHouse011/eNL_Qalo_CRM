import type { DemoData, Conversation, Message, DemoTicket } from '../data/demoData'
import type { BusinessArea } from './business'
export type ListQuery = { cursor?: string; limit?: number; search?: string; businessArea?: BusinessArea; status?: string; assigneeId?: string; from?: string; to?: string; sort?: 'createdAt' | 'updatedAt'; direction?: 'asc' | 'desc' }
export type Page<T> = { items: T[]; nextCursor: string | null; total: number }
export type ApiError = { code: 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMIT' | 'UNAVAILABLE'; message: string; fields?: Record<string, string>; retryAfter?: number }
export type SendMessage = { text: string; kind: Message['kind']; attachmentIds?: string[]; clientRequestId: string }
export type Attachment = { id: string; name: string; mimeType: string; size: number; status: 'pending' | 'ready' | 'rejected'; downloadUrl?: string }
export type RealtimeEvent = { id: string; workspaceId: string; entityId: string; revision: number; at: string; type: 'conversation.updated' | 'message.created' | 'ticket.updated' | 'notification.created' | 'presence.changed' | 'integration.updated'; payload: unknown }
/** Proposed API adapter contract, subject to backend agreement. No transport is implemented. */
export interface BackendContract {
  conversations(query: ListQuery): Promise<Page<Conversation>>
  updateConversation(id: string, patch: Partial<Conversation>, revision: number): Promise<Conversation>
  sendMessage(conversationId: string, input: SendMessage): Promise<Message>
  tickets(query: ListQuery): Promise<Page<DemoTicket>>
  saveTicket(ticket: DemoTicket): Promise<DemoTicket>
  contacts(query: ListQuery): Promise<Page<DemoData['contacts'][number]>>
  articles(query: ListQuery): Promise<Page<DemoData['articles'][number]>>
  prepareAttachment(input: Pick<Attachment, 'name' | 'mimeType' | 'size'>): Promise<{ attachment: Attachment; uploadUrl: string }>
  subscribe(listener: (event: RealtimeEvent) => void): () => void
}
