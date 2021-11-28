import Component from "vue-class-component";
import Vue from 'vue';
import { AsyncStorage, GameField, GamePlayer, Gender, Rank, UserInfoLong, BanInfo, Friendship } from '../shared/beans';
import merge from "lodash/merge";
import { debug } from '../util/debug';

class GameSettings {
    splitCommonStats = true;
}

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
    laps = 0;
    income = 0;
    expenses = 0;

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

interface GameEvent {
    type: string
    user_id: number
    money?: number
    sum?: number
    chance_id?: number
    destinations_count?: number
}

interface UpdateAction {
    id: number
    events: Array<GameEvent>
    status: GameStatus
    time: any
}

interface Packet {
    msg: UpdateAction
    no_events?: boolean
    no_status?: boolean
}

interface ChanceCard {
    range?: Array<number>
    rangeStep?: number
    sum?: number
    text: string
    type: string
}

const WORMHOLE_DEFAULT_FREE_DESTINATIONS = 3;

declare module 'vue/types/vue' {
    interface Vue {
        flags: {
            game_2x2: boolean
        }
        about: {
            is_m1tv: boolean
            gs_game_id: string
            gs_id: string
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
            chance_cards: Array<ChanceCard>
            WORMHOLE_EXTRA_DESTINATION_COST: number
            LEVEL_CHANGE_NO_MNPL: number
            UNEVEN_LEVEL_CHANGE: number
        }
        status: GameStatus
        update: (e: UpdateAction, t: boolean) => void
        packetProcess: (e: Packet, t: boolean) => void
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
    mePlaying = false;
    updates = 0;
    updateActionPlayer = 0;
    lockedFields = new Set<number>();
    users: { [key: number]: UserInfoLong } = null;
    stor: AsyncStorage = null;
    usersLoaded = false;
    teamReverse = 0;
    firstHandledPacket = 0;
    gameOver = false;
    settings: GameSettings = null;

    created() {
        const gameSettings = localStorage.getItem('game_settings');
        this.settings = gameSettings ? JSON.parse(gameSettings) : new GameSettings();
        this.$watch('settings', (v) => {
            localStorage.setItem('game_settings', JSON.stringify(this.settings));
        }, { deep: true });
    }

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
        const oldupd = v.$options.methods.update;
        const oldpp = v.$options.methods.packetProcess;
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
                update(e: UpdateAction, t: boolean) {
                    oldupd.apply(v, arguments);
                    ref.updates++;
                },
                packetProcess(e: Packet, t: boolean) {
                    debug('packet', e.msg.id, e.msg.status?.action_player, ref.players.find(pl => e.msg.status?.action_player === pl.user_id)?.nick, e.msg.events?.map(event => `${event.type}=${event.money}`), t);
                    ref.firstHandledPacket === 0 && (ref.firstHandledPacket = e.msg.id, ref.loadDemo().then(msgs => {
                        debug('start process old packets', msgs.length);
                        msgs.some(msg => {
                            debug('old packet', e.msg.status.action_player, ref.players.find(pl => e.msg.status.action_player === pl.user_id)?.nick, msg.id, msg.events?.map(event => `${event.type}=${event.money}`));
                            if (msg.id === ref.firstHandledPacket) {
                                debug('stop process old packets')
                                return true;
                            }
                            ref.handlePacket({ msg });
                        })
                    }));
                    try {
                        ref.handlePacket(e);
                    } catch (error) {
                        console.error('error handling packet', e, error);
                    }
                    oldpp.apply(v, arguments);
                }
            }
        });
    }

    private handlePacket(packet: Packet) {
        packet.msg.events?.forEach(event => {
            const pl = this.players.find(pl => pl.user_id === event.user_id);
            switch (event.type) {
                case 'gameOver':
                    this.gameOver = true;
                    break;

                case 'startBypass':
                    pl.laps++;
                case 'start_bonus':
                case 'insuranceReturn':
                case 'jackpot_win':
                case 'jackpot_superprize_win':
                case 'russianRoulette_alive':
                case 'cash_plus':
                case 'credit_taken':
                    pl.income += event.money ?? event.sum ?? 0;
                    break;

                case 'startBypassFeePaid':
                    pl.laps++;
                case 'feePaid':
                case 'credit_payed':
                case 'jackpot_lose':
                case 'jackpot_superprize_funded':
                case 'jackpot_paid':
                case 'unjailedByFee':
                case 'russianRoulette_process':
                    pl.expenses += event.money ?? event.sum ?? 0;
                    break;

                case 'wormhole_opened':
                    pl.expenses += this.storage.config.WORMHOLE_EXTRA_DESTINATION_COST * (event.destinations_count - WORMHOLE_DEFAULT_FREE_DESTINATIONS);
                    break;

                case 'chance':
                    const chanceCard = this.storage.config.chance_cards[event.chance_id];
                    const type = chanceCard.type;
                    debug('chance', type)
                    switch (type) {
                        case 'cash_in':
                            pl.income += event.money ?? event.sum ?? 0;
                            break;
                        case 'birthday':
                            pl.income += this.getBirthdayMoneyFor(pl, chanceCard.sum);
                            break;
                    }
                    break;
            }
        })
    }

    private loadDemo(): JQueryPromise<Array<UpdateAction>> {
        return $.get(`https://demos.monopoly-one.com/dl/${this.storage.about.gs_id}/${this.storage.about.gs_game_id}.mid`)
            .then((res: string) => {
                return res.split("\n").map(line => JSON.parse(line));
            }).fail((err) => console.error('failed to load demo', err));
    }

    private getBirthdayMoneyFor(bpl: Player, sum: number): number {
        const playersToPay = this.players
            .map(pl => ({ pl, spl: this.storage.status.players.find(sp => sp.user_id === pl.user_id) }))
            .filter(({ spl }) => spl.status !== -1)
            .filter(({ pl }) => this.party ? pl.team !== bpl.team : pl.user_id !== bpl.user_id);
        return playersToPay.map(({ pl, spl }) => {
            const expense = Math.min(spl.money, sum);
            pl.expenses += expense;
            return expense;
        }).reduce((a, b) => a + b, 0);
    }

    load() {
        this.user = window.API.user;
        this.party = this.storage.flags.game_2x2;
        this.loadPlayers();
        this.stor.load(this.players.map(pl => pl.user_id));
        this.loaded = true;
    }

    private loadPlayers() {
        const players = this.storage.status.players;
        const myidx = players.findIndex(pl => this.isMe(pl));
        this.mePlaying = myidx >= 0;
        const mydata = myidx >= 0 ? players[myidx] : null;
        this.needFixColor = myidx > 0;
        this.teamReverse = Number(this.party && players[0].team !== 0);

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

    formatMoney(res: number): string {
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