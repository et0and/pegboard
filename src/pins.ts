///<reference path="pin.ts" />
"use strict";
class Pins extends Map<string, Pin> {

    set(key:string, pin: Pin) {
        super.set(key, pin);
        return this;
    }
    delete(key:string) {
        let result = super.delete(key);
        this.saveToStorage();
        return result;
    }

    addPin(pin:Pin) {
        this.set(pin.url, pin);
        this.saveToStorage();
    }

    *forEachReversed() {
        for(let [url, pin] of Array.from(this.entries()).reverse()) {
            yield pin;
        }
    }

    saveToStorage() {
        browser.storage.local.set({"pins": Array.from(this.entries())});
    }
 
    static async updateList(forceUpdate: boolean = false) {
        let token = await browser.storage.local.get(["apikey", "lastupdate", "lastsync", "pins"]);
        // Plus 5 at the end for buffer, in order for the alarm to trigger this usually.
        if (token.apikey == "" || (!forceUpdate && !!token.lastsync && new Date(token.lastsync) > new Date(Date.now() - 1000 * 60 * 5 + 5))) {
            return Pins.updateFromStorage();
        }
        let lastUpdate = await connector.getLastUpdate();
        // To compare Dates: https://stackoverflow.com/a/493018
        if (!forceUpdate && !!token.pins && token.pins.length > 0 && !!token.lastupdate && 
                    new Date(token.lastupdate).getTime() == lastUpdate.getTime()) {
            return Pins.updateFromStorage();

        }
        return Pins.sendRequestAllPins(lastUpdate);
    }
    
    /**
     * Requests all pins from pinboard
     * @param lastUpdate Timestamp of the last update requested before, so the storage can be updated if it was successful
     */
    static async sendRequestAllPins(lastUpdate) {
        let pins = new Pins();
        let json = await connector.getAllPins();
        json.reverse().forEach((pin) => {
            pins.set(pin.href, new Pin( //pinboard API gets pin with attribute href, and addPin wants url. so we standardise to url
                pin.href, 
                pin.description,
                pin.tags,
                pin.time,
                pin.toread,
                pin.extended,
                pin.shared));
        });
        pins.saveToStorage();
        browser.storage.local.set({ lastupdate: lastUpdate.getTime() });
        browser.storage.local.set({ lastsync: new Date().getTime() });
        return pins;
    }
    
    static async updateFromStorage() {
        let res = (await browser.storage.local.get("pins")).pins;
        return new Pins(res);
    }
}