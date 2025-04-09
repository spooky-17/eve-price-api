// 📦 Vercel Edge Function용 코드 (Jita 실시간 시세 기반 + User-Agent + Accept 헤더 포함 + 응답 포맷 검사 및 디버깅 강화)
// ESI의 'markets/orders' 엔드포인트를 사용하여 The Forge 지역의 실시간 Buy/Sell 데이터를 제공합니다

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const itemName = searchParams.get("item") || "PLEX";

  try {
    const log = (msg, data) => console.error(`[EVE-LOG] ${msg}`, data);

    // 공통 헤더 정의 (브라우저처럼 구성)
    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (compatible; EvePriceBot/1.0; +https://gptonline.ai)',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip'
    };

    // 1단계: ESI API로 itemName의 typeID 조회
    const esiSearchRes = await fetch(`https://esi.evetech.net/latest/search/?categories=inventory_type&search=${encodeURIComponent(itemName)}&strict=false`, {
      headers: commonHeaders
    });

    const contentType = esiSearchRes.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await esiSearchRes.text();
      log("ESI 응답이 JSON이 아님:", text);
      throw new Error("ESI 응답이 JSON이 아님");
    }

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

    const [buyRes, sellRes] = await Promise.all([
      fetch(`https://esi.evetech.net/latest/markets/${regionID}/orders/?order_type=buy&type_id=${typeID}`, { headers: commonHeaders }),
      fetch(`https://esi.evetech.net/latest/markets/${regionID}/orders/?order_type=sell&type_id=${typeID}`, { headers: commonHeaders })
    ]);

    for (const [label, res] of [["Buy", buyRes], ["Sell", sellRes]]) {
      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("application/json")) {
        const txt = await res.text();
        log(`${label} 응답 오류:`, txt);
        throw new Error(`${label} fetch 실패`);
      }
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


