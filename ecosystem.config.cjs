module.exports = {
  apps: [
    {
      name: 'bot-news',
      script: 'index.mjs', // build từ src/ bằng npm run build
      cwd: __dirname,
      // Server có IPv6 hỏng và mạng ra ngoài chậm: Node chỉ chờ 250ms mỗi địa chỉ rồi bỏ → fetch ETIMEDOUT
      node_args: '--env-file=.env --network-family-autoselection-attempt-timeout=2000',
    },
  ],
};
