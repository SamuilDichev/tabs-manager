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
  return chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      cache[tab.id] = tab;
      duplicatesCache[tab.url].add(tab.id);
    }
  });
}

async function checkDuplicates(url) {
  function checkUrl(tabUrl, tabIds) {
    if (tabUrl.startsWith("chrome://")) {
      return;
    }

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
    checkUrl(url, duplicatesCache[url]);
  }

  for (const [tabUrl, tabIds] of Object.entries(duplicatesCache)) {
    checkUrl(tabUrl, tabIds);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
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

loadAllTabs().then(() => checkDuplicates());
