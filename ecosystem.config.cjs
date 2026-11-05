module.exports = {
  apps: [
    {
      name: 'bot-news',
      script: 'index.mjs', // build từ src/ bằng npm run build
      cwd: __dirname,
      node_args: '--env-file=.env',
    },
  ],
};
