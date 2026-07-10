const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const prefix = script.slice(0, script.indexOf("function renderArea"));
const data = new Function(
  `${prefix}
return { weatherOverview, tripDays, mealOptions, budgetPlan, dataSources, hotels, homes, manchesterHotels, returnHotels };`
)();

function parsePrice(text) {
  const value = String(text);
  const perNight = value.match(/([0-9][0-9,]*)(?:-([0-9][0-9,]*))?\s*\/\s*晚/);
  if (perNight) return Number(perNight[1].replace(/,/g, ""));
  const total = value.match(/([0-9][0-9,]*)(?:-([0-9][0-9,]*))?\s*\/\s*(\d+)晚/);
  if (total) return Math.round(Number(total[1].replace(/,/g, "")) / Number(total[3]));
  return 0;
}

function mapHotel(item, segment, type) {
  return {
    name: item.name,
    segment,
    type,
    area: item.area,
    pricePerNight: parsePrice(item.price),
    priceText: item.price,
    room: item.room,
    highlights: (item.tags || []).join("；"),
    rating: item.review ? "评论摘要见网页" : "待复核",
    links: item.links || [],
    image: item.img || ""
  };
}

function sumBudget(predicate) {
  return data.budgetPlan.items.filter(predicate).reduce((sum, item) => sum + item.cost, 0);
}

const days = data.tripDays.map((day) => ({
  date: day.date,
  weekday: "",
  theme: day.title,
  place: day.place,
  weather: {
    icon: day.risk ? "rainy" : "partlyCloudy",
    high: day.place.includes("Manchester") ? 21 : 23,
    low: day.place.includes("Manchester") ? 14 : 15,
    note: day.weather
  },
  activities: day.items.map((item) => {
    const priceMatch = item.note.match(/¥([0-9]+)-([0-9]+)/);
    const isMeal = /餐|简餐|午餐|晚餐/.test(item.name);
    const activity = {
      time: item.time,
      name: item.name,
      duration: "",
      cost: 0,
      transport: item.note.includes("地铁") || item.note.includes("火车") || item.note.includes("打车") ? item.note : "",
      note: item.note,
      source: item.link ? { label: item.link[0], href: item.link[1] } : null
    };
    if (isMeal) {
      activity.meal = {
        name: item.name,
        cuisine: "按当天区域选择",
        perPerson: priceMatch ? Number(priceMatch[2]) : 220,
        recommended: item.note,
        location: day.place
      };
    }
    return activity;
  })
}));

const accommodationSubtotal = sumBudget((item) => item.name.includes("住宿"));
const transportSubtotal = sumBudget((item) => item.name.includes("交通"));
const ticketSubtotal = sumBudget((item) => item.name.includes("门票"));
const foodSubtotal = sumBudget((item) => item.name.includes("餐饮"));
const otherSubtotal = sumBudget(
  (item) => !item.name.includes("住宿") && !item.name.includes("交通") && !item.name.includes("门票") && !item.name.includes("餐饮")
);
const total = data.budgetPlan.items.reduce((sum, item) => sum + item.cost, 0);

const tripData = {
  title: "英国 10 天旅行计划",
  dateRange: "2026-08-22 ~ 2026-08-31",
  travelers: "3人同行；公开版隐藏姓名与航班号",
  generationDate: "2026-07-10",
  weather: {
    summary: "8 月英国南部和西北部温和，伦敦约 23/15°C，曼彻斯特约 20-21/13-14°C；逐日天气需临行前复查。",
    avgHigh: 23,
    avgLow: 14,
    rainfall: "临近预报待查；8月仍需备雨具",
    clothing: "短袖/薄长袖 + 轻薄外套 + 防水鞋或舒适步行鞋",
    tips: "多佛白崖重点看风力和能见度；曼城/利物浦日更容易遇雨。",
    sources: data.weatherOverview.map((item) => ({ name: item.place, href: item.source }))
  },
  days,
  hotels: [
    ...data.hotels.map((item) => mapHotel(item, "伦敦前段 8/22-8/25", "hotel")),
    ...data.homes.map((item) => mapHotel(item, "伦敦前段 8/22-8/25", "airbnb")),
    ...data.manchesterHotels.map((item) => mapHotel(item, "曼彻斯特 8/25-8/27", "hotel")),
    ...data.returnHotels.map((item) => mapHotel(item, "伦敦后段 8/27-8/31", "hotel"))
  ],
  meals: data.mealOptions,
  budget: {
    transport: {
      items: data.budgetPlan.items.filter((item) => item.name.includes("交通")).map((item) => ({ name: `${item.name}（估算）`, cost: item.cost })),
      subtotal: transportSubtotal
    },
    accommodation: {
      items: data.budgetPlan.items.filter((item) => item.name.includes("住宿")).map((item) => ({ name: `${item.name}（参考）`, cost: item.cost })),
      subtotal: accommodationSubtotal
    },
    food: {
      items: data.budgetPlan.items.filter((item) => item.name.includes("餐饮")).map((item) => ({ name: `${item.name}（估算）`, cost: item.cost })),
      subtotal: foodSubtotal
    },
    tickets: {
      items: data.budgetPlan.items.filter((item) => item.name.includes("门票")).map((item) => ({ name: `${item.name}（参考）`, cost: item.cost })),
      subtotal: ticketSubtotal
    },
    other: {
      items: data.budgetPlan.items
        .filter((item) => !item.name.includes("住宿") && !item.name.includes("交通") && !item.name.includes("门票") && !item.name.includes("餐饮"))
        .map((item) => ({ name: `${item.name}（估算）`, cost: item.cost })),
      subtotal: otherSubtotal
    },
    total,
    perPerson: Math.round(total / 3)
  },
  tips: [
    "机票和酒店为动态定价，以上为参考估算。出行前请在携程/Booking/Expedia/Airbnb/酒店官网确认实际价格并预订。",
    "8/27 是全程最大风险点：曼城退房回伦敦后再接 Duxford/剑桥很赶，优先顺延到 8/29。",
    "所有住宿下单前再次核对空调、固定床位、可退款截止日、税费和城市税/清洁费。",
    "英国铁路出行前复核罢工、工程维护和末班车，长距离日建议买可改签或留足缓冲。",
    "公开版不保存同行者姓名、航班号、证件号和联系方式。"
  ],
  sources: data.dataSources
};

const outDir = path.join(root, "英国-2026-08");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "tripData.json");
fs.writeFileSync(outPath, `${JSON.stringify(tripData, null, 2)}\n`, "utf8");
console.log(`Generated ${outPath}`);
