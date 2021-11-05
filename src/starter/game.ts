import { PlayerCardMenu, PlayerCards, PlayerColors } from '../hooks/game';
import vooker from '../util/vue-hooker';
import Vue from 'vue';
import { debug } from '../util/debug';
import GameState from '../components/game-state';
import { expgame } from '../hooks/experimental/expgame';

export const gameStarter = () => {
    debug('M1Pro game boot');
    Vue.use(vooker);
    // vooker.debug = true;
    const state = new GameState();
    require('../style/game/tips.css');
    require('../style/game/remove-k.css');
    vooker.ifBeforeCreate(v => v.$options.name === 'storage', v => state.init(v));
    vooker.ifMount(jq => jq.is('div.TableContract'), v => require('../style/game/table-contract.less'));
    vooker.ifMount(jq => jq.is('div.TableAction'), v => require('../style/game/table-action.less'));
    vooker.ifMount(jq => jq.is('#ui-fields'), v => {
        new PlayerColors(state);
        new PlayerCards(state);
        new PlayerCardMenu(state);
    });
    expgame(state);
}
