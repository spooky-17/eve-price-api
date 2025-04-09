export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const itemName = searchParams.get("item") || "PLEX";

  try {
    const esiSearchRes = await fetch(`https://esi.evetech.net/latest/search/?categories=inventory_type&search=${encodeURIComponent(itemName)}&strict=true`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EvePriceBot/1.0; +https://gptonline.ai)'
      }
    });
    const esiSearchData = await esiSearchRes.json();

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

    const [buyData, sellData] = await Promise.all([
      buyRes.json(),
      sellRes.json()
    ]);

    const highestBuy = buyData.sort((a, b) => b.price - a.price)[0]?.price ?? null;
    const lowestSell = sellData.sort((a, b) => a.price - b.price)[0]?.price ?? null;

    return new Response(JSON.stringify({ item: itemName, typeID, buy: highestBuy, sell: lowestSell }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "API 요청 실패", detail: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

