/**
 * PM2 Ecosystem Configuration
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save && pm2 startup
 *
 * Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/
 */
module.exports = {
  apps: [
    {
      name:              'labcollect-api',
      script:            'server.js',
      cwd:               __dirname,
      instances:         'max',           // one per CPU core
      exec_mode:         'cluster',       // Node cluster for zero-downtime restarts
      watch:             false,
      max_memory_restart: '512M',

      // Restart strategy
      restart_delay:    3000,             // wait 3s between restarts
      max_restarts:     10,               // give up after 10 consecutive crashes
      min_uptime:       '10s',            // must be up 10s to count as "started"

      // Graceful shutdown
      kill_timeout:      5000,            // give 5s for in-flight requests to finish
      wait_ready:        true,            // wait for process.send('ready') signal
      listen_timeout:    10000,

      // Logging
      log_date_format:  'YYYY-MM-DD HH:mm:ss',
      out_file:         './logs/pm2-out.log',
      error_file:       './logs/pm2-error.log',
      merge_logs:       true,             // merge logs from all cluster instances

      env: {
        NODE_ENV: 'development',
        PORT:     5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT:     5000,
      },
    },
  ],
};
