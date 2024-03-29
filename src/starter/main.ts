import Vue from 'vue';
import GamesFilter from '../components/games-filter';
import MainState from '../components/main-state';
import { expmain } from '../hooks/experimental/expmain';
import { Chat, CollapseBlock, Friends, GamesNewRoom, GamesRooms, GamesRoomsOne, HeaderMenu, Item } from '../hooks/main';
import { Adaptive, Profile } from '../pages';
import Banner from '../pages/banner';
import { debug } from '../util/debug';
import pooker from '../util/page-hooker';
import vooker from '../util/vue-hooker';
import { initAnalytics } from './analytics';

export const mainStarter = () => {
    debug('M1Pro main boot');
    Vue.use(vooker);
    const state = new MainState();
    pooker.add(page => page.pathname.startsWith('/profile'), () => new Profile(state));
    pooker.add(page => page.pathname.startsWith('/wallet'), () => require('../style/main/wallet.css'));
    pooker.add(page => page.pathname.startsWith('/market'), () => require('../style/main/market.less'));
    pooker.add(page => page.pathname.startsWith('/m1tv'), () => require('../style/main/m1tv.less'));
    pooker.add(page => page.pathname.startsWith('/trades'), () => require('../style/main/trades.css'));
    pooker.add(page => page.pathname.startsWith('/games'), () => {
        new Adaptive();
        new Banner(state);
    });

    const cb = new CollapseBlock();
    vooker.ifMount(jq => jq.is('div.VueGamesSeasonpass, div.GamesMissions, div.VueGamesTopweek, div.VueGamesFriends, div.Gchat'), v => (cb.add(v)));

    vooker.ifMount(jq => jq.is('div.HeaderUser'), v => new HeaderMenu(v, state));
    vooker.ifMount(jq => jq.is('div.VueGamesFriends'), v => new Friends(v, state));
    vooker.ifMount(jq => jq.is('div.Gchat'), v => new Chat(v, state));
    vooker.ifMount((jq, v) => v.$options.name === 'inventory2', v => require('../style/main/inventory.less'));
    vooker.ifMount(jq => jq.is('div.Item'), v => new Item(v, state));

    let filter: GamesFilter = null;
    const getFilter = () => {
        !filter && (filter = new GamesFilter());
        return filter;
    }
    vooker.ifMount(jq => jq.is('div.VueGamesRooms'), v => new GamesRooms(v, getFilter()));
    vooker.ifMount(jq => jq.is('div.VueGamesRoomsOne'), v => new GamesRoomsOne(v, getFilter(), state));
    vooker.ifMount(jq => jq.is('div.GamesNewroom'), v => new GamesNewRoom(v, state));
    expmain(state);
    pooker.run();
    window.onReadyToUse(() => {
        if (!window.API.isUserSignedIn()) {
            const $el = jQuery('<div class="header-right"/>').appendTo('body > .header > .widther').get(0);
            new HeaderMenu({ $el }, state);
        }
        initAnalytics();
    });
    debug('M1Pro main boot done');
}
