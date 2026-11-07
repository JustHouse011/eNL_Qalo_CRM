import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { cpSync } from 'node:fs'
import { resolve } from 'node:path'
export default defineConfig({build:{copyPublicDir:false},plugins:[react(),{name:'copy-browser-public-assets',writeBundle(){cpSync(resolve('public'),resolve('dist'),{recursive:true,filter:source=>! /\.(psd|psb)$/i.test(source)})}}]})
