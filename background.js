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

async function checkDuplicates(url) {
  function checkUrl(tabIds) {
    if (tabIds.size > 1) {
      for (const tabId of tabIds) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            if (!document.title.includes("[D] ")) {
              document.title = "[D] " + document.title;
            }
          },
        });
      }
    } else {
      for (const tabId of tabIds) {
        const tab = cache[tabId];
        if (tab && tab.title.includes("[D] ")) {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
              document.title = document.title.replace("[D] ", "");
            },
          });
        }
      }
    }
  }

  if (url) {
    checkUrl(duplicatesCache[url]);
  }

  for (const [_, tabIds] of Object.entries(duplicatesCache)) {
    checkUrl(tabIds);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url || tab.url.startsWith("chrome://")) {
    return;
  }

  cache[tabId] = tab;
  duplicatesCache[tab.url].add(tabId);
  titleChanged = changeInfo.title && !changeInfo.title.startsWith("[D] ");

  if (
    changeInfo.status == "complete" ||
    (tab.status == "complete" && titleChanged)
  ) {
    checkDuplicates(tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId, _changeInfo, _tab) => {
  const tab = cache[tabId];
  if (tab) {
    const tabUrl = tab.url;
    duplicatesCache[tabUrl].delete(tabId);
    delete cache[tabId];
    checkDuplicates(tabUrl);
  } else {
    checkDuplicates();
  }
});

loadAllTabs();
checkDuplicates();
