import pThrottle from 'p-throttle';
import Vue from 'vue';
import Component from 'vue-class-component';
import { FriendsData, FriendsGetReq, MarketBestPrice, MarketListingReq, MarketLotsData, MarketLotsReq, MResp, RoomsChangeSettings, UserInfoLong, UsersData, UsersGetReq } from '../shared/beans';
import { debug } from '../util/debug';
import { handleResponse } from '../util/http-util';
import { propWaitWindow } from '../util/prop-def';

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
    private listeners = new Map<String, (data: any) => boolean>();
    private throttler = pThrottle({ limit: 1, interval: 200 });

    post(url: string, data: any): JQuery.Promise<any> {
        const def = $.Deferred();
        this.throttler(() => $.post(url, data).then(val => def.resolve(val)).fail(e => def.reject(e)))();
        return def.promise();
    }

    created() {
        const localSettings = localStorage.getItem('games_new_settings');
        this.gamesNewSettings = localSettings ? JSON.parse(localSettings) : new GamesNewSettings();
        this.$watch('gamesNewSettings', (v) => {
            localStorage.setItem('games_new_settings', JSON.stringify(this.gamesNewSettings));
        }, { deep: true });
        if (window.API && window.API.isUserSignedIn()) {
            this.loadLots();
        } else {
            propWaitWindow('API').then(v => {
                const oldCallMethod = window.API.callMethod;
                window.API.callMethod = (name, ...other) => {
                    let fn: Function,
                        data = {},
                        a = {};
                    switch (typeof other[0]) {
                        case "function":
                            [fn, a] = other;
                            break;
                        case "object":
                            [data, fn, a] = other;
                            break;
                        case "undefined":
                            break;
                        default:
                            throw new Error("Invalid params given.");
                    }
                    return oldCallMethod.call(window.API, name, data, (...data: any[]) => {
                        fn && fn.apply(null, data);
                        this.listeners.forEach((v, k) => {
                            if (k === name) {
                                if (v.apply(null, data)) {
                                    this.listeners.delete(name);
                                }
                            }
                        })
                    }, a);
                }
                this.loadLots();
            });
        }
        setInterval(() => {
            this.loadLots();
        }, 60 * 1000);
    }

    onCallMethod(name: string, fn: (data: any) => boolean) {
        this.listeners.set(name, fn);
    }

    changeSeen() {
        this.lastSeen = this.ver;
        localStorage.setItem('last_pro_version_seen', this.ver);
    }

    loadLots() {
        this.post('/api/market.getMyLots', new MarketLotsReq())
            .then((res: MResp<MarketLotsData>) => {
                if (res.code) {
                    throw res;
                } else {
                    this.lots = res.data;
                }
            }).fail(err => console.error(err));
    }

    getBestPrice(id: string): JQuery.Promise<number> {
        return this.post('/api/market.getBestPrice', new MarketListingReq(id, 1))
            .then((res: MResp<MarketBestPrice>) => {
                if (res.code) {
                    throw res;
                } else {
                    return res.data.price;
                }
            });
    }

    getUserInfo(id: number | string | [], ids: string[] = [], type?: string): JQuery.Promise<UserInfoLong[]> {
        return this.post('/api/users.get', new UsersGetReq(type, id, ids.length ? ids.join(',') : ids))
            .then((res: UsersData) => {
                if (res.code || !res.data?.length) {
                    throw res;
                } else {
                    return res.data;
                }
            });
    }

    getFriends(req: FriendsGetReq): JQuery.Promise<FriendsData> {
        return this.post('/api/friends.get', req)
            .then((res: MResp<FriendsData>) => {
                if (res.code) {
                    throw res;
                } else {
                    return res.data;
                }
            });
    }

    getItemPrice(id: number): JQuery.Promise<number> {
        if (!this.itemPrices.has(id)) {
            this.itemPrices.set(id, this.getBestPrice(`${id}`));
        }
        return this.itemPrices.get(id);
    }

    isUnseen(version: string) {
        return version.localeCompare(this.lastSeen, undefined, { numeric: true, sensitivity: 'base' }) > 0;
    }

    changeSetting(roomId: string, name: string, value: any, token?: string): JQuery.Promise<boolean> {
        return this.post('/api/rooms.settingsChange', new RoomsChangeSettings(roomId, name, value).withCaptcha(token))
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
