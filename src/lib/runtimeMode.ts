/** Explicit local presentation data only. Production builds never enable generated records. */
export const crmDemoMode = import.meta.env.DEV && import.meta.env.VITE_CRM_DEMO_MODE === 'true'
