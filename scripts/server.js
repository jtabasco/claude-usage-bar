const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');
chromium.use(stealth());

const OUTPUT_FILE = process.argv[2];
const SESSION_KEY = process.argv[3] || '';
const fs = require('fs');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  if (SESSION_KEY) {
    await ctx.addCookies([{ name: 'sessionKey', value: SESSION_KEY, domain: 'claude.ai', path: '/' }]);
  }

  const page = await ctx.newPage();
  let orgId = null;

  async function fetchUsage() {
    try {
      if (!orgId) {
        const bsRes = await page.evaluate(async () => {
          const r = await fetch('https://claude.ai/api/bootstrap', {
            credentials: 'include',
            headers: { Accept: 'application/json' }
          });
          return { status: r.status, body: await r.text() };
        });
        if (bsRes.status !== 200) throw new Error('bootstrap status ' + bsRes.status);
        const bs = JSON.parse(bsRes.body);
        orgId = bs?.account?.memberships?.[0]?.organization?.uuid;
        if (!orgId) throw new Error('no org id');
      }

      const usageRes = await page.evaluate(async (oid) => {
        const r = await fetch(`https://claude.ai/api/organizations/${oid}/usage`, {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        });
        return { status: r.status, body: await r.text() };
      }, orgId);

      if (usageRes.status !== 200) throw new Error('usage status ' + usageRes.status);
      const usage = JSON.parse(usageRes.body);

      fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
        ok: true,
        five_hour: Math.round(usage?.five_hour?.utilization ?? 0),
        five_hour_resets_at: usage?.five_hour?.resets_at ?? null,
        seven_day: Math.round(usage?.seven_day?.utilization ?? 0),
        seven_day_resets_at: usage?.seven_day?.resets_at ?? null,
        updated: new Date().toISOString()
      }));
      process.stdout.write('ok\n');
    } catch (e) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ ok: false, error: e.message }));
      process.stdout.write('err: ' + e.message + '\n');
      orgId = null;
    }
  }

  try {
    await page.goto('https://claude.ai', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2000);
  } catch (e) { /* ok */ }

  await fetchUsage();
  setInterval(fetchUsage, 30000);

  process.on('SIGTERM', async () => { await browser.close(); process.exit(0); });
  process.on('SIGINT',  async () => { await browser.close(); process.exit(0); });
}

run().catch(e => {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});
