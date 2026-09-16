import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.CRE_PROXY_TARGET || 'http://localhost:2000/trigger'
  const monitorProxyTarget = env.CRE_MONITOR_PROXY_TARGET || 'http://localhost:2000/trigger'

  return {
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: false,
      proxy: {
        '/cre-proxy': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/cre-proxy/, ''),
        },
        '/cre-monitor-proxy': {
          target: monitorProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/cre-monitor-proxy/, ''),
        },
      },
    },
  }
})
