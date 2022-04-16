
export class MReq {
    access_token: string;
    sct: string;
    private recaptcha_token: string | [] = [];

    constructor() {
        this.access_token = localStorage.getItem('access_token');
        this.sct = localStorage.getItem('smart_cache_t');
    }

    withCaptcha(token: string): MReq {
        this.recaptcha_token = token ?? [];
        return this;
    }
}

export class MarketLotsReq extends MReq {
    constructor(public count: number = 50, public offset: number = 0) {
        super();
    }
}

export class MarketListingReq extends MReq {
    constructor(public thing_prototype_id: string | number, public count: number = 10, public offset: number = 0) {
        super();
    }
}

export class FriendsGetReq extends MReq {
    constructor(public online: Presence | [] = [], public add_user_info: Presence | [] = [], public user_id: number | string | [] = []) {
        super();
    }
}

export class InventoryGetReq extends MReq {
    constructor(public user_id?: number | string, public order: string = "quality") {
        super();
    }
}

export class UsersGetReq extends MReq {
    constructor(public type: string | string[] = [], public user_id: number | string | [] = [], public user_ids: string | string[] = []) {
        super();
    }
}

export class RoomsChangeSettings extends MReq {
    constructor(public room_id: string, public param: string, public value: any) {
        super();
    }
}

export enum Presence {
    Yes = 1, No = 0
}

export interface MResp<T> {
    code: number;
    description?: string;
    data?: T;
}

export interface CountableData {
    count: number;
}

export interface MarketListingData extends CountableData {
    things: Array<MarketListingThing>;
}

export interface InventoryData extends CountableData {
    things: Array<MarketLotThing>;
}

export interface MarketLotsData extends CountableData {
    things: Array<MarketLotThing>;
}

export interface FriendsData extends CountableData {
    friends: Array<UserInfoShort>;
}

export interface UsersData extends MResp<Array<UserInfoLong>> {
}

export interface MarketListingThing {
    thing_id: number;
    thing_additional?: any;
    user_id: number;
    price: number;
}

export interface MarketLotThing extends MarketListingThing {
    thing_prototype_id: number;
    image: string;
    quality: number;
    title: string;
}

export enum Gender {
    Male = 0, Female = 1
}

export enum Friendship {
    No = 0, Active = 1, Outbound = 2, Inbound = 3, BlacklistHim = 4, BlacklistMe = 5, BlacklistBoth = 6
}

export class UserInfoShort {
    user_id: number;
    domain?: string;
    approved?: Presence;
    nick: string;
    gender: Gender;
    avatar?: string;
    online: Presence;
    current_game: CurrentGame;
    rank: Rank;
    vip: Presence;
    bot: Presence;
    bot_owner: number;
    moderator: Presence;
    muted_until?: number;
}

export class UserInfoLong extends UserInfoShort {
    nicks_old: Array<string>;
    profile_cover?: string;
    social_vk?: number;
    social_discord?: string;
    games: number;
    games_wins: number;
    xp: number;
    xp_level: number;
    badge?: ItemData;
    friendship?: Friendship;
    muted?: Presence;
    mfp_ban_history?: BanInfo;
}

export class BanInfo {
    count: number;
    last_ban: number;
    type: number;
}

export class CurrentGame {
    gs_id: string;
    gs_game_id: string;
}

export class Rank {
    hidden?: number;
    id?: number;
    pts?: number;
    qual?: number;
}

export class ItemData {
    thing_id: number;
    thing_prototype_id: number;
    user_id: number;
}

export class ItemData2 {
    item_id: number;
    item_proto_id: number;
    user_id: number;
}

export class UserData {
    avatar: string;
    gender: Gender;
    nick: string;
    rank: Rank;
    user_id: number;
}

export class GameField {
    buy: number;
    coeff_rent: number;
    field_id: number;
    group: number;
    image: string;
    levelUpCost: boolean | number;
    levels: Array<number>;
    title: string;
    can_build: boolean;
    level: number;
    mortgaged?: boolean;
    owner?: number;
    owner_true?: number;
}
export class GamePlayer {
    additional_time: number;
    can_use_credit: boolean;
    credit_nextTakeRound: number;
    credit_payRound: number;
    credit_toPay: number;
    doublesRolledAsCombo: number;
    frags: Array<any>;
    jailed: boolean;
    money: number;
    position: number;
    score: number;
    status: number;
    team: number;
    timeReduceLevel: number;
    unjailAttempts: number;
    user_id: number;
    vip: boolean;
}

export class RoomFlags {
    disposition_mode: number;
    is_tournament: number;
    ts_created: number;
    vip: number;
}

export class RoomSettings {
    maxplayers: number;
    private: number;
    autostart: number;
    br_corner: number;
    contract_protests: number;
    game_timers: number;
    pm_allowed: number;
    restarts: number;
}

export class GameRoom {
    admin: number;
    bans: Array<number>;
    flags: RoomFlags;
    game_2x2: number;
    game_mode: number;
    game_submode: number;
    invites: Array<Array<number>>;
    players: Array<Array<number>>;
    players_joined: any;
    room_id: string;
    settings: RoomSettings;
    status: number;
    v: number;
}

export enum RoomEventType {
    SET = 'room.set', PATCH = 'room.patch', DELETE = 'room.delete'
}

export class SocketEvent<T extends string = string> {
    id: string;
    type: T;
}

export class RoomEvent extends SocketEvent<RoomEventType> {
    room_id: string;
    v: number;
    patches: Array<Array<any>>;
}

export class SocketData<T extends SocketEvent> {
    events: Array<T>;
}

export class SocketRoomEvent extends SocketData<RoomEvent> {
    rooms?: Array<GameRoom>;
    users_date?: Array<UserInfoShort>;
}

export class GameSlot {
    class: string;
    avatar?: string;
    can_kick?: boolean;
    can_leave?: boolean;
    link?: string
    nick?: string
    online?: number
    rank?: { image: string, pts?: number }
    user_id?: number
}

export interface AsyncStorage {
    storage: { [key: number]: UserInfoLong };
    load(ids: Array<number>): any;
}

export interface GameEvent {
    type: string
    user_id: number
    money?: number
    sum?: number
    chance_id?: number
    destinations_count?: number
    dices: Array<number>
    mean_position?: number
    field_id?: number
    move_reverse?: number
}

export interface ChanceCard {
    range?: Array<number>
    rangeStep?: number
    sum?: number
    text: string
    type: string
}

export class CurrentChanceCard {
    constructor(public fieldId: number,
        public card: ChanceCard,
        public sum?: number) {
    }
}