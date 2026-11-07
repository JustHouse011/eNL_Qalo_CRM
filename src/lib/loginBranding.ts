import { QALO_WORKSPACE_ID } from './workspaceTypes'
import { ENL_WORKSPACE_ID } from './enlWorkspace'

export const loginBrands = {
  qalo: { name: 'Qalo Ya Afrika', workspaceId: QALO_WORKSPACE_ID, logo: '/qalo-logo.png', heading: 'Every connection\nstarts with you.', description: 'Bring your people, conversations and customer experiences together. One connected workspace. A shared purpose.', feature: 'Connected customer experiences', photos: ['collaboration', 'portrait', 'team', 'support'] },
  enl: { name: 'eNL Mutual Bank', workspaceId: ENL_WORKSPACE_ID, logo: '/new%20logo%20full%20colour.svg', heading: 'A human touch.\nEvery interaction.', description: 'Responsive support starts with a connected team. Keep every customer conversation moving, with care and confidence.', feature: 'Responsive banking customer support', photos: ['team', 'portrait', 'support', 'collaboration'] },
} as const
export type LoginBrand = keyof typeof loginBrands
export const loginPathForWorkspace = (workspaceId?: string) => workspaceId === ENL_WORKSPACE_ID ? '/enl/signin' : '/qalo/signin'
