import Vue from 'vue';
import GamesFilter from '../../components/games-filter';
import { GameRoom } from '../../shared/beans';
import { debug } from '../../util/debug';

declare module 'vue/types/vue' {
    interface Vue {
        rooms_by_section: {
            my: Array<GameRoom>
            invites: Array<GameRoom>
            other: Array<GameRoom>
            hidden: Array<GameRoom>
        }
    }
}

export class GamesRooms {
    private jq: JQuery<Element>;

    constructor(public base: Vue, private filter: GamesFilter) {
        this.jq = jQuery(base.$el);
        this.init();
    }

    private init(): void {
        require('../../style/main/games-rooms.less');

        const gamelist = this.jq.find('div.block').last();
        const controls = jQuery('<div class="game-filter" />');
        controls.append(this.filter.$mount().$el);
        this.fixGameListTitle(gamelist, controls);
    }

    private fixGameListTitle(gamelist: JQuery<HTMLElement>, controls: JQuery<HTMLElement>) {
        const title = gamelist.find('div.title-3').addClass('games-header');
        const text = title.contents().filter((i, el) => el.nodeType === 3).get(0).nodeValue;
        const btn = title.find('input').detach();

        title.text('');

        title.append(`<span>${text}<span class="title-counter"/></span>`).append(controls).append(btn);
        this.base.$watch('rooms_by_section.other.length', val => title.find('span.title-counter').text(val));
    }
}