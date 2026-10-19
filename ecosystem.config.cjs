module.exports = {
  apps: [
    {
      name: 'bot-news',
      script: 'src/index.ts',
      interpreter: 'node', // pm2 mặc định chạy .ts bằng ts-node; Node >= 22.18 tự chạy được .ts
      cwd: __dirname,
      node_args: '--env-file=.env',
    },
  ],
};
