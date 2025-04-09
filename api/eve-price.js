// 📦 Vercel Edge Function용 코드 (Jita 실시간 시세 기반 + User-Agent 헤더 포함 + 오류 로그 출력)
// ESI의 'markets/orders' 엔드포인트를 사용하여 The Forge 지역의 실시간 Buy/Sell 데이터를 제공합니다

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const itemName = searchParams.get("item") || "PLEX";

  try {
    const log = (msg, data) => console.error(`[EVE-LOG] ${msg}`, data);

    // 1단계: ESI API로 itemName의 typeID 조회
    const esiSearchRes = await fetch(`https://esi.evetech.net/latest/search/?categories=inventory_type&search=${encodeURIComponent(itemName)}&strict=true`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EvePriceBot/1.0; +https://gptonline.ai)'
      }
    });
    const esiSearchData = await esiSearchRes.json();
    log("ESI 검색 결과:", esiSearchData);

    const typeIDs = esiSearchData.inventory_type;
    if (!typeIDs || !Array.isArray(typeIDs) || typeIDs.length === 0) {
      return new Response(JSON.stringify({ error: "아이템을 찾을 수 없습니다.", item: itemName }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const typeID = typeIDs[0];
    const regionID = 10000002;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; EvePriceBot/1.0; +https://gptonline.ai)'
    };

    const [buyRes, sellRes] = await Promise.all([
      fetch(`https://esi.evetech.net/latest/markets/${regionID}/orders/?order_type=buy&type_id=${typeID}`, { headers }),
      fetch(`https://esi.evetech.net/latest/markets/${regionID}/orders/?order_type=sell&type_id=${typeID}`, { headers })
    ]);

    if (!buyRes.ok) {
      const text = await buyRes.text();
      log("Buy 응답 오류:", text);
      throw new Error("Buy fetch 실패");
    }
    if (!sellRes.ok) {
      const text = await sellRes.text();
      log("Sell 응답 오류:", text);
      throw new Error("Sell fetch 실패");
    }

    const [buyData, sellData] = await Promise.all([
      buyRes.json(),
      sellRes.json()
    ]);

    log("Buy 데이터:", buyData);
    log("Sell 데이터:", sellData);

    const highestBuy = buyData.sort((a, b) => b.price - a.price)[0]?.price ?? null;
    const lowestSell = sellData.sort((a, b) => a.price - b.price)[0]?.price ?? null;

    return new Response(JSON.stringify({ item: itemName, typeID, buy: highestBuy, sell: lowestSell }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[EVE-ERROR]", err);
    return new Response(JSON.stringify({ error: "API 요청 실패", detail: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 


