import Component from 'vue-class-component';
import { MarketListingData, MarketListingReq, MarketListingThing, MarketLotsData, MarketLotsReq, MResp, UserInfoLong, UsersGetReq, UsersData, FriendsGetReq, FriendsData, RoomsChangeSettings } from '../shared/beans';
import Vue from 'vue';
import { debug } from '../util/debug';
import { propWaitWindow } from '../util/prop-def';
import { handleResponse } from '../util/http-util';

export class ModeCustomSettings {
    maxplayers?: number;
    option_private?: boolean;
    option_autostart?: boolean;
    option_restarts?: boolean;
    game_timers?: boolean;
    br_corner?: number;
    game_2x2?: boolean;
    cmpt_variants?: { [key: number]: boolean };
}

export class GamesNewSettings {
    mode?: string;
    custom: { [key: string]: ModeCustomSettings } = {}
}

@Component({})
export default class MainState extends Vue {
    lots: MarketLotsData = null;
    private itemPrices: Map<number, JQueryPromise<number>> = new Map();
    lastSeen = localStorage.getItem('last_pro_version_seen') || '0';
    gamesNewSettings: GamesNewSettings = null;
    ver = VERSION;

    created() {
        const localSettings = localStorage.getItem('games_new_settings');
        this.gamesNewSettings = localSettings ? JSON.parse(localSettings) : new GamesNewSettings();
        this.$watch('gamesNewSettings', (v) => {
            localStorage.setItem('games_new_settings', JSON.stringify(this.gamesNewSettings));
        }, { deep: true });
        if (window.API && window.API.isUserSignedIn()) {
            this.loadLots();
        } else {
            propWaitWindow('API').then(v => this.loadLots());
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

    getUserInfo(id: number | string | [], ids: string[] = [], type?: string): JQuery.Promise<UserInfoLong[]> {
        return $.post('/api/users.get', new UsersGetReq(type, id, ids.length ? ids.join(',') : ids))
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

    changeSetting(roomId: string, name: string, value: any, token?: string): JQuery.Promise<boolean> {
        return $.post('/api/rooms.settingsChange', new RoomsChangeSettings(roomId, name, value).withCaptcha(token))
            .then(handleResponse(() => true, tkn => this.changeSetting(roomId, name, value, tkn)))
            .fail(e => console.error('failed to change setting', name, 'code', e));
    }

    setCustomSetting(mode: string, opt: string, v: any) {
        const custom = this.gamesNewSettings.custom;
        debug('set opt', mode, opt, JSON.parse(JSON.stringify(v)));
        if (custom[mode]) {
            Vue.set(custom[mode], opt, v);
        } else {
            const val: any = {};
            val[opt] = v;
            Vue.set(custom, mode, val);
        }
    }
}
