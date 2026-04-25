const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createAppContext(overrides = {}) {
  const html = fs.readFileSync('index.html', 'utf8');
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(match, 'script block should exist');

  const storage = new Map();
  const sessionStorage = {
    getItem: key => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  };

  const context = {
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    sessionStorage,
    fetch: async () => {
      throw new Error('network unavailable');
    },
    ...overrides
  };

  vm.createContext(context);
  const script = match[1].replace(/\ninit\(\);\s*$/, '\n');
  vm.runInContext(script, context);
  return context;
}

async function run() {
  const app = createAppContext();

  assert.equal(
    app.findFirstAfter([20, 360, 1420], 23 * 60 + 50),
    0,
    'findFirstAfter should wrap to the next-day 00:20 service'
  );

  const routeData = {
    eshot555: { gidis: [], donus: [550, 650] },
    eshot776: { gidis: [600], donus: [500] },
    izbanCumaHalk: [{ h: 510, v: 540 }, { h: 610, v: 640 }],
    izbanCumaAlay: [{ h: 510, v: 540 }, { h: 610, v: 640 }]
  };

  const r1Donus = app.calculateR1Donus(routeData, {
    sure776: 0,
    cumaYuru: 5,
    halkYuru: 5
  });
  assert.equal(r1Donus[0].cols[0], '08:20', 'R1 dönüş should use 776 DONUS_SAATI');

  const r2Donus = app.calculateR2Donus(routeData, {
    sure776: 0,
    cumaYuru: 5
  });
  assert.equal(r2Donus[0].cols[0], '08:20', 'R2 dönüş should use 776 DONUS_SAATI');

  const quietConsole = Object.assign(Object.create(console), { warn() {} });
  const noNetworkApp = createAppContext({ console: quietConsole });
  const eshotRows = await noNetworkApp.fetchEshot(555);
  assert.ok(eshotRows.gidis.length > 0, 'fetchEshot should use embedded fallback when API and local JSON fetch fail');
  assert.ok(eshotRows.donus.length > 0, 'fetchEshot fallback should include return trips');

  const izbanRows = await noNetworkApp.fetchIzban(21, 32);
  assert.equal(izbanRows.length, 0, 'fetchIzban should degrade to an empty schedule when API is unavailable');

  const allData = await noNetworkApp.loadAllData();
  assert.ok(allData.eshot555.gidis.length > 0, 'loadAllData should resolve with fallback ESHOT data when fetch is unavailable');
  assert.equal(allData.izbanHalkCuma.length, 0, 'loadAllData should keep resolving when IZBAN fetch is unavailable');

  console.log('tests passed');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
