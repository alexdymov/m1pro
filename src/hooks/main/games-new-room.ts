import Vue from 'vue';
import MainState, { ModeCustomSettings } from '../../components/main-state';
import { debug } from '../../util/debug';

declare module 'vue/types/vue' {
    interface Vue {
        maxplayers: number
        option_restarts: boolean
        option_private: boolean
        option_autostart: boolean
        game_mode_selected: string
        game_2x2: boolean
        cmpt_variants?: { [key: number]: boolean }
        setGameMode(mode: string): void
    }
}

export class GamesNewRoom {
    private modifying = false;

    constructor(public base: Vue, private state: MainState) {
        this.init();
    }

    private init() {
        this.state.gamesNewSettings.mode && this.base.setGameMode(this.state.gamesNewSettings.mode);

        this.base.$watch('game_mode_selected', (v) => {
            Vue.set(this.state.gamesNewSettings, 'mode', v);
            this.modifying = true;
            this.load(v, this.state.gamesNewSettings.custom[v]);
            this.base.$nextTick().then(() => this.modifying = false);
        }, { immediate: true });

        ['option_restarts', 'option_private', 'option_autostart', 'game_2x2', 'cmpt_variants', 'maxplayers'].forEach(opt => {
            this.base.$watch(opt, v => {
                if (this.modifying) return;
                this.state.setCustomSetting(this.base.game_mode_selected, opt, v);
            }, { deep: true });
        });
    }

    private load(mode: string, setting: ModeCustomSettings) {
        // debug('load', mode, setting && JSON.parse(JSON.stringify(setting)));
        this.base.option_private = setting?.option_private ?? false;
        this.base.option_autostart = setting?.option_autostart ?? true;
        this.base.option_restarts = setting?.option_restarts ?? false;
        this.base.game_2x2 = setting?.game_2x2 ?? false;
        mode !== 'disposition' && (this.base.maxplayers = setting?.maxplayers ?? 4);
        setting?.cmpt_variants && (this.base.cmpt_variants = setting?.cmpt_variants);
    }
}