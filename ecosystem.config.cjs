module.exports = {
  apps: [
    {
      name: '使徒',
      script: 'dist/index.js',
      cwd: '/Users/oct26th/Library/CloudStorage/GoogleDrive-io.mxxvi@gmail.com/My Drive/nerv-hq/tools/claudecode-discord',
      // dotenv/config is imported in src/index.ts — no need for --env-file
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      merge_logs: true,
      time: true,
      // Clean up stale lock file before each start to handle crash recovery
      pre_start: 'rm -f .bot.lock',
    },
  ],
}
