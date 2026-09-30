import { Navigate } from 'react-router-dom'
/** Compatibility routes now lead exclusively to the standalone demo. */
export function LiveWorkspace({ customer = false }: { customer?: boolean }) {
  return <Navigate to={customer ? '/chat' : '/signin'} replace />
}
