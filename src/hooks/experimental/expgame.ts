import vooker from '../../util/vue-hooker';
import GameState from '../../components/game-state';
import { LockableFields } from './modules/lockable-fields';
import { TableAction } from './modules/table-action';

export const expgame = process.env.NODE_ENV === 'production' ? (state: GameState) => { } : (state: GameState) => {
    vooker.ifMount(jq => jq.is('#ui-fields'), v => { new LockableFields(state) });
    vooker.ifMount(jq => jq.is('div.TableAction'), v => new TableAction(v, state));
}