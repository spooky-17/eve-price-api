// 📦 Vercel Serverless Function용 코드 (Fuzzwork API 기반으로 전환, aggregates 경로 수정)
// Fuzzwork의 aggregates API를 사용하여 typeID 기준 평균 Buy/Sell 가격을 조회합니다

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const itemName = searchParams.get("item") || "PLEX";

  try {
    const log = (msg, data) => console.error(`[EVE-LOG] ${msg}`, data);

    const typeIdMap = {
      "PLEX": 44992,
      "Large Skill Injector": 40520,
      "Small Skill Injector": 40519
    };

    const typeID = typeIdMap[itemName];
    if (!typeID) {
      return res.status(404).json({ error: "지원하지 않는 아이템입니다.", item: itemName });
    }

    const apiUrl = `https://market.fuzzwork.co.uk/aggregates/?typeid=${typeID}`;
    const marketRes = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EvePriceBot/1.0; +https://gptonline.ai)',
        'Accept': 'application/json'
      }
    });

    if (!marketRes.ok) {
      const text = await marketRes.text();
      log("Fuzzwork 응답 오류:", text);
      return res.status(500).json({ error: "Fuzzwork API 오류", detail: text });
    }

    const marketData = await marketRes.json();
    log("Fuzzwork 시세:", marketData);

    const itemData = marketData.aggregates?.[String(typeID)];
    if (!itemData) {
      return res.status(404).json({ error: "시세 데이터를 찾을 수 없습니다.", typeID });
    }

    const buy = itemData.buy?.max ?? null;  // 최고 매입가
    const sell = itemData.sell?.min ?? null; // 최저 판매가

    return res.status(200).json({ item: itemName, typeID, buy, sell });

  } catch (err) {
    console.error("[EVE-ERROR]", err);
    return res.status(500).json({ error: "API 요청 실패", detail: err.message });
  }
}



