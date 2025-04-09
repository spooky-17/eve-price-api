// 📦 Vercel Serverless Function용 코드 (Fuzzwork API + 입력값 자동 보정 + 실시간 typeID 조회 추가)
// Fuzzwork API로 실시간 typeID 조회 후 가격을 반환합니다

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const itemNameRaw = searchParams.get("item") || "PLEX";
  const itemName = itemNameRaw.toLowerCase().trim();

  try {
    const log = (msg, data) => console.error(`[EVE-LOG] ${msg}`, data);

    // 1차 고정 매핑
    const typeIdMap = {
      "plex": 44992,
      "large skill injector": 40520,
      "small skill injector": 40519
    };

    let typeID = typeIdMap[itemName];

    // 고정 매핑에 없을 경우 → Fuzzwork API로 실시간 typeID 조회
    if (!typeID) {
      const lookupUrl = `https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(itemNameRaw.trim())}`;
      const lookupRes = await fetch(lookupUrl);
      const lookupData = await lookupRes.json();
      log("실시간 typeID 조회 결과:", lookupData);
      typeID = lookupData.typeID;
    }

    if (!typeID) {
      return res.status(404).json({ error: "아이템을 찾을 수 없습니다.", item: itemNameRaw });
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

    const itemData = marketData[String(typeID)];
    const buy = itemData?.buy?.max ?? null;
    const sell = itemData?.sell?.min ?? null;

    if (buy === null && sell === null) {
      return res.status(404).json({ error: "시세 데이터를 찾을 수 없습니다.", typeID });
    }

    return res.status(200).json({ item: itemNameRaw, typeID, buy, sell });

  } catch (err) {
    console.error("[EVE-ERROR]", err);
    return res.status(500).json({ error: "API 요청 실패", detail: err.message });
  }
}



