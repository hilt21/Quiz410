import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
  plugins: [vue()],
  publicDir: 'content',
  base: process.env.BASE_PATH || '/',
  build: { target: 'es2022' },
});
