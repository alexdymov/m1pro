import { debug } from '../util/debug';
import Vue from 'vue';
import vooker from '../util/vue-hooker';
import pooker from '../util/page-hooker';
import { Chat, CollapseBlock, Friends, GamesRooms, HeaderMenu, Item, GamesRoomsOne } from '../hooks/main';
import { Adaptive, Profile } from '../pages';
import MainState from '../components/main-state';
import GamesFilter from '../components/games-filter';
import { expmain } from '../hooks/experimental/expmain';

export const mainStarter = () => {
    debug('M1Pro main boot');
    Vue.use(vooker);
    const state = new MainState();
    pooker.add(page => page.pathname.startsWith('/profile'), () => new Profile());
    pooker.add(page => page.pathname.startsWith('/wallet'), () => require('../style/main/wallet.css'));
    pooker.add(page => page.pathname.startsWith('/market'), () => require('../style/main/market.less'));
    pooker.add(page => page.pathname.startsWith('/m1tv'), () => require('../style/main/m1tv.less'));
    pooker.add(page => page.pathname.startsWith('/trades'), () => require('../style/main/trades.css'));
    pooker.add(page => page.pathname.startsWith('/games'), () => new Adaptive());

    const cb = new CollapseBlock();
    vooker.ifMount(jq => jq.is('div.GamesMissions, div.VueGamesTopweek, div.VueGamesFriends, div.Gchat'), v => (cb.add(v)));

    vooker.ifMount(jq => jq.is('div.HeaderUser'), v => new HeaderMenu(v, state));
    vooker.ifMount(jq => jq.is('div.VueGamesFriends'), v => new Friends(v, state));
    vooker.ifMount(jq => jq.is('div.Gchat'), v => new Chat(v));
    vooker.ifMount(jq => jq.is('#inventory-items'), v => require('../style/main/inventory.less'));
    vooker.ifMount(jq => jq.is('div.Item'), v => new Item(v, state));

    const filter = new GamesFilter();
    vooker.ifMount(jq => jq.is('div.VueGamesRooms'), v => new GamesRooms(v, filter));
    vooker.ifMount(jq => jq.is('div.VueGamesRoomsOne'), v => new GamesRoomsOne(v, filter, state));
    expmain(state);
    pooker.run();
    window.onReadyToUse(() => {
        if (!window.API.isUserSignedIn()) {
            const $el = jQuery('<div class="header-right"/>').appendTo('body > .header > .widther').get(0);
            new HeaderMenu({ $el }, state);
        }
    });
}
