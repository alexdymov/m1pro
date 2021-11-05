import { InventoryData, InventoryGetReq, MarketLotThing, MResp } from "../shared/beans";
import mutator from "../util/mutator";
import { debug } from '../util/debug';

export class Profile {
    private action = $.Deferred<InventoryData>();

    constructor() {
        require('../style/main/profile.less');
        setTimeout(() => {
            this.init();
        }, 1);
    }

    private init() {
        jQuery('div.profile-top-info-main').append(jQuery('div.profile-body-side').detach());

        const uid = location.pathname.match(/\/profile\/([\da-z_.]+)/)[1];
        this.loadInventoryItems(uid);

        let def = 0;
        const ctr = jQuery('div.profile-body-inventory-list');
        mutator.mutateAdded(ctr, jq => {
            def++;
            if (def === 6) {
                this.reloadItems(ctr);
            }
        });
    }

    private reloadItems(ctr: JQuery<HTMLElement>) {
        ctr.children().remove();
        this.action.then(inv => inv.things.forEach(thing => this.appendItem(thing, ctr)));
    }

    private appendItem(thing: MarketLotThing, ctr: JQuery<HTMLElement>) {
        let t = thing.image;
        window.devicePixelRatio > 1 && (t = t.replace(/\.png$/, "@2x.png"));
        $("<div>")
            .addClass("Item _q".concat(`${thing.quality}`))
            .append(
                $("<div>")
                    .addClass("Item-image")
                    .append(
                        $("<div>")
                            .addClass("_img")
                            .css("background-image", "url(".concat(t, ")"))
                    )
            )
            .append($("<div>").addClass("Item-name").html(thing.title))
            .appendTo(ctr);
    }

    loadInventoryItems(user_id: string) {
        $.post('/api/inventory.get', new InventoryGetReq(user_id))
            .then((res: MResp<InventoryData>) => {
                if (res.code) {
                    throw res;
                } else {
                    this.action.resolve(res.data);
                }
            }).fail(err => console.error(err));
    }
}