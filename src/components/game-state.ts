import Component from "vue-class-component";
import Vue from 'vue';
import { AsyncStorage, GameField, GamePlayer, Gender, Rank, UserInfoLong, BanInfo, Friendship, GameEvent, ChanceCard, CurrentChanceCard, ChanceCardState, ContractEventData, ContractInfo, GameStatus, ConfigField, ConfigGroup } from '../shared/beans';
import merge from "lodash/merge";
import { contractDebug, debug } from '../util/debug';
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
        const last = [...this.events].reverse().find(e => e.field_id !== undefined || (e.mean_position !== undefined && e.type !== 'chance'));
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
    currentChooses = new Array<GameEvent>();
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
    /** Prevents overlapping iframe loads when opening Договоры tab repeatedly. */
    observerContractHistoryLoadInFlight = false;
    ongoingContract: ContractInfo = null;
    vmfields: Vue;

    public get chanceCardsConfig(): Array<ChanceCard> {
        return this.resolveChanceCardsConfig();
    }

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
                        ref.oldChancePool = ref.chanceCardsConfig.length
                            ? [...ref.chanceCardsConfig].map(c => ({ ...c, out: false }))
                            : [];
                        ref.loadDemo(e.msg.id).then(msgs => {
                            debug('start process old packets', msgs.length, 'until', ref.firstHandledPacket);
                            let reachedCurrentPacket = false;
                            msgs.some(msg => {
                                // const oldpl = msg.events[0]?.user_id;
                                // debug('old packet', `#${msg.id}`, oldpl,
                                //     ref.players.find(pl => oldpl === pl.user_id)?.nick,
                                //     msg.events?.map(event => `${event.type}=${JSON.stringify(event)}`), JSON.parse(JSON.stringify(msg)));
                                if (msg.id === ref.firstHandledPacket) {
                                    reachedCurrentPacket = true;
                                    return true;
                                }
                                try {
                                    ref.handlePacket({ msg }, false);
                                } catch (error) {
                                    console.error('error handling demo packet', msg, error);
                                }
                            });
                            if (!reachedCurrentPacket) {
                                debug('stop process old packets by fallback', ref.firstHandledPacket);
                            } else {
                                debug('stop process old packets', ref);
                            }
                            if (!ref.chancePoolInit) {
                                const pool = [...ref.oldChancePool];
                                ref.pendingChancePool.forEach(pc => {
                                    if (pool[pc]) {
                                        pool[pc].out = true;
                                    }
                                });
                                pool.forEach(card => ref.chancePool.push(card));
                                ref.chancePoolInit = true;
                            }
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
            const spl = this.storage.status.players.find(spl => spl.user_id === event.user_id);
            switch (event.type) {
                case 'restart':
                    this.$emit('restart');
                    this.restartChancePool();
                    break;

                case 'busStopChoosed':
                    current && (this.lastBusUserId = event.user_id, this.currentChooses.push(event));
                case 'fieldToMoveChoosed':
                    roll.events.push(event);
                    current && this.currentChooses.push(event);
                    break;
                case 'unjailedByFee':
                    roll.events.push(event);
                    pl.expenses += event.money ?? event.sum ?? 0;
                    break;
                case 'rollDices':
                    if (!packet.no_events) {
                        roll.events.push(event);
                        roll.lastDiceEvent = event;
                        if (spl.doublesRolledAsCombo > 0 && !this.isLastDiceRollDouble(roll)) {
                            jQuery(pl.token).find('div._cntr').hide();
                        }
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
                case 'rollDicesForUnjailSuccess':
                    roll.events.push(event);
                    jQuery(pl.token).find('div._cntr').hide();
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
                        const whDest =
                            (this.storage.status as any)?.current_move?.wormhole_destinations ||
                            (packet.msg.status as any)?.current_move?.wormhole_destinations;
                        if (Array.isArray(whDest) && whDest.length) {
                            this.wormholeDestinations.push(...whDest);
                        } else {
                            this.loadDemo(packet.msg.id).then(msgs => {
                                const wh = msgs.find(msg => msg.id === packet.msg.id);
                                if (wh?.status?.current_move?.wormhole_destinations) {
                                    this.wormholeDestinations.push(...wh.status.current_move.wormhole_destinations);
                                }
                            });
                        }
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
                                const { data: ctr, status: st } = this.getObserverContractPayload(packet, event);
                                const pid = packet.msg.id;
                                const contractEventId = event._id;
                                contractDebug('contract event (observer): pushed row', {
                                    packetId: pid,
                                    contractEventId,
                                    initialCtr: ctr,
                                    eventSummary: { type: event.type, user_id: event.user_id, to: event.to, _id: event._id }
                                });
                                this.contractEvents.push({
                                    ...ctr,
                                    time: packet.msg.time.ts_now,
                                    result: 0,
                                    status: st,
                                    packetId: pid,
                                    contractEventId
                                });
                                // Defer TableContract modal until `.mid` enriches — WS alone often has no fields/money for observers.
                                this.enrichObserverContractFromDemo(pid, contractEventId);
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
                    const chanceCard = this.chanceCardsConfig[event.chance_id] || { type: 'unknown', text: '' };

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
                        this.oldChancePool[event.chance_id] && (this.oldChancePool[event.chance_id].out = true);
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
        const diceRollDouble = this.isLastDiceRollDouble(roll);
        const res = (current || (this.storage.status.round - roll.round) < 1) && (!diceRollDouble || roll.doubleSpent);
        debug(`isMoveSkipApplied===${res}`, current, this.storage.status.round - roll.round, diceRollDouble, roll);
        return res;
    }

    private isLastDiceRollDouble(roll: PacketPlayerEvents) {
        const dices = roll.lastDiceEvent?.dices;
        const diceRollTriple = (dices?.length === 3 && dices[0] < 4 && dices[0] === dices[1] && dices[0] === dices[2]);
        const diceRollDouble = (dices?.length === 2 && dices[0] === dices[1]) ||
            (dices?.length === 3 && dices[0] === dices[1] && !diceRollTriple);
        return diceRollDouble;
    }

    /**
     * Map API/demo contract objects to {@link ContractEventData} (handles alternate property names).
     */
    private normalizeContractFromRaw(raw: any): ContractEventData | null {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        const from = raw.from ?? raw.user_id_from ?? raw.userFrom;
        const to = raw.to ?? raw.user_id_to ?? raw.userTo;
        if (typeof from !== 'number' || typeof to !== 'number') {
            return null;
        }
        const outFields = raw.out_fields ?? raw.field_ids_from ?? raw.fields_from;
        const inFields = raw.in_fields ?? raw.field_ids_to ?? raw.fields_to;
        return {
            from,
            to,
            out_fields: Array.isArray(outFields) ? [...outFields] : [],
            out_money: Number(raw.out_money ?? raw.money_from ?? 0) || 0,
            in_fields: Array.isArray(inFields) ? [...inFields] : [],
            in_money: Number(raw.in_money ?? raw.money_to ?? 0) || 0
        };
    }

    /**
     * Prefer live WebSocket `status.current_move.contract` (present after the game's packetProcess).
     * Fall back to fields on the contract event, then minimal from/to so observers see trades without demos.monopoly-one.com.
     */
    private getObserverContractPayload(packet: Packet, event: GameEvent): { data: ContractEventData; status: GameStatus } {
        const cmStorage = (this.storage.status as any)?.current_move;
        const cmPacket = (packet.msg.status as any)?.current_move;
        const fromStorage = this.normalizeContractFromRaw(cmStorage?.contract);
        if (fromStorage) {
            contractDebug('getObserverContractPayload: branch=storage.current_move.contract', {
                packetId: packet.msg.id,
                data: fromStorage,
                current_moveKeys: cmStorage && Object.keys(cmStorage)
            });
            return { data: fromStorage, status: this.storage.status };
        }
        const fromPacket = this.normalizeContractFromRaw(cmPacket?.contract);
        if (fromPacket) {
            contractDebug('getObserverContractPayload: branch=packet.msg.status.current_move.contract', {
                packetId: packet.msg.id,
                data: fromPacket,
                current_moveKeys: cmPacket && Object.keys(cmPacket)
            });
            return { data: fromPacket, status: packet.msg.status };
        }
        const st = (packet.msg.status ?? this.storage.status) as GameStatus;
        const ev: any = event;
        if (ev.out_fields !== undefined || ev.out_money !== undefined || ev.in_fields !== undefined || ev.in_money !== undefined) {
            const data = {
                from: event.user_id,
                to: event.to ?? event.user_id,
                out_fields: Array.isArray(ev.out_fields) ? [...ev.out_fields] : [],
                out_money: ev.out_money ?? 0,
                in_fields: Array.isArray(ev.in_fields) ? [...ev.in_fields] : [],
                in_money: ev.in_money ?? 0
            };
            contractDebug('getObserverContractPayload: branch=event fields on contract event', {
                packetId: packet.msg.id,
                eventType: event.type,
                event_id: event._id,
                data
            });
            return { data, status: st };
        }
        contractDebug('getObserverContractPayload: branch=fallback zeros (no contract on storage/packet/event)', {
            packetId: packet.msg.id,
            eventType: event.type,
            event_id: event._id,
            hasStorageContract: !!cmStorage?.contract,
            hasPacketContract: !!cmPacket?.contract,
            rawEventKeys: ev && typeof ev === 'object' ? Object.keys(ev) : []
        });
        return {
            data: {
                from: event.user_id,
                to: event.to ?? event.user_id,
                out_fields: [],
                out_money: 0,
                in_fields: [],
                in_money: 0
            },
            status: st
        };
    }

    /**
     * One `.mid` line = one WebSocket packet: same numeric `id` as `packet.msg.id`.
     * If needed, the `contract` event's `_id` also appears on that line's `events` (e.g. FHDpqTyqAA8).
     */
    private findMidLineWithContract(
        msgs: Array<UpdateAction>,
        packetId: number,
        contractEventId?: string
    ): UpdateAction | undefined {
        const hasContract = (line: UpdateAction): boolean => {
            return this.extractContractFromMidLine(line, true) !== null;
        };
        const byPacketId = msgs.find(m => m.id === packetId);
        const ids = msgs.map(m => m.id);
        contractDebug('findMidLineWithContract', {
            packetId,
            contractEventId,
            lineCount: msgs.length,
            idMin: ids.length ? Math.min(...ids) : undefined,
            idMax: ids.length ? Math.max(...ids) : undefined,
            hasLineForPacketId: !!byPacketId,
            packetLineHasExtractableContract: byPacketId ? hasContract(byPacketId) : false
        });
        if (byPacketId && hasContract(byPacketId)) {
            contractDebug('findMidLineWithContract: matched by packet id', { lineId: byPacketId.id });
            return byPacketId;
        }
        if (contractEventId) {
            for (const line of msgs) {
                const evs = line.events;
                if (!evs?.some(e => e.type === 'contract' && e._id === contractEventId)) {
                    continue;
                }
                if (hasContract(line)) {
                    contractDebug('findMidLineWithContract: matched by contract event _id', {
                        lineId: line.id,
                        contractEventId
                    });
                    return line;
                }
            }
            contractDebug('findMidLineWithContract: no line with matching contract _id', { contractEventId });
        }
        if (byPacketId) {
            contractDebug('findMidLineWithContract: fallback to line by packet id without extractable contract', {
                lineId: byPacketId.id,
                current_move: (byPacketId as any).status?.current_move,
                contractEvents: byPacketId.events?.filter(e => e.type === 'contract' || e.type === 'contract_details')
            });
        } else {
            contractDebug('findMidLineWithContract: no line with id === packetId', { packetId });
        }
        return byPacketId;
    }

    /** Prefer `status.current_move.contract`; else the `contract` event on the same packet line. */
    private extractContractFromMidLine(line: UpdateAction, silent = false): ContractEventData | null {
        const rawCm = (line as any)?.status?.current_move?.contract;
        const fromStatus = this.normalizeContractFromRaw(rawCm);
        if (fromStatus) {
            if (!silent) {
                contractDebug('extractContractFromMidLine: from status.current_move.contract', {
                    lineId: line.id,
                    rawCm,
                    normalized: fromStatus
                });
            }
            return fromStatus;
        }
        const ev = line.events?.find(e => e.type === 'contract');
        if (!ev) {
            if (!silent) {
                contractDebug('extractContractFromMidLine: no contract on line', {
                    lineId: line.id,
                    hasCurrentMove: !!(line as any)?.status?.current_move,
                    eventTypes: line.events?.map(e => e.type)
                });
            }
            return null;
        }
        const fromEv = this.normalizeContractFromRaw({
            from: ev.user_id,
            to: ev.to,
            out_fields: ev.out_fields,
            out_money: ev.out_money,
            in_fields: ev.in_fields,
            in_money: ev.in_money
        });
        if (!silent) {
            contractDebug('extractContractFromMidLine: from events[].type=contract', {
                lineId: line.id,
                event_id: ev._id,
                rawEvent: ev,
                normalized: fromEv
            });
        }
        return fromEv;
    }

    /**
     * Build full contract history from parsed `.mid` lines (same fields as enrichObserverContractFromDemo).
     * Walks packets in order; `contract_accepted` / `contract_declined` update the last open trade.
     */
    private buildObserverContractHistoryFromDemoLines(msgs: Array<UpdateAction>): ContractInfo[] {
        const rows: ContractInfo[] = [];
        const ordered = msgs.slice().sort((a, b) => a.id - b.id);
        for (const line of ordered) {
            for (const event of line.events ?? []) {
                if (event.type === 'contract') {
                    const full = this.extractContractFromMidLine(line, true);
                    if (!full) {
                        continue;
                    }
                    rows.push({
                        ...full,
                        time: line.time?.ts_now ?? 0,
                        result: 0,
                        status: line.status,
                        packetId: line.id,
                        contractEventId: event._id
                    });
                } else if (event.type === 'contract_accepted') {
                    if (rows.length) {
                        rows[rows.length - 1].result = 1;
                    }
                } else if (event.type === 'contract_declined') {
                    if (rows.length) {
                        rows[rows.length - 1].result = 2;
                    }
                }
            }
        }
        return rows;
    }

    /** Replace {@link contractEvents} with demo-backed rows (from `.mid`). */
    private applyObserverContractHistoryFromDemo(msgs: Array<UpdateAction>): void {
        if (this.storage.about.is_m1tv || !msgs.length) {
            return;
        }
        const rows = this.buildObserverContractHistoryFromDemoLines(msgs);
        if (!rows.length) {
            return;
        }
        this.contractEvents.splice(0, this.contractEvents.length, ...rows);
        contractDebug('applyObserverContractHistoryFromDemo', { rows: rows.length });
        console.info('[M1PRO demo] observer contract history from .mid', { trades: rows.length });
    }

    /**
     * Fetches `.mid` and merges the line for this trade (`packet.msg.id` = line `id`, optional `event._id`).
     */
    private enrichObserverContractFromDemo(packetId: number, contractEventId?: string): void {
        if (!this.storage?.about?.gs_id || !this.storage?.about?.gs_game_id) {
            contractDebug('enrichObserverContractFromDemo: aborted (missing gs_id / gs_game_id)', {
                gs_id: this.storage?.about?.gs_id,
                gs_game_id: this.storage?.about?.gs_game_id
            });
            return;
        }
        contractDebug('enrichObserverContractFromDemo: start', {
            packetId,
            contractEventId,
            gs_id: this.storage.about.gs_id,
            gs_game_id: this.storage.about.gs_game_id
        });
        this.loadDemo(packetId).then(msgs => {
            contractDebug('enrichObserverContractFromDemo: loadDemo resolved', {
                packetId,
                msgCount: msgs.length,
                contractRowsSnapshot: this.contractEvents.map(c => ({
                    packetId: c.packetId,
                    contractEventId: c.contractEventId,
                    out_fields: c.out_fields,
                    out_money: c.out_money,
                    in_fields: c.in_fields,
                    in_money: c.in_money
                }))
            });
            const line = this.findMidLineWithContract(msgs, packetId, contractEventId);
            const full = line ? this.extractContractFromMidLine(line) : null;
            if (line) {
                console.log('[M1PRO demo] trade for WebSocket packet id', packetId, {
                    demoLineId: line.id,
                    contractEventId: contractEventId ?? null,
                    normalizedContract: full,
                    demoLine: line
                });
            } else {
                console.warn('[M1PRO demo] no .mid line for WebSocket packet id', packetId, {
                    midLineCount: msgs.length,
                    idMinMax: msgs.length
                        ? { min: Math.min(...msgs.map(m => m.id)), max: Math.max(...msgs.map(m => m.id)) }
                        : null
                });
            }
            if (!full || !line) {
                contractDebug('enrichObserverContractFromDemo: FAILED — no extractable contract', {
                    packetId,
                    contractEventId,
                    hasLine: !!line,
                    full,
                    demoLineIdsSample: msgs.slice(0, 3).map(m => m.id),
                    demoLineIdsTail: msgs.slice(-3).map(m => m.id)
                });
                debug('enrichObserverContractFromDemo: no contract in demo line', packetId, contractEventId, !!line);
                return;
            }
            const i = this.contractEvents.findIndex(
                c => c.packetId === packetId && (contractEventId === undefined || c.contractEventId === contractEventId)
            );
            if (i === -1) {
                contractDebug('enrichObserverContractFromDemo: FAILED — findIndex === -1 (row not found)', {
                    packetId,
                    contractEventId,
                    rows: this.contractEvents.map(c => ({ packetId: c.packetId, contractEventId: c.contractEventId }))
                });
                return;
            }
            const row = this.contractEvents[i];
            contractDebug('enrichObserverContractFromDemo: before merge', {
                index: i,
                row,
                extracted: full
            });
            const merged: ContractInfo = {
                ...row,
                ...full,
                time: line.time?.ts_now ?? row.time,
                result: row.result,
                status: line.status ?? row.status,
                packetId,
                contractEventId: row.contractEventId ?? contractEventId
            };
            const allMoneyZero = merged.out_money === 0 && merged.in_money === 0;
            const anyField = (merged.out_fields?.length ?? 0) > 0 || (merged.in_fields?.length ?? 0) > 0;
            if (allMoneyZero && anyField) {
                contractDebug(
                    'enrichObserverContractFromDemo: OK — money is 0 but fields present (typical field-swap trade)',
                    {
                        out_fields: merged.out_fields,
                        in_fields: merged.in_fields
                    }
                );
            } else if (allMoneyZero && !anyField) {
                contractDebug('enrichObserverContractFromDemo: WARNING — both money and field lists empty after merge', merged);
            }
            this.$set(this.contractEvents, i, merged);
            contractDebug('enrichObserverContractFromDemo: applied merge', { index: i, merged });
            if (this.settings.showLiveContracts) {
                // Show modal only once we have full trade data from demo; keep `status` so TableContract uses field snapshot (vm_fields).
                this.$set(this, 'ongoingContract', { ...merged, status: merged.status });
                contractDebug('enrichObserverContractFromDemo: set ongoingContract for live modal', merged);
            }
        });
    }

    /** Log raw `.mid` body from iframe (large games truncated). */
    private logDemoMidResponse(res: string, reason: string): void {
        const max = 32000;
        const body = res.length > max ? `${res.slice(0, max)}\n… [truncated, total ${res.length} chars]` : res;
        console.log(`[M1PRO loadDemo] ${reason} (${res.length} chars):\n`, body);
    }

    /**
     * Loads demo `.mid` **only** via hidden iframe + `M1PRO_DEMO_DATA` (no fetch / GM / worker on demos host).
     */
    public loadDemo(id?: number, tries = 0): JQueryPromise<Array<UpdateAction>> {
        const deferred = $.Deferred<Array<UpdateAction>>();
        const url = `https://demos.monopoly-one.com/dl/${this.storage.about.gs_id}/${this.storage.about.gs_game_id}.mid?_=${Date.now()}&r=${Math.random().toString(36).slice(2)}`;

        contractDebug('loadDemo: request', {
            wantedPacketId: id,
            tryIndex: tries,
            gs_id: this.storage.about.gs_id,
            gs_game_id: this.storage.about.gs_game_id,
            url
        });
        console.info('[M1PRO loadDemo] iframe-only', { wantedPacketId: id, tryIndex: tries, url });

        const processResponse = (res: string) => {
            this.logDemoMidResponse(res, 'RAW response (before parse)');
            if (!res || res.includes('cf-browser-verification') || res.includes('Just a moment...')) {
                contractDebug('loadDemo: processResponse — Cloudflare / blocked body', {
                    len: res?.length,
                    head: res?.slice(0, 120)
                });
                throw new Error('Cloudflare challenge detected');
            }

            let lines: Array<UpdateAction>;
            try {
                lines = res.split("\n").filter((l: string) => l.trim().length > 0).map((line: string) => JSON.parse(line));
            } catch (parseErr) {
                contractDebug('loadDemo: JSON parse failed', { parseErr, head: res.slice(0, 400) });
                throw parseErr;
            }
            const ids = lines.map(l => l.id);
            const hasTarget = !id || !!lines.find(msg => msg.id === id);
            contractDebug('loadDemo: processResponse — parsed', {
                lineCount: lines.length,
                idMin: ids.length ? Math.min(...ids) : undefined,
                idMax: ids.length ? Math.max(...ids) : undefined,
                wantedPacketId: id,
                hasTargetPacketId: hasTarget
            });
            console.info('[M1PRO loadDemo] parsed OK', {
                lines: lines.length,
                wantedPacketId: id,
                hasTargetPacketId: hasTarget
            });
            if (!id || (id && lines.find(msg => msg.id === id))) {
                deferred.resolve(lines);
            } else if (tries < 3) {
                contractDebug('loadDemo: target id not in file yet — retry', { id, tries: tries + 1, inMs: 1000 });
                setTimeout(() => {
                    this.loadDemo(id, tries + 1).done(deferred.resolve).fail(deferred.reject);
                }, 1000);
            } else {
                contractDebug('loadDemo: target id not found after retries', {
                    id,
                    gs_id: this.storage.about.gs_id,
                    gs_game_id: this.storage.about.gs_game_id,
                    idMax: ids.length ? Math.max(...ids) : undefined
                });
                debug('demo packet not found after retries', id, this.storage.about.gs_id, this.storage.about.gs_game_id);
                deferred.resolve([]);
            }
        };

        const handleError = (err: any) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            contractDebug('loadDemo: handleError', { err: errMsg, tryIndex: tries, willRetry: tries < 3 });
            if (tries < 3) {
                console.warn('[M1PRO loadDemo] error — retrying iframe', { message: errMsg, tryIndex: tries });
                setTimeout(() => {
                    this.loadDemo(id, tries + 1).done(deferred.resolve).fail(deferred.reject);
                }, 2000);
            } else {
                contractDebug('loadDemo: giving up after errors', { lastError: err?.message || err });
                console.warn('[M1PRO loadDemo] FAILED after iframe retries', err?.message || err);
                debug('failed to load demo', err);
                deferred.resolve([]);
            }
        };

        contractDebug('loadDemo: iframe');
        console.info('[M1PRO loadDemo] loading via hidden iframe');
        const iframe = document.createElement('iframe');
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        iframe.style.position = 'absolute';
        const cleanup = () => {
            window.removeEventListener('message', messageHandler);
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        };

        const messageHandler = (event: MessageEvent) => {
            if (event.origin === 'https://demos.monopoly-one.com' && event.data && event.data.type === 'M1PRO_DEMO_DATA') {
                const res = event.data.text;
                if (!res || !String(res).trim().length) {
                    return;
                }
                const isCf =
                    res.includes('cf-browser-verification') ||
                    res.includes('Just a moment...') ||
                    (res.includes('Cloudflare') && res.includes('challenge'));
                if (isCf) {
                    cleanup();
                    this.logDemoMidResponse(res, 'iframe response (Cloudflare page, not .mid)');
                    contractDebug('loadDemo: iframe got CF/HTML challenge', { head: res.slice(0, 80) });
                    console.warn('[M1PRO loadDemo] Cloudflare/HTML in iframe, not .mid');
                    handleError(new Error('Cloudflare challenge in iframe'));
                    return;
                }

                cleanup();

                try {
                    processResponse(res);
                } catch (e) {
                    handleError(e);
                }
            }
        };

        window.addEventListener('message', messageHandler);

        const startIframe = (): void => {
            const root = document.body || document.documentElement;
            root.appendChild(iframe);
            iframe.src = url;
            debug('loadDemo iframe', url);
        };

        if (document.body) {
            startIframe();
        } else {
            document.addEventListener('DOMContentLoaded', startIframe, { once: true });
        }

        window.setTimeout(() => {
            if (deferred.state() === 'pending') {
                cleanup();
                contractDebug('loadDemo: iframe timeout');
                console.warn('[M1PRO loadDemo] iframe timeout (no M1PRO_DEMO_DATA in time)');
                handleError(new Error('iframe timeout'));
            }
        }, 20000);

        return deferred.promise();
    }

    private resolveChanceCardsConfig(): Array<ChanceCard> {
        const cfg: any = this.storage?.config;
        const queue: any[] = [cfg, this.storage, (window as any)?.API?.table?.storage].filter(Boolean);
        const seen = new Set<any>();
        const queued = new Set<any>(queue);
        let depth = 0;

        const enqueue = (value: any): void => {
            if (!value || typeof value !== 'object' || seen.has(value) || queued.has(value)) {
                return;
            }
            queue.push(value);
            queued.add(value);
        };

        const pushCandidate = (candidate: any): Array<ChanceCard> => {
            const normalized = this.normalizeChanceCards(candidate);
            if (normalized.length) {
                return normalized;
            }
            return [];
        };

        while (queue.length) {
            depth++;
            if (depth > 6000) {
                break;
            }
            const current = queue.shift();
            if (!current || typeof current !== 'object' || seen.has(current)) {
                continue;
            }
            seen.add(current);

            const directCandidates = [
                (current as any).chance_cards,
                (current as any).chanceCards,
                (current as any).cards?.chance,
                (current as any).chance?.cards,
                (current as any).chances?.cards,
                (current as any).game_chance_cards
            ];
            for (const candidate of directCandidates) {
                const normalized = pushCandidate(candidate);
                if (normalized.length) {
                    return normalized;
                }
            }

            for (const key of Reflect.ownKeys(current)) {
                let value: any;
                try {
                    value = (current as any)[key as any];
                } catch (_e) {
                    continue;
                }
                const normalized = pushCandidate(value);
                if (normalized.length) {
                    return normalized;
                }
                enqueue(value);
            }
        }
        return [];
    }

    private normalizeChanceCards(value: any): Array<ChanceCard> {
        const list = Array.isArray(value)
            ? value
            : (value && typeof value === 'object' ? Object.keys(value).sort((a, b) => Number(a) - Number(b)).map(k => value[k]) : []);
        if (!list.length) {
            return [];
        }
        if (!list.some((card: any) => card && typeof card.type === 'string')) {
            return [];
        }
        return list.map((card: any) => ({
            type: card?.type ?? 'unknown',
            text: card?.text ?? '',
            range: card?.range,
            rangeStep: card?.rangeStep,
            sum: card?.sum
        }));
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
                    this.pendingChancesToRemove.forEach(v => this.chancePool[v] && (this.chancePool[v].out = true));
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
        this.$watch(() => this.chanceCardsConfig.length, len => {
            if (len > 0) {
                this.ensureChancePoolInitialized();
            }
        }, { immediate: true });
        this.loaded = true;
    }

    /**
     * Load `.mid` via iframe and fill the Договоры list (when opening that tab).
     */
    public loadObserverContractHistoryFromDemo(): void {
        if (!this.storage?.about) {
            return;
        }
        if (this.storage.about.is_m1tv) {
            return;
        }
        if (!this.storage.about.gs_id || !this.storage.about.gs_game_id) {
            contractDebug('loadObserverContractHistoryFromDemo: skip (no gs_id / gs_game_id)', {
                gs_id: this.storage?.about?.gs_id,
                gs_game_id: this.storage?.about?.gs_game_id
            });
            return;
        }
        if (this.observerContractHistoryLoadInFlight) {
            return;
        }
        this.observerContractHistoryLoadInFlight = true;
        this.loadDemo()
            .then(msgs => {
                this.applyObserverContractHistoryFromDemo(msgs);
            })
            .always(() => {
                this.observerContractHistoryLoadInFlight = false;
            });
    }

    private ensureChancePoolInitialized() {
        if (this.chancePoolInit) {
            return;
        }
        const configCards = this.chanceCardsConfig;
        if (!configCards.length) {
            return;
        }
        this.oldChancePool = [...configCards].map(c => ({ ...c, out: false }));
        const pool = [...this.oldChancePool];
        this.pendingChancePool.forEach(idx => {
            if (pool[idx]) {
                pool[idx].out = true;
            }
        });
        this.chancePool.splice(0, this.chancePool.length, ...pool);
        this.chancePoolInit = true;
        debug('chance pool initialized', pool.length);
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