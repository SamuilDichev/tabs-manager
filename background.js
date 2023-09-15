class DefaultDict {
  constructor(defaultInit) {
    return new Proxy(
      {},
      {
        get: (target, name) =>
          name in target
            ? target[name]
            : (target[name] =
                typeof defaultInit === "function"
                  ? new defaultInit().valueOf()
                  : defaultInit),
      },
    );
  }
}

const cache = {};
const duplicatesCache = new DefaultDict(Set);

async function loadAllTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith("chrome://")) {
      continue;
    }

    cache[tab.id] = tab;
    duplicatesCache[tab.url].add(tab.id);
  }
}

chrome.tabs.onCreated.addListener((tab) => {
  cache[tab.id] = tab;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log(tabId, changeInfo);
  const isUrlChange = changeInfo.hasOwnProperty("url");
  if (!isUrlChange) {
    return;
  }

  const oldUrl = cache[tabId]?.url;
  const newUrl = changeInfo.url;
  if (newUrl.startsWith("chrome://")) {
    return;
  }

  cache[tabId] = tab;
  duplicatesCache[oldUrl].delete(tabId);
  duplicatesCache[newUrl].add(tabId);

  const duplicates = new Set(duplicatesCache[tab.url]);
  if (duplicates.size > 1) {
    duplicates.delete(tabId);
    chrome.tabs.remove(Array.from(duplicates));
  }
});

chrome.tabs.onRemoved.addListener((tabId, _changeInfo, _tab) => {
  const tab = cache[tabId];
  if (!tab) {
    return;
  }

  duplicatesCache[tab.url].delete(tabId);
  delete cache[tabId];
});

loadAllTabs();
