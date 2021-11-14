import Component from "vue-class-component";
import Vue from 'vue';
import { AsyncStorage, GameField, GamePlayer, Gender, Rank, UserInfoLong, BanInfo, Friendship } from '../shared/beans';
import merge from "lodash/merge";
import { debug } from '../util/debug';

export class Player {
    nick: string;
    gender: Gender;
    rank: Rank;
    token: HTMLElement;
    games: number;
    wins: number;
    winrate: number;
    mfp_ban_history: BanInfo;
    friendship: Friendship;

    constructor(
        public user_id: number,
        public orderOrig: number,
        public order: number,
        public team: number
    ) { }
}

interface GameStatus {
    fields: {
        [key: number]: GameField
    }
    players: Array<GamePlayer>
    round: number
    viewers: number
    action_player: number
}

interface UpdateAction {
    id: number
    events: Array<any>
    status: GameStatus
    time: any
}

declare module 'vue/types/vue' {
    interface Vue {
        flags: {
            game_2x2: boolean
        }
        about: {
            is_m1tv: boolean
        }
        vms: {
            fields: {
                fields_with_equipment: Map<number, GameField>
            }
        }
        config: {
            coeff_mortgage?: number
            coeff_unmortgage?: number
            coeff_field_drop?: number
            coeff_reject_mortgaged?: number
            auction_mortgaged?: number
        }
        status: GameStatus
        update: (e: UpdateAction, t: any) => void
        api_user: any
        is_ready: boolean
    }
}

@Component
export default class GameState extends Vue {
    party = false;
    players = new Array<Player>();
    user: UserInfoLong = null;
    needFixColor = false;
    storage: Vue = null;
    loaded = false;
    updates = 0;
    updateActionPlayer = 0;
    lockedFields = new Set<number>();
    users: { [key: number]: UserInfoLong } = null;
    stor: AsyncStorage = null;
    usersLoaded = false;

    init(v: Vue) {
        this.storage = v;
        this.stor = window.API.createAsyncStorage({ is_short: false });
        this.users = this.stor.storage;

        this.$watch('users', v => {
            this.players.forEach(pl => {
                const user = this.users[pl.user_id];
                pl.nick = user.nick;
                pl.gender = user.gender;
                pl.rank = user.rank;
                pl.friendship = user.friendship;
                pl.games = user.games;
                pl.wins = user.games_wins;
                // user.mfp_ban_history = new BanInfo();
                // user.mfp_ban_history.count = 10;
                pl.mfp_ban_history = user.mfp_ban_history;
                pl.winrate = user.games > 0 ? Math.round((user.games_wins / user.games) * 100) : 0;
            });
            this.usersLoaded = true;
        });

        const ref = this;
        const old = v.$options.methods.update;
        merge(v.$options, {
            computed: {
                player_indexes: function () {
                    return new Map(this.is_ready
                        ? ref.players.map(pl => [pl.user_id, pl.order])
                        : []);
                }
            },
            watch: {
                'status.players': () => {
                    if (!ref.loaded) {
                        ref.load();
                    }
                }
            },
            methods: {
                update(e: UpdateAction, t: any) {
                    old.apply(v, arguments);
                    ref.updates++;
                }
            }
        });
    }

    load() {
        this.loaded = true;
        this.user = window.API.user;
        this.party = this.storage.flags.game_2x2;
        this.loadPlayers();
        this.stor.load(this.players.map(pl => pl.user_id));
    }

    private loadPlayers() {
        const players = this.storage.status.players;
        const myidx = players.findIndex(pl => this.isMe(pl));
        const mydata = myidx >= 0 ? players[myidx] : null;
        this.needFixColor = myidx > 0;

        let first = true;
        players.forEach((pl, orderOrig) => {
            let order = orderOrig;
            if (this.needFixColor) {
                if (this.party) {
                    if (this.isMe(pl)) {
                        order = 0;
                    } else {
                        if (pl.team === mydata.team) {
                            order = 2;
                        } else {
                            order = first ? 1 : 3;
                            first = false;
                        }
                    }
                } else {
                    order = orderOrig === 0 ? myidx : (this.isMe(pl) ? 0 : orderOrig);
                }
            }

            this.players.push(new Player(pl.user_id, orderOrig, order, pl.team));
        });
        debug('got players', this.players);
    }

    getAssetsWorth(id: number): string {
        return window.parsers.numberToSpacedString(Math.round(window.Table.getAssetsWorth(id)), ",");
    }

    getShareableWorth(id: number): string {
        return this.formatMoney(this.getPlayerFieldsWorth(id));
    }

    getTeamWorth(team: number): string {
        const pls = this.storage.status.players
            .filter(pl => pl.team === team);
        let res = pls
            .map(pl => pl.money)
            .reduce((a, b) => a + b, 0);
        res += pls.map(pl => this.getPlayerFieldsWorth(pl.user_id))
            .reduce((a, b) => a + b, 0);
        return this.formatMoney(res);
    }

    private formatMoney(res: number): string {
        return window.parsers.numberToSpacedString(Math.round(res), ",");
    }

    private getPlayerFieldsWorth(id: number): number {
        let res = 0;
        const excludeGroups = new Array<number>();
        this.storage.vms.fields.fields_with_equipment.forEach(v => {
            if (v.owner_true !== id || v.mortgaged === true) {
                return;
            }
            if (v.level > 0 && !excludeGroups.includes(v.group)) {
                excludeGroups.push(v.group);
            }
        });
        this.storage.vms.fields.fields_with_equipment.forEach(v => {
            if (v.owner_true !== id || v.mortgaged === true || excludeGroups.includes(v.group)) {
                return;
            }
            if (this.storage.config.coeff_mortgage) {
                res += Math.round(v.buy * this.storage.config.coeff_mortgage);
                if (this.storage.config.coeff_reject_mortgaged) {
                    res += Math.round(v.buy * this.storage.config.coeff_mortgage * this.storage.config.coeff_reject_mortgaged);
                } else if (this.storage.config.auction_mortgaged) {
                    res += Math.round(v.buy * (1 - this.storage.config.coeff_mortgage));
                }
            } else if (this.storage.config.coeff_field_drop) {
                res += Math.round(v.buy * this.storage.config.coeff_field_drop);
            }
        });
        return res;
    }

    private isMe(pl: GamePlayer): boolean {
        return pl.user_id === this.user.user_id;
    }
}