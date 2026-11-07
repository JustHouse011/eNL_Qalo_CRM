import type {ReactNode} from 'react'
import {loginBrands,type LoginBrand} from '../lib/loginBranding'
import {LoginArtwork} from './LoginArtwork'
import './Login.css'

/** The single approved branded shell shared by staff sign-in and recovery routes. */
export function AuthLayout({brand,children,label}:{brand:LoginBrand;children:ReactNode;label?:string}){
 return <div className={`login-page login-brand-${brand}`}><main className="login-shell"><LoginArtwork brand={brand}/><section className="login-panel" aria-label={label||`${loginBrands[brand].name} staff sign-in`}>{children}</section></main></div>
}
