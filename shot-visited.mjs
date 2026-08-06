import { chromium } from "playwright";
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:8788", { waitUntil: "networkidle" });
await page.waitForTimeout(9500);
// 点击 canvas 中心（current 星在中心附近）
await page.mouse.click(720, 450);
await page.waitForTimeout(800);
const state = await page.evaluate(() => {
  const field = window.__starField;
  const world = field?._inkWorld;
  // 找 guide stream 目标
  let guideTarget = null, visitedBeacons = [];
  world?.group?.traverse?.((o) => {
    if (o.name === 'GuideStream') {
      // 通过 getDefByStarId 或 beaconDefs 查
      const defs = world.getBeacons?.()?.beaconDefs ?? [];
      guideTarget = defs.map(d => ({ id: d.star.id, visited: d.visited }));
    }
  });
  return { visited: [...field.getVisited?.()], guide: guideTarget };
});
console.log("visited:", JSON.stringify(state));
// 截图看标记效果
await page.screenshot({ path: "/tmp/visited-after-click.png" });
await browser.close();
console.log("done");
