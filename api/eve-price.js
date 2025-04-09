export const config = { runtime: "edge" };

// 📦 Cloudflare Workers 기반 API (Jita 실시간 시세 기반 + User-Agent 헤더 추가)
// ESI의 'markets/orders' 엔드포인트를 사용하여 The Forge 지역의 실시간 Buy/Sell 데이터를 제공합니다
export const config = {
  runtime: 'edge',
};

export default {
  async fetch(request) {
    ...
  }
};

