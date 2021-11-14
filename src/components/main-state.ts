import Component from 'vue-class-component';
import { MarketListingData, MarketListingReq, MarketListingThing, MarketLotsData, MarketLotsReq, MResp, UserInfoLong, UsersGetReq, UsersData, FriendsGetReq, FriendsData } from '../shared/beans';
import Vue from 'vue';
import { debug } from '../util/debug';
import { propDefinedWindow } from '../util/prop-def';

@Component({})
export default class MainState extends Vue {
    lots: MarketLotsData = null;
    private itemPrices: Map<number, JQueryPromise<number>> = new Map();
    lastSeen = localStorage.getItem('last_pro_version_seen') || '0';
    ver = VERSION;

    created() {
        if (window.API && window.API.isUserSignedIn()) {
            this.loadLots();
        } else {
            propDefinedWindow('API').then(v => this.loadLots());
        }
        setInterval(() => {
            this.loadLots();
        }, 60 * 1000);
    }

    changeSeen() {
        this.lastSeen = this.ver;
        localStorage.setItem('last_pro_version_seen', this.ver);
    }

    loadLots() {
        $.post('/api/market.getMyLots', new MarketLotsReq())
            .then((res: MResp<MarketLotsData>) => {
                if (res.code) {
                    throw res;
                } else {
                    this.lots = res.data;
                }
            }).fail(err => console.error(err));
    }

    getSingleMarketListing(id: string): JQuery.Promise<MarketListingThing> {
        return $.post('/api/market.getListing', new MarketListingReq(id, 1))
            .then((res: MResp<MarketListingData>) => {
                const def = $.Deferred();
                if (res.code || !res.data?.things?.length) {
                    return def.reject(res);
                } else {
                    return def.resolve(res.data.things[0]);
                }
            });
    }

    getUserInfo(id: number, type?: string): JQuery.Promise<UserInfoLong[]> {
        return $.post('/api/users.get', new UsersGetReq(type, id))
            .then((res: UsersData) => {
                const def = $.Deferred();
                if (res.code || !res.data?.length) {
                    return def.reject(res);
                } else {
                    return def.resolve(res.data);
                }
            });
    }

    getFriends(req: FriendsGetReq): JQuery.Promise<FriendsData> {
        return $.post('/api/friends.get', req)
            .then((res: MResp<FriendsData>) => {
                const def = $.Deferred();
                if (res.code) {
                    return def.reject(res);
                } else {
                    return def.resolve(res.data);
                }
            });
    }

    getItemPrice(id: number): JQuery.Promise<number> {
        if (!this.itemPrices.has(id)) {
            this.itemPrices.set(id, this.getSingleMarketListing(`${id}`).then(thing => thing.price));
        }
        return this.itemPrices.get(id);
    }

    isUnseen(version: string) {
        return version.localeCompare(this.lastSeen, undefined, { numeric: true, sensitivity: 'base' }) > 0;
    }
}
