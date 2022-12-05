import MainState from '../components/main-state';
import { InventoryData, InventoryGetReq, MarketLotThing, MResp, UserInfoLong } from '../shared/beans';
import { debug } from '../util/debug';

interface ExecuteProfile {
    result: {
        user: UserInfoLong
        inventory: {
            count: number
        }
    }
}

export class Profile {
    private action: JQueryDeferred<InventoryData>;

    constructor(private state: MainState) {
        require('../style/main/profile.less');
        state.onCallMethod("execute.profile", (v: any) => {
            this.action = jQuery.Deferred<InventoryData>();
            this.init(v);
            return true;
        });
    }

    private init(profile: ExecuteProfile) {
        jQuery('div.profile-top-info-main').append(jQuery('div.profile-body-side').detach());

        this.initPage(profile.result.user);
        this.loadInventoryItems(profile.result.user.user_id);

        if (profile.result.inventory.count > 6) {
            const ctr = jQuery('div.profile-body-inventory-list');
            this.reloadItems(ctr);
        }
    }

    private initPage(user: UserInfoLong) {
        const list = jQuery('div.profile-top-stat-list');
        debug('list', list.find('div.profile-top-stat-list-one').eq(1))
        const winrate = jQuery('<div class="profile-top-stat-list-one"><div class="_val"></div><div class="_key">% побед</div></div>')
        list.find('div.profile-top-stat-list-one').eq(1).after('<div class="profile-top-stat-list-one-break"/>').after(winrate);
        const wr = user.games > 0 ? Math.round((user.games_wins / user.games) * 100) : 0;
        winrate.find('div._val').text(`${wr}%`);
    }

    private reloadItems(ctr: JQuery<HTMLElement>) {
        ctr.children().remove();
        this.action.then(inv => inv.things.forEach(thing => this.appendItem(thing, ctr)));
    }

    private appendItem(thing: MarketLotThing, ctr: JQuery<HTMLElement>) {
        let t = thing.image;
        window.devicePixelRatio > 1 && (t = t.replace(/\.png$/, "@2x.png"));
        jQuery("<div>")
            .addClass(`Item _quality-${thing.quality}`)
            .append(
                jQuery("<div>")
                    .addClass("Item-image")
                    .append(
                        jQuery("<div>")
                            .addClass("_img")
                            .css("background-image", "url(".concat(t, ")"))
                    )
            )
            .append(jQuery("<div>").addClass("Item-name").html(thing.title))
            .appendTo(ctr);
    }

    loadInventoryItems(user_id: number) {
        this.state.post('/api/inventory.get', new InventoryGetReq(user_id))
            .then((res: MResp<InventoryData>) => {
                if (res.code) {
                    throw res;
                } else {
                    this.action.resolve(res.data);
                }
            }).fail(err => console.error(err));
    }
}