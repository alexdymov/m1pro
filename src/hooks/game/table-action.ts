import GameState from '../../components/game-state';
import Vue from 'vue';
import { debug } from '../../util/debug';
import { GamePlayer } from '../../shared/beans';

declare module 'vue/types/vue' {
    interface Vue {
        is_hidden: boolean
        action_types: Set<string>
        player: GamePlayer
        action: (event: any, type: string, s: any) => void
        current_move: {
            field?: number
            levelUpped?: Array<number>
            mortgaged?: Array<number>
            moneyToPay?: number
            pay?: number
        }
    }
}

export class TableAction {
    constructor(private base: Vue, private state: GameState) {
        require('../../style/game/table-action.less');
        if (!state.storage.about.is_m1tv) {
            state.$watch('loaded', () => {
                this.init();
            });
        }
    }

    private init() {
        this.base.$watch('$parent.action_types', (val: Set<string>) => {
            debug('action_types', val);
            if (val.size && this.state.user.user_id === this.state.storage.status.action_player) {
                if (val.has('toAuction')) {
                    const move = this.base.player.position;
                    const locked = this.state.lockedFields.has(move);
                    debug('actions', val, move, locked);
                    locked && this.perform('toAuction', val);
                }

                if (val.has('auctionDecline')) {
                    const move = this.state.storage.current_move.field;
                    const locked = this.state.lockedFields.has(move);
                    debug('actions', val, move, locked);
                    locked && this.perform('auctionDecline', val);
                }
                if (val.has('noBuy')) {
                    const move = this.base.player.position;
                    const locked = this.state.lockedFields.has(move);
                    debug('actions', val, move, locked);
                    locked && this.perform('noBuy', val);
                }
            }
        })
    }

    private perform(act: string, val: Set<string>) {
        const event = {
            isTrusted: true,
            cancelable: false,
            x: 0, y: 0,
            clientX: 0, clientY: 0,
            offsetX: 0, offsetY: 0,
            layerX: 0, layerY: 0,
            screnX: 0, screnY: 0,
        };
        this.base.action(event, act, {});
        this.base.is_hidden = true;
    }
}