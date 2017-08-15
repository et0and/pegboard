///<reference path="pins.ts" />
///<reference path="pin.ts" />
"use strict";
let pins = new Pins();
let apikey = "";
let defaultOptions = {
    "urlPrefix": "u",
    "tagPrefix": "t",
    "titlePrefix": "n",
    "toReadPrefix": "r",
    "showBookmarked": true,
    "changeActionbarIcon": true,
    "saveBrowserBookmarks": false,
    "sharedByDefault": false
};
let options = defaultOptions;
// Listeners
//browser.runtime.onStartup.addListener(handleStartup);
browser.runtime.onInstalled.addListener(handleAddonInstalled);
browser.runtime.onStartup.addListener(handleStartup);
browser.alarms.create("checkUpdate", {
    periodInMinutes: 5,
});
browser.alarms.onAlarm.addListener(onCheckUpdate);
// Update the pins on startup of the browser
async function handleStartup() {
    chrome.runtime.onMessage.addListener(handleMessage); // browser.runtime... has a bug where sendResponse does not work currently as of July 2017
    // That is possibly caused by browser-polyfill
    browser.storage.onChanged.addListener(handleStorageChanged);
    browser.tabs.onUpdated.addListener(handleTabUpdated);
    browser.bookmarks.onCreated.addListener(handleBookmarkCreated);
    // Provide help text to the user.
    browser.omnibox.setDefaultSuggestion({
        description: `Search your pinboard bookmarks`
    });
    browser.contextMenus.create({
        "id": "linkAddToToRead",
        "title": "Add to To Read",
        "contexts": ["link"]
    });
    browser.contextMenus.create({
        "id": "tabAddToToRead",
        "title": "Add page to To Read",
        "contexts": ["browser_action", "page"] // chrome can't do context type "tab" yet as of July 2017
    });
    browser.browserAction.setBadgeBackgroundColor({ color: "#333" });
    browser.contextMenus.onClicked.addListener(handleContextMenuClick);
    loadOptions();
    pins = await Pins.updateList();
}
async function onCheckUpdate(alarm) {
    if (alarm.name === "checkUpdate") {
        pins = await Pins.updateList();
    }
}
function handleBookmarkCreated(id, bookmark) {
    if (!options.saveBrowserBookmarks) {
        return;
    }
    if (!!bookmark.url && bookmark.url != "") {
        //console.log(bookmark);
        let pin = new Pin(bookmark.url, bookmark.title, undefined, new Date().toISOString());
        pins.addPin(pin);
        pin.save();
    }
}
async function handleContextMenuClick(info, tab) {
    let pin;
    switch (info.menuItemId) {
        case "linkAddToToRead":
            let result = await browser.tabs.executeScript(undefined, {
                allFrames: true,
                code: "document.activeElement.textContent.trim();"
            });
            pin = new Pin(info.linkUrl, String(result[0]), undefined, undefined, "Found on " + info.pageUrl, "yes", "no");
            pins.addPin(pin);
            pin.save();
            checkDisplayBookmarked();
            break;
        case "tabAddToToRead":
            pin = new Pin(tab.url, tab.title, undefined, undefined, undefined, "yes", "no");
            pins.addPin(pin);
            pin.save();
            checkDisplayBookmarked();
    }
}
/**
 * Is Executed when the addon is installed or updated
 */
async function handleAddonInstalled() {
    let token = await browser.storage.local.get(["options", "lastsync", "lastupdate"]);
    if (!token.hasOwnProperty("options")) {
        token.options = defaultOptions;
        options = defaultOptions;
        token.lastsync = "";
        token.lastupdate = "";
        browser.storage.local.set(token);
    }
    handleStartup();
}
async function loadOptions() {
    let res = await browser.storage.local.get("options");
    if (!res.options) {
        options = defaultOptions;
    }
    else {
        options = res.options;
    }
    loadApiKey();
}
async function loadApiKey() {
    let res = (await browser.storage.local.get("apikey")).apikey;
    if (typeof res !== "undefined") {
        apikey = res;
        if (apikey == "") {
            pins = new Pins();
        }
    }
}
// Only update pin data when the api key was modified
async function handleStorageChanged(changes, area) {
    if (Object.keys(changes).includes("apikey")) {
        await loadApiKey();
        pins = await Pins.updateList(true);
    }
    else if (Object.keys(changes).includes("pins")) {
        pins = await Pins.updateFromStorage();
    }
    else if (Object.keys(changes).includes("options")) {
        loadOptions();
    }
}
async function checkDisplayBookmarked(tab = undefined) {
    // console.log("Checking");
    function checkExists(tab) {
        if (!!pins && pins.has(tab.url) && options.changeActionbarIcon) {
            browser.browserAction.setBadgeText({ text: "\u{2713}", tabId: tab.id });
        }
        else {
            browser.browserAction.setBadgeText({ text: "", tabId: tab.id });
        }
    }
    if (tab === undefined) {
        let tabs = await (browser.tabs.query({}));
        for (let tab of tabs) {
            checkExists(tab);
        }
    }
    else {
        checkExists(tab);
    }
}
function handleTabUpdated(tabId, changeInfo, tab) {
    if (!options.changeActionbarIcon) {
        return;
    }
    if (changeInfo.status == "loading") {
        checkDisplayBookmarked(tab);
    }
}
function handleMessage(request, sender, sendResponse) {
    //Not async because it needs to return true in order for the message port to stay open
    if (request.callFunction == "checkDisplayBookmarked" && !!request.url) {
        browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
            let tab = tabs[0];
            checkDisplayBookmarked();
        });
        return true;
    }
    else if (request.callFunction == "saveBookmark") {
        let pin = Pin.fromObject(request.pin);
        pins.addPin(pin);
        checkDisplayBookmarked();
        pin.save().then(resp => {
            sendResponse(resp);
        });
        return true;
    }
    else if (request.callFunction == "forceUpdatePins") {
        Pins.updateList(true).then((p) => {
            pins = p;
            sendResponse("OK");
        });
        return true;
    }
    else if (request.callFunction == "deleteBookmark") {
        let pin = Pin.fromObject(request.pin);
        let response = pin.delete().then(() => {
            pins.delete(pin.url);
            checkDisplayBookmarked();
            sendResponse("OK");
        });
        return true;
    }
    else if (request.callFunction == "getTagSuggestions") {
        connector.suggestTags(request.url).then(suggestions => {
            sendResponse(suggestions);
        });
        return true;
    }
}
//# sourceMappingURL=background.js.map