import Component from "vue-class-component";
import Vue from 'vue';
import { AsyncStorage, GameField, GamePlayer, Gender, Rank, UserInfoLong, BanInfo, Friendship, GameEvent, ChanceCard, CurrentChanceCard, ChanceCardState, ContractEventData, ContractInfo, GameStatus, ConfigField, ConfigGroup } from '../shared/beans';
import merge from "lodash/merge";
import { debug } from '../util/debug';
import cloneDeep from "lodash/cloneDeep";
import extend from "lodash/extend";

class GameSettings {
    splitCommonStats = true;
    changeColor = true;
    showLiveContracts = true;
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

interface UpdateAction {
    id: number
    events: Array<GameEvent>
    status: GameStatus
    time: { ts_now?: number }
}

interface Packet {
    msg: UpdateAction
    no_events?: boolean
    no_status?: boolean
}

class PacketPlayerEvents {
    round: number;
    user: number;
    doubleSpent = false;
    events = new Array<GameEvent>();
    lastDiceEvent: GameEvent = null;

    getLastPosition() {
        const last = [...this.events].reverse().find(e => e.field_id !== undefined || e.mean_position !== undefined);
        return last.mean_position ?? last.field_id;
    }
}

const WORMHOLE_DEFAULT_FREE_DESTINATIONS = 3;

declare module 'vue/types/vue' {
    interface Vue {
        flags: {
            game_2x2: boolean
            match_title: string
            game_submode: number
            game_mode: number
        }
        about: {
            is_m1tv: boolean
            gs_game_id: string
            gs_id: string
        }
        vms: {
            fields: {
                fields_to_move: Map<number, number>
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
            UNLIMITED_LEVEL_CHANGE: number
            fields: Array<ConfigField>
            groups: Array<ConfigGroup>
            version: number
            roundCash: number
            roundTaxes: [{ game_time: number, tax: number }]
            incomeTaxes: [{ game_time: number, tax_rate: number }]
        }
        time: {
            delta: number
            inactive: number
            ts_now: number
            ts_start: number
        }
        status: GameStatus
        update: (e: UpdateAction, t: boolean) => void
        packetProcess: (e: Packet, t: boolean) => void
        api_user: any
        is_ready: boolean
        field_id_jail: number
        game_mode_titles: string[]
        game_submode_titles: string[]
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
    lastPacket = 0;
    gameOver = false;
    settings: GameSettings = null;
    lastBusUserId = 0;
    currentTeleports = new Array<GameEvent>();
    pendingLastReverseMoveRounds: { [key: string]: number } = {};
    pendingLastSkipMoveRounds: { [key: string]: number } = {};
    lastReverseMoveRounds: { [key: string]: number } = {};
    lastSkipMoveRounds: { [key: string]: number } = {};
    chancePoolInit = false;
    chancePool = new Array<ChanceCardState>();
    oldChancePool: Array<ChanceCardState> = null;
    pendingChancePool = new Array<number>();
    pendingChancesToRemove = new Array<number>();
    currentChanceCards = new Array<CurrentChanceCard>();
    currentEvents = new PacketPlayerEvents();
    demoEvents = new PacketPlayerEvents();
    wormholeDestinations = new Array<number>();
    contractEvents = new Array<ContractInfo>();
    ongoingContract: ContractInfo = null;
    vmfields: Vue;

    created() {
        const gameSettings = localStorage.getItem('game_settings');
        const initSettings = new GameSettings();
        this.settings = cloneDeep(initSettings);
        gameSettings && (this.settings = extend(this.settings, JSON.parse(gameSettings)));
    }

    init(v: Vue) {
        this.storage = v;
        this.stor = window.API.createAsyncStorage({ is_short: false });
        this.users = this.stor.storage;
        this.$watch('settings', (v) => {
            localStorage.setItem('game_settings', JSON.stringify(this.settings));
        }, { deep: true });

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
        const settings = this.settings;
        merge(v.$options, {
            computed: {
                player_indexes: function () {
                    return new Map(this.is_ready
                        ? ref.players.map(pl => [pl.user_id, settings.changeColor ? pl.order : pl.orderOrig])
                        : []);
                }
            },
            watch: {
                'status.players': () => {
                    if (!ref.loaded) {
                        ref.load();
                    }
                }/*,
                'status.current_move': (v: any) => {
                    Object.keys(v).length && debug('move', JSON.parse(JSON.stringify(v)), this.storage.status.action_player)
                }*/
            },
            methods: {
                update(e: UpdateAction, t: boolean) {
                    oldupd.apply(v, arguments);
                    ref.updates++;
                },
                packetProcess(e: Packet, t: boolean) {
                    const curpl = e.msg.events[0]?.user_id;
                    debug('packet', `#${e.msg.id}`, curpl,
                        ref.players.find(pl => curpl === pl.user_id)?.nick,
                        e.msg.events?.map(event => `${event.type}=${JSON.stringify(event)}`), t, JSON.parse(JSON.stringify(e)));
                    if (!ref.storage.status) {
                        oldpp.apply(v, arguments);
                        return;
                    }
                    ref.lastPacket = e.msg.id;
                    const firstPacket = ref.firstHandledPacket === 0;
                    if (firstPacket) {
                        ref.firstHandledPacket = e.msg.id;
                        ref.oldChancePool = ref.storage.config.chance_cards && [...ref.storage.config.chance_cards].map(c => ({ ...c, out: false })) || [];
                        ref.loadDemo(e.msg.id).then(msgs => {
                            debug('start process old packets', msgs.length, 'until', ref.firstHandledPacket);
                            msgs.some(msg => {
                                // const oldpl = msg.events[0]?.user_id;
                                // debug('old packet', `#${msg.id}`, oldpl,
                                //     ref.players.find(pl => oldpl === pl.user_id)?.nick,
                                //     msg.events?.map(event => `${event.type}=${JSON.stringify(event)}`), JSON.parse(JSON.stringify(msg)));
                                if (msg.id === ref.firstHandledPacket) {
                                    debug('stop process old packets', ref)
                                    const pool = [...ref.oldChancePool];
                                    ref.pendingChancePool.forEach(pc => {
                                        pool[pc].out = true;
                                    });
                                    pool.forEach(card => ref.chancePool.push(card));
                                    ref.chancePoolInit = true;
                                    return true;
                                }
                                try {
                                    ref.handlePacket({ msg }, false);
                                } catch (error) {
                                    console.error('error handling demo packet', msg, error);
                                }
                            });
                        });
                    }
                    oldpp.apply(v, arguments);
                    if (firstPacket) {
                        setTimeout(() => {
                            try {
                                ref.handlePacket(e, true);
                            } catch (error) {
                                console.error('error handling packet', e, error);
                            }
                        }, 1);
                    } else {
                        try {
                            ref.handlePacket(e, true);
                        } catch (error) {
                            console.error('error handling packet', e, error);
                        }
                    }
                }
            }
        });
    }

    private handlePacket(packet: Packet, current: boolean) {
        // packet.msg.events?.find()
        if (current) {
            this.clearLastBus();
            this.clearLastReverse(packet);
        }
        let teleport: GameEvent = null;
        const roll = current ? this.currentEvents : this.demoEvents;
        packet.msg.status && this.checkRoll(roll, packet);
        let ctrRes = 0;
        packet.msg.events?.forEach(event => {
            const pl = this.players.find(pl => pl.user_id === event.user_id);
            switch (event.type) {
                case 'restart':
                    this.$emit('restart');
                    this.restartChancePool();
                    break;

                case 'busStopChoosed':
                    current && (this.lastBusUserId = event.user_id)
                case 'fieldToMoveChoosed':
                    roll.events.push(event);
                    break;
                case 'unjailedByFee':
                    roll.events.push(event);
                    pl.expenses += event.money ?? event.sum ?? 0;
                    break;
                case 'rollDices':
                    if (!packet.no_events) {
                        roll.events.push(event);
                        roll.lastDiceEvent = event;
                    }
                    break;
                case 'gameOver':
                    this.gameOver = true;
                    break;
                case 'goToJailByCombo':
                    roll.events.push(event);
                    break;
                case 'double_spended':
                    roll.doubleSpent = true;
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
                case 'russianRoulette_process':
                    pl.expenses += event.money ?? event.sum ?? 0;
                    break;

                case 'wormhole_opened':
                    pl.expenses += this.storage.config.WORMHOLE_EXTRA_DESTINATION_COST * (event.destinations_count - WORMHOLE_DEFAULT_FREE_DESTINATIONS);
                    if (!this.storage.about.is_m1tv && event.user_id !== this.user.user_id && current) {
                        this.loadDemo(packet.msg.id).then(msgs => {
                            const wh = msgs.find(msg => msg.id === packet.msg.id);
                            this.wormholeDestinations.push(...wh.status.current_move.wormhole_destinations);
                        });
                    }
                    break;
                case 'wormhole_used':
                    roll.events.push(event);
                    this.wormholeDestinations.splice(0, this.wormholeDestinations.length);
                    break;

                case 'contract':
                    debug('contract', packet.msg.id, current)
                    if (current) {
                        if (!this.storage.about.is_m1tv) {
                            if (event.user_id !== this.user.user_id && event.to !== this.user.user_id) {
                                this.loadDemo(packet.msg.id).then(msgs => {
                                    const contract = msgs.find(msg => msg.id === packet.msg.id);
                                    this.contractEvents.push({ ...contract.status.current_move.contract, time: contract.time.ts_now, result: 0, status: contract.status });
                                    if (this.settings.showLiveContracts) {
                                        this.ongoingContract = { ...contract.status.current_move.contract, time: contract.time.ts_now, result: 0, status: null };
                                    }
                                });
                            } else {
                                this.ongoingContract = null;
                                this.contractEvents.push({ ...packet.msg.status.current_move.contract, time: packet.msg.time.ts_now, result: 0, status: packet.msg.status });
                            }
                        } else {
                            this.contractEvents.push({ ...packet.msg.status.current_move.contract, time: packet.msg.time.ts_now, result: 0, status: packet.msg.status });
                        }
                    } else {
                        this.contractEvents.push({ ...packet.msg.status.current_move.contract, time: packet.msg.time.ts_now, result: 0, status: packet.msg.status });
                    }
                    break;
                case 'contract_accepted':
                    ctrRes = 1;
                case 'contract_declined':
                    ctrRes = ctrRes || 2;
                    if (this.contractEvents.length) {
                        this.contractEvents[this.contractEvents.length - 1].result = ctrRes;
                    } else {
                        const unwatch = this.$watch('contractEvents', _ => {
                            const last = this.contractEvents[this.contractEvents.length - 1];
                            last.result === 0 && (last.result = ctrRes);
                            unwatch();
                        }, { deep: true });
                    }
                    this.ongoingContract = null;
                    break;

                case 'chance':
                    roll.events.push(event);
                    const chanceCard = this.storage.config.chance_cards[event.chance_id];

                    if (current) {
                        this.currentChanceCards.push(new CurrentChanceCard(teleport ? teleport.mean_position : this.currentEvents.getLastPosition(), chanceCard, event.user_id, event.money ?? event.sum));
                        if (chanceCard.type === 'teleport') {
                            teleport = event;
                        }
                        if (this.chancePoolInit) {
                            this.pendingChancesToRemove.push(event.chance_id);
                        } else {
                            this.pendingChancePool.push(event.chance_id);
                        }
                    } else {
                        this.oldChancePool[event.chance_id].out = true;
                        if (this.oldChancePool.filter(oc => !oc.out).length === 0) {
                            this.restartChancePool();
                        }
                    }

                    const type = chanceCard.type;
                    debug('chance', type, packet.msg.id, event.chance_id)
                    switch (type) {
                        case 'cash_in':
                            pl.income += event.money ?? event.sum ?? 0;
                            break;
                        case 'birthday':
                            pl.income += this.getBirthdayMoneyFor(pl, chanceCard.sum);
                            break;
                        case 'teleport':
                            current && (this.currentTeleports.push(event));
                            break;
                        case 'move_skip':
                            // debug('chance move_skip')
                            this.isMoveSkipApplied(roll, current) &&
                                (this.pendingLastSkipMoveRounds[event.user_id] = this.getCurrentRound(packet, event.user_id));
                            // debug(JSON.parse(JSON.stringify(this.lastSkipMoveRounds)))
                            break;
                        case 'reverse':
                            this.isMoveReverseApplied(roll, current) &&
                                (this.pendingLastReverseMoveRounds[event.user_id] = this.getCurrentRound(packet, event.user_id));
                            break;
                    }
                    break;
            }
        })
    }

    private restartChancePool() {
        this.oldChancePool.forEach(oc => oc.out = false);
    }

    private checkRoll(roll: PacketPlayerEvents, packet: Packet) {
        const eventUser = packet.msg.events[0]?.user_id;
        if (!eventUser) {
            return roll;
        }
        const round = this.getCurrentRound(packet, eventUser);
        if (round === roll.round && eventUser === roll.user) {
            return roll;
        }
        roll.round = round;
        roll.user = eventUser;
        roll.doubleSpent = false;
        roll.lastDiceEvent = null;
        roll.events.splice(0, roll.events.length);
    }

    private clearLastReverse(packet: Packet) {
        const eventUser = packet.msg.events[0]?.user_id;
        if (eventUser && this.lastReverseMoveRounds[eventUser] && (this.storage.status.round - this.lastReverseMoveRounds[eventUser] > 1) && eventUser !== packet.msg.status.action_player) {
            debug('clear reverse on move', eventUser, this.lastReverseMoveRounds[eventUser]);
            Vue.delete(this.lastReverseMoveRounds, eventUser);
        }
    }

    private clearLastBus() {
        this.lastBusUserId = undefined;
    }

    private getCurrentRound(packet: Packet, userId: number) {
        const packetRound = packet.msg.status.round;
        const playersLeft = this.storage.status.players.filter(spl => spl.status !== -1);
        if (playersLeft.findIndex(pl => pl.user_id === userId) === playersLeft.length - 1 && packet.msg.status.action_player !== userId) {
            return packetRound - 1;
        } else {
            return packetRound;
        }
    }

    private isMoveReverseApplied(roll: PacketPlayerEvents, current: boolean) {
        const res = (current || (this.storage.status.round - roll.round) < 1);
        debug(`isMoveReverseApplied===${res}`, current, this.storage.status.round - roll.round, roll);
        return res;
    }

    private isMoveSkipApplied(roll: PacketPlayerEvents, current: boolean) {
        const dices = roll.lastDiceEvent?.dices;
        const diceRollTriple = (dices?.length === 3 && dices[0] < 4 && dices[0] === dices[1] && dices[0] === dices[2]);
        const diceRollDouble = (dices?.length === 2 && dices[0] === dices[1]) ||
            (dices?.length === 3 && dices[0] === dices[1] && !diceRollTriple);
        const res = (current || (this.storage.status.round - roll.round) < 1) && (!diceRollDouble || roll.doubleSpent);
        debug(`isMoveSkipApplied===${res}`, current, this.storage.status.round - roll.round, diceRollDouble, diceRollTriple, roll);
        return res;
    }

    public loadDemo(id?: number, tries = 0): JQueryPromise<Array<UpdateAction>> {
        return $.get(`https://demos.monopoly-one.com/dl/${this.storage.about.gs_id}/${this.storage.about.gs_game_id}.mid?_=${new Date().getTime()}`)
            .then((res: string) => {
                const lines: Array<UpdateAction> = res.split("\n").map(line => JSON.parse(line));
                if (!id || (id && lines.find(msg => msg.id === id))) {
                    return lines;
                } else if (tries < 3) {
                    return this.loadDemo(id, ++tries);
                } else {
                    throw new Error('out of demo load tries');
                }
            }).fail((err) => console.error('failed to load demo', err));
    }

    private getBirthdayMoneyFor(bpl: Player, sum: number): number {
        return this.getBirthdayPayers(bpl).map(({ pl, spl }) => {
            const expense = Math.min(spl.money, sum);
            pl.expenses += expense;
            return expense;
        }).reduce((a, b) => a + b, 0);
    }

    public getBirthdayPayers(bpl: Player) {
        return this.players
            .map(pl => ({ pl, spl: this.storage.status.players.find(sp => sp.user_id === pl.user_id) }))
            .filter(({ spl }) => spl.status !== -1)
            .filter(({ pl }) => this.party ? pl.team !== bpl.team : pl.user_id !== bpl.user_id);
    }

    load() {
        this.user = window.API.user;
        this.party = this.storage.flags.game_2x2;
        this.loadPlayers();
        this.stor.load(this.players.map(pl => pl.user_id));
        this.$watch('storage.status.round', r => {
            debug('round', r)
            if (Object.keys(this.lastSkipMoveRounds).length !== 0) {
                Object.keys(this.lastSkipMoveRounds).forEach(user => {
                    if (r - this.lastSkipMoveRounds[user] > 1) {
                        debug('delete skip', user, r, this.lastSkipMoveRounds[user])
                        Vue.delete(this.lastSkipMoveRounds, user);
                    }
                })
            }
        });
        this.$watch('lastSkipMoveRounds', _ => {
            debug('lastSkipMoveRounds', JSON.parse(JSON.stringify(this.lastSkipMoveRounds)));
            jQuery(this.players.map(pl => pl.token)).find('div._skip').hide();
            Object.keys(this.lastSkipMoveRounds).forEach(user => {
                jQuery(this.players.find(pl => pl.user_id === Number(user)).token).find('div._skip').show();
            });
        }, { deep: true });
        this.$watch('lastReverseMoveRounds', _ => {
            debug('lastReverseMoveRounds', JSON.parse(JSON.stringify(this.lastReverseMoveRounds)));
            jQuery(this.players.map(pl => pl.token)).find('div._back').hide();
            Object.keys(this.lastReverseMoveRounds).forEach(user => {
                jQuery(this.players.find(pl => pl.user_id === Number(user)).token).find('div._back').show();
            });
        });
        this.$watch('storage.is_events_processing', p => {
            if (!p) {
                if (Object.keys(this.pendingLastSkipMoveRounds).length) {
                    Vue.set(this.lastSkipMoveRounds, Object.keys(this.pendingLastSkipMoveRounds)[0], Object.values(this.pendingLastSkipMoveRounds)[0]);
                    this.pendingLastSkipMoveRounds = {};
                }
                if (Object.keys(this.pendingLastReverseMoveRounds).length) {
                    Vue.set(this.lastReverseMoveRounds, Object.keys(this.pendingLastReverseMoveRounds)[0], Object.values(this.pendingLastReverseMoveRounds)[0]);
                    this.pendingLastReverseMoveRounds = {};
                }
                debug('pend pool', JSON.parse(JSON.stringify(this.pendingChancesToRemove)))
                if (this.pendingChancesToRemove.length) {
                    this.pendingChancesToRemove.forEach(v => this.chancePool[v].out = true);
                    if (this.chancePool.filter(c => !c.out).length === 0) {
                        this.chancePool.forEach(c => c.out = false);
                    }
                    this.pendingChancesToRemove.splice(0, this.pendingChancesToRemove.length);
                }
                if (this.currentEvents.lastDiceEvent?.move_reverse && this.lastReverseMoveRounds[this.currentEvents.user]) {
                    debug('clear reverse on the move', this.currentEvents.user, this.lastReverseMoveRounds[this.currentEvents.user]);
                    Vue.delete(this.lastReverseMoveRounds, this.currentEvents.user);
                }
            }
        });
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

    getPlayerFieldsWorth(id: number): number {
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
            res += this.getFieldMortgageWorth(v);
        });
        return res;
    }

    getFieldMortgageWorth(field: GameField) {
        let res = 0;
        if (this.storage.config.coeff_mortgage) {
            res += Math.round(field.buy * this.storage.config.coeff_mortgage);
            if (this.storage.config.coeff_reject_mortgaged) {
                res += Math.round(field.buy * this.storage.config.coeff_mortgage * this.storage.config.coeff_reject_mortgaged);
            } else if (this.storage.config.auction_mortgaged) {
                res += Math.round(field.buy * (1 - this.storage.config.coeff_mortgage));
            }
        } else if (this.storage.config.coeff_field_drop) {
            res += Math.round(field.buy * this.storage.config.coeff_field_drop);
        }
        return res;
    }

    getFieldUnmortgage(field: GameField) {
        return Math.round(field.buy * this.storage.config.coeff_mortgage * this.storage.config.coeff_unmortgage);
    }

    private isMe(pl: GamePlayer): boolean {
        return pl.user_id === this.user.user_id;
    }
}