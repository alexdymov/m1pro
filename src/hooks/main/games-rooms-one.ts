import Vue from 'vue';
import GamesFilter from '../../components/games-filter';
import { GameRoom, UserInfoLong, GameSlot, Gender, Friendship, BanInfo, Rank, FriendsGetReq, Presence } from '../../shared/beans';
import { debug } from '../../util/debug';
import MainState from '../../components/main-state';
import debounce from 'lodash/debounce';
import { computeIfAbsent } from '../../util/compute-if-absent';

declare module 'vue/types/vue' {
    interface Vue {
        parent_type: string
        room: GameRoom
        players_all: Set<number>
        slots: Array<GameSlot>
    }
}

class UserWithFriends {
    constructor(public user: UserInfoLong, public friends: Array<number>) { }
}

export class GamesRoomsOne {
    private jq: JQuery<Element>;
    private userDefs = new Map<number, JQueryPromise<UserInfoLong>>();
    private friendsDefs = new Map<number, JQueryPromise<Array<number>>>();
    private modifying = false;

    constructor(public base: Vue, private filter: GamesFilter, private state: MainState) {
        this.jq = jQuery(base.$el);
        this.init();
    }

    private init() {
        require('../../style/main/games-room-one.less');
        // debug('created', this.base.parent_type, this.base);

        switch (this.base.parent_type) {
            case 'other':
                this.initFilter();
                break;

            case 'invites':
            case 'my':
                // due to some circumstances Vue loads here twice, 
                // first in the 'other' block and then in correct one, 
                // so we skip the first load here
                if (this.jq.parents('div.VueGamesRooms > div.block').is(jQuery('div.VueGamesRooms > div.block').last())) {
                    break;
                }
                if (this.base.room.admin === window.API.user.user_id) {
                    this.initSettings();
                }
                this.initRoomInfo();
                this.initStats();
                break;
        }
    }

    private getMode(): string {
        const room = this.base.room;
        switch (room.game_submode) {
            case 0: return "regular";
            case 2: return room.flags.disposition_mode ? "disposition" : "speeddie";
            case 3: return "roulette";
            case 4: return "retro";
        }
        return "";
    }

    private initSettings() {
        const mode = this.getMode();
        ['game_timers', 'br_corner'].forEach(opt => {
            this.base.$watch(`room.settings.${opt}`, v => {
                if (this.modifying) return;
                this.state.setCustomSetting(mode, opt, v);
            });
        });

        this.checkSettings(mode);
    }

    private checkSettings(mode: string) {
        const custom = this.state.gamesNewSettings.custom[mode];
        this.modifying = true;

        const room = this.base.room;
        const settings = room.settings;

        const corner = custom?.br_corner ?? 2;
        settings.br_corner !== corner && (settings.br_corner = corner) !== 2 &&
            this.state.changeSetting(room.room_id, 'br_corner', settings.br_corner)
                .fail(err => console.log(err));

        const timers = Number(custom?.game_timers ?? true);
        settings.game_timers != 0 && (settings.game_timers = timers) == 0 &&
            this.state.changeSetting(room.room_id, 'game_timers', 0)
                .fail(err => console.log(err));

        this.base.$nextTick().then(() => this.modifying = false);
    }

    private initRoomInfo() {
        let [invites, bans]: JQuery<HTMLElement>[] = [];
        this.jq.find('div.VueGamesRoomsOne-body-head-info').append(
            invites = jQuery('<div class="header-invites ion-person-add"/>').hide(),
            bans = jQuery('<div class="header-bans ion-ios-close" kd-tooltip-option-position="center"/>').hide(),
        );

        this.base.$watch('room.bans', (v: Array<number>) => {
            this.showBans(v, bans);
        }, { immediate: true });
        this.base.$watch('room.invites', (v: Array<Array<number>>) => {
            this.showInvites(v, invites);
        }, { immediate: true});
    }

    private showInvites(v: number[][], invites: JQuery<HTMLElement>) {
        const inv = new Set(v?.flat());
        const res = new Array<JQueryPromise<UserInfoLong>>();
        inv.forEach(id => {
            res.push(computeIfAbsent(this.userDefs, id, () => this.state.getUserInfo(id).then(users => users[0])));
        });
        Promise.all(res).then((val: Array<UserInfoLong>) => {
            invites.children().remove();
            val.forEach(user => {
                const el = jQuery('<div class="invited"><a/></div>').attr('kd-tooltip', user.nick);
                user.avatar && el.css('background-image', `url(${user.avatar})`);
                el.find('a').attr('href', `/profile/${user.domain || user.user_id}`);
                invites.append(el);
            });
            inv.size ? invites.show() : invites.hide();
        });
    }

    private showBans(v: number[], bans: JQuery<HTMLElement>) {
        v?.length ? bans.show() : bans.hide();
        if (v?.length) {
            bans.text(v.length);
            const res = new Array<JQueryPromise<string>>();
            v.forEach(id => {
                res.push(computeIfAbsent(this.userDefs, id, () => this.state.getUserInfo(id).then(users => users[0])).then(user => user.nick));
            });
            Promise.all(res).then(val => bans.attr('kd-tooltip', 'Забаненые пользователи:<br>' + val.join('<br>')));
        }
    }

    private initStats() {
        this.jq.addClass('statsable').addClass(this.base.room.game_2x2 ? 'mode_2x2' : 'mode_regular');
        this.jq.find('div.VueGamesRoomsOne-body-members-one').each((i, el) => {
            jQuery('<div class="VueGamesRoomsOne-body-members-one-stats"/>')
                .appendTo(el);
        });
        this.base.$watch('players_all', debounce((val: Set<number>) => {
            this.loadUsers(val);
        }, 300), { deep: true, immediate: true });
    }

    private loadUsers(val: Set<number>) {
        const els = this.jq.find('div.VueGamesRoomsOne-body-members-one-stats');
        els.children().remove();

        const res = new Array<Promise<UserWithFriends>>();
        val.forEach((id, i) => {
            res.push(new Promise(resolve => {
                computeIfAbsent(this.userDefs, id, () => this.state.getUserInfo(id).then(users => users[0]))
                    .then(user => {
                        // this.debugInfo(user);
                        const idx = this.base.slots.findIndex(s => s.user_id === user.user_id);
                        const wr = user.games > 0 ? Math.round((user.games_wins / user.games) * 100) : 0;
                        this.fixAvatar(els.eq(idx).parent(), idx);
                        els.eq(idx).append(
                            jQuery('<div class="simple"/>').append(
                                user.rank?.pts && jQuery('<span class="rank ion-connection-bars" />').text(user.rank?.pts),
                                user.mfp_ban_history && jQuery('<span class="mfp ion-android-sad" />').text(user.mfp_ban_history.count),
                                user.friendship === Friendship.Active && jQuery('<span class="friends ion-ios-people" />'),
                                jQuery('<span class="gender" />').addClass(user.gender === Gender.Male ? 'ion-male' : 'ion-female'),
                            ),
                            jQuery('<div class="complex"/>').append(
                                jQuery('<span class="stats ion-stats-bars" />').text(`${user.games}/${user.games_wins}`),
                                jQuery('<span class="winrate ion-pie-graph" />').text(`${wr}%`),
                            )
                        );
                        computeIfAbsent(this.friendsDefs, id, () => this.state.getFriends(new FriendsGetReq(Presence.Yes, [], id))
                            .then(data => data.friends.map(fr => fr.user_id)))
                            .then(friends => resolve(new UserWithFriends(user, friends)));
                    });
            }))
        });
        Promise.all(res).then((users) => {
            const me = window.API.user.user_id;
            val.forEach((id, i) => {
                if (id === me) return;
                const idx = this.base.slots.findIndex(s => s.user_id === id);
                const slot = els.eq(idx);
                val.forEach(other => {
                    if (other === id || other === me) return;
                    const user = users.find(u => u.user.user_id === other);
                    const oidx = this.base.slots.findIndex(s => s.user_id === other);
                    if (user.friends.indexOf(id) >= 0) {
                        slot.find('div.simple').append(`<span class="friend_of ion-person-stalker friend_of_${oidx}" />`);
                    }
                })
            });
        });
    }

    private debugInfo(user: UserInfoLong) {
        user.mfp_ban_history = new BanInfo();
        user.mfp_ban_history.count = 10;
        user.rank = new Rank();
        user.rank.pts = 1000;
        user.games = 1100;
        user.games_wins = 1000;
    }

    private fixAvatar(slot: JQuery<HTMLElement>, idx: number) {
        const ava = slot.find('div.VueGamesRoomsOne-body-members-one-avatar');
        ava.parent().is('div.user_slot') || slot.prepend(jQuery('<div/>').addClass(`user_slot user_slot_${idx}`).append(ava.detach()));
    }

    private initFilter() {
        this.filter.checkRoom(this.base);
        this.base.$watch('room.settings.br_corner', () => this.filter.checkRoom(this.base));
        const unwatch = this.filter.$watch('values', () => this.filter.checkRoom(this.base), { deep: true });
        this.base.$once('hook:beforeDestroy', () => unwatch());
    }
}