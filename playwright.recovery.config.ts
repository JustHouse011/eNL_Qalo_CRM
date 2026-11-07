import {defineConfig} from '@playwright/test'
import base from './playwright.config'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const contract = process.env.QALO_RECOVERY_CONTRACT === '1'
export default defineConfig({...base,outputDir:join(tmpdir(),`qalo-recovery-${contract?'contract':'ui'}`),testMatch:contract?'password-recovery-contract.spec.ts':['password-recovery.spec.ts','login-redesign.spec.ts'],webServer:{...(base.webServer as object),env:{VITE_STAFF_PASSWORD_RECOVERY_ENABLED:contract?'true':'false'}}})
