// PM2: pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup
module.exports = {
  apps: [{
    name: 'online-dokon',
    cwd: __dirname + '/../backend',
    script: 'src/server.js',
    instances: 1,
    env: { NODE_ENV: 'production' },
    max_memory_restart: '300M',
  }],
};
