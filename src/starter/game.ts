import Vue from 'vue';
import GameState from '../components/game-state';
import { expgame } from '../hooks/experimental/expgame';
import { FieldActions, GameStats, LockableFields, PlayerCardMenu, PlayerCards, PlayerColors, ShowChanceCard, ShowFieldMove, TableAction, TableChat, TableContract } from '../hooks/game';
import { debug } from '../util/debug';
import vooker from '../util/vue-hooker';
import { initAnalytics } from './analytics';

export const gameStarter = () => {
    debug('M1Pro game boot');
    Vue.use(vooker);
    // vooker.debug = true;
    const state = new GameState();

    require('../style/game.less');
    require('../style/game/tips.css');
    require('../style/game/remove-k.css');
    const contract = new TableContract(state);
    vooker.ifBeforeCreate(v => v.$options.name === 'storage', v => state.init(v));
    vooker.ifBeforeCreate(v => v.$options.name === 'table-contract', v => contract.init(v));
    vooker.ifMount(jq => jq.is('div.TableContract'), v => contract.mount());
    vooker.ifMount(jq => jq.is('div.TableAction'), v => new TableAction(v, state));
    vooker.ifBeforeCreate(v => v.$options.name === 'table-helper', v => GameStats.fixTicker(v));
    vooker.ifMount(jq => jq.is('div.TableHelper'), v => new GameStats(v, state));
    vooker.ifMount(jq => jq.is('#ui-fields'), v => {
        state.vmfields = v;
        new PlayerColors(state);
        new PlayerCards(state);
        new PlayerCardMenu(state);
        new FieldActions(v, state);
        new ShowFieldMove(v, state);
        new ShowChanceCard(v, state);
        new LockableFields(state);
        new TableChat(state);

        window.onReadyToUse(() => {
            initAnalytics();
        });
    });
    expgame(state);
    debug('M1Pro game boot done');
}
