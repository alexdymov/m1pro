import { FieldActions, GameStats, PlayerCardMenu, PlayerCards, PlayerColors, ShowFieldMove, TableContract, ShowChanceCard } from '../hooks/game';
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
    vooker.ifMount(jq => jq.is('div.TableContract'), v => new TableContract(v, state));
    vooker.ifMount(jq => jq.is('div.TableAction'), v => require('../style/game/table-action.less'));
    vooker.ifBeforeCreate(v => v.$options.name === 'table-helper', v => GameStats.fixTicker(v));
    vooker.ifMount(jq => jq.is('div.TableHelper'), v => new GameStats(v, state));
    vooker.ifMount(jq => jq.is('#ui-fields'), v => {
        new PlayerColors(state);
        new PlayerCards(state);
        new PlayerCardMenu(state);
        new FieldActions(v, state);
        new ShowFieldMove(v, state);
        new ShowChanceCard(v, state);
    });
    expgame(state);
    debug('M1Pro game boot done');
}
