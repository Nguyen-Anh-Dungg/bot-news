module.exports = {
  apps: [
    {
      name: 'bot-news',
      script: 'index.mjs',
      cwd: __dirname,
      node_args: '--env-file=.env',
    },
  ],
};
