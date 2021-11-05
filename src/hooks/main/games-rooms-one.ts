import Vue from 'vue';
import GamesFilter from '../../components/games-filter';
import { GameRoom, UserInfoLong, GameSlot, Gender, Friendship, BanInfo, Rank } from '../../shared/beans';
import { debug } from '../../util/debug';
import MainState from '../../components/main-state';

declare module 'vue/types/vue' {
    interface Vue {
        parent_type: string;
        room: GameRoom
        players_all: Set<number>
        slots: Array<GameSlot>
    }
}

export class GamesRoomsOne {
    private jq: JQuery<Element>;
    private defs = new Map<number, JQueryPromise<UserInfoLong>>();

    constructor(public base: Vue, private filter: GamesFilter, private state: MainState) {
        this.jq = jQuery(base.$el);
        this.init();
    }

    private init() {
        require('../../style/main/game-room-one.less');
        // debug('created', this.base.parent_type, this.base);

        switch (this.base.parent_type) {
            case 'other':
                this.initFilter();
                break;

            case 'invites':
            case 'my':
                this.initStats();
                break;
        }
    }

    private initStats() {
        this.jq.addClass('statsable');
        this.jq.find('div.VueGamesRoomsOne-body-members-one').each((i, el) => {
            jQuery('<div class="VueGamesRoomsOne-body-members-one-stats"/>')
                .appendTo(el);
        });
        this.base.$watch('players_all', (val: Set<number>) => {
            this.loadUsers(val);
        }, { deep: true });
        this.loadUsers(this.base.players_all);
    }

    private loadUsers(val: Set<number>) {
        const els = this.jq.find('div.VueGamesRoomsOne-body-members-one-stats');
        els.children().remove();

        val.forEach((id, i) => {
            if (!this.defs.has(id)) {
                this.defs.set(id, this.state.getUserInfo(id).then(users => users[0]));
            }
            this.defs.get(id).then(user => {
                /* user.mfp_ban_history = new BanInfo();
                user.mfp_ban_history.count = 10;
                user.rank = new Rank();
                user.rank.pts = 1000;
                user.games = 1100;
                user.games_wins = 1000; */
                const idx = this.base.slots.findIndex(s => s.user_id === user.user_id);
                const wr = user.games > 0 ? Math.round((user.games_wins / user.games) * 100) : 0;
                els.eq(idx).append(
                    jQuery('<div class="simple"/>').append(
                        jQuery('<span class="rank ion-connection-bars" />').text(user.rank?.pts || '???'),
                        user.mfp_ban_history && jQuery('<span class="mfp ion-android-sad" />').text(user.mfp_ban_history.count),
                        user.friendship === Friendship.Active && jQuery('<span class="friends ion-ios-people" />'),
                        jQuery('<span class="gender" />').addClass(user.gender === Gender.Male ? 'ion-male' : 'ion-female'),
                    ),
                    jQuery('<div class="complex"/>').append(
                        jQuery('<span class="stats ion-stats-bars" />').text(`${user.games}/${user.games_wins}`),
                        jQuery('<span class="winrate ion-pie-graph" />').text(`${wr}%`),
                    )
                );
            });
        });
    }

    private initFilter() {
        this.filter.checkRoom(this.base);
        this.base.$watch('room.settings.br_corner', () => this.filter.checkRoom(this.base));
        const unwatch = this.filter.$watch('values', () => this.filter.checkRoom(this.base), { deep: true });
        this.base.$once('hook:beforeDestroy', () => unwatch());
    }
}