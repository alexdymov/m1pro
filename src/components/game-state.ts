import Component from "vue-class-component";
import Vue from 'vue';
import { GameField, GamePlayer, Gender, Rank, UserData, UserInfoLong } from '../shared/beans';
import merge from "lodash/merge";
import { get } from "lodash";
import { debug } from '../util/debug';

export class Player {
    constructor(
        public user_id: number,
        public orderOrig: number,
        public order: number,
        public team: number,
        public nick?: string,
        public gender?: Gender,
        public rank?: Rank,
        public token?: HTMLElement
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

    init(v: Vue) {
        this.storage = v;
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
        const players = this.storage.status.players;
        const myidx = players.findIndex(pl => this.isMe(pl));
        const mydata = myidx >=0 ? players[myidx] : null;
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

            // const { nick, gender, rank } = window.Table.users_data[pl.user_id];
            this.players.push(new Player(pl.user_id, orderOrig, order, pl.team/* , nick, gender, rank */));
        });
        debug('got players', this.players);
    }

    getAssetsWorth(id: number): string {
        return window.parsers.numberToSpacedString(Math.round(window.Table.getAssetsWorth(id)), ",");
    }

    getShareableWorth(id: number): string {
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
                    res += Math.round(v.buy * (1 - this.storage.config.coeff_mortgage))
                }
            } else if (this.storage.config.coeff_field_drop) {
                res += Math.round(v.buy * this.storage.config.coeff_field_drop);
            }
        });
        return window.parsers.numberToSpacedString(Math.round(res), ",");
    }

    private isMe(pl: GamePlayer): boolean {
        return pl.user_id === this.user.user_id;
    }
}