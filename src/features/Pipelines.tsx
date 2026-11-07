import {ApplicationsWorkspace} from './ApplicationsWorkspace'
import type {ModuleProps} from './Knowledge'
/** Qalo retains its existing application/workflow records in the shared workspace. */
export function Pipelines(props:ModuleProps){return <ApplicationsWorkspace {...props}/>}
