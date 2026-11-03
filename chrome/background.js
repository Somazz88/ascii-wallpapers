// The toolbar button opens the wallpaper picker on the claude.ai tab you are on.
chrome.action.onClicked.addListener(tab => {
  if (tab.id === undefined || !tab.url || !tab.url.startsWith('https://claude.ai/')) {
    chrome.tabs.create({ url: 'https://claude.ai/new' })
    return
  }
  chrome.tabs.sendMessage(tab.id, { type: 'aw-open' }).catch(() => {})
})
