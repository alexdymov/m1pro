import Component from 'vue-class-component';
import { MarketListingData, MarketListingReq, MarketListingThing, MarketLotsData, MarketLotsReq, MResp, UserInfoLong, UsersGetReq, UsersData } from '../shared/beans';
import Vue from 'vue';
import { debug } from '../util/debug';

@Component({})
export default class MainState extends Vue {
    lots: MarketLotsData = null;
    private itemPrices: Map<number, JQueryPromise<number>> = new Map();

    created() {
        this.loadLots();
        setInterval(() => {
            this.loadLots();
        }, 60 * 1000);
    }

    loadLots() {
        if (!window.API || !window.API.isUserSignedIn()) return;
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

    getItemPrice(id: number): JQuery.Promise<number> {
        if (!this.itemPrices.has(id)) {
            this.itemPrices.set(id, this.getSingleMarketListing(`${id}`).then(thing => thing.price));
        }
        return this.itemPrices.get(id);
    }
}
