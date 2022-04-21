import merge from 'lodash/merge';
import Vue from 'vue';
import GameState from '../../components/game-state';
import { debug } from '../../util/debug';
import ChanceItems from '../../components/chance-items';
import { ContractInfo } from '../../shared/beans';
import Component from 'vue-class-component';

class Ticker {
    game_time: string
    time_mod: number
    time_mod_value: string
}

declare module 'vue/types/vue' {
    interface Vue {
        ticker: Ticker
        tab: number
        vm_contract: Vue
        vm_time: Vue
        time_modificators: {
            income_tax_rate: number
            start_bypass_fee: number
        },
        time_ingame: number
    }
}

const MainStatsProps = Vue.extend({
    props: {
        state: {
            type: GameState
        },
        vm_time: {
            type: Vue
        }
    }
});

@Component<MainStats>({
    template: `
    <div class=TableHelper-content>
        <div><div class=_matchtitle v-if=match_title>
            <div class=_icon :class="['_game_submode_'+game_submode]"></div>
            <div class=_title>{{ match_title }}</div>
            <div class=_viewers v-if=viewers><span>{{ viewers.count }}</span> зрител{{ viewers.case }}</div>
        </div>
        <div class=TableHelper-content-stat>
            <div class=_round>
                <div>{{ round }}</div>
                <div>раунд</div>
            </div>
            <div class=_time>
                <div>{{ current_ticker.game_time }}</div>
                <div>время игры</div>
            </div>
            <div class=_roundtax :class="['_mod_'+current_ticker.time_mod]">
                <div>{{ current_ticker.time_mod_value }}</div>
                <div></div>
            </div>
            <template v-if="next_ticker.time > 0">
                <div class=_time>
                    <div>{{ next_ticker.game_time }}</div>
                    <div>время смены</div>
                </div>
                <div class=_roundtax :class="['_mod_'+next_ticker.time_mod]">
                    <div>{{ next_ticker.time_mod_value }}</div>
                    <div></div>
                </div>
            </template>
        </div>
    </div>
    `
})
class MainStats extends MainStatsProps {
    get game_submode() {
        return this.state.storage.flags.game_submode;
    }

    get match_title() {
        const flags = this.state.storage.flags;
        if (flags) {
            return flags.match_title || this.state.storage.game_mode_titles[flags.game_mode] || this.state.storage.game_submode_titles[flags.game_submode];
        }
    }

    get round() {
        return this.state.storage.status?.round;
    }

    get viewers() {
        const count = this.state.storage.status?.viewers ?? 0;
        if (count > 0)
            return { count, case: window.Tools.selectWordCase(count, ["ь", "я", "ей"]) };
    }

    get current_ticker() {
        if (this.state.storage.status) {
            const mods = this.vm_time.time_modificators;
            let time_mod = 0,
                time_mod_value = "0";
            if (mods.income_tax_rate > 0) {
                time_mod = 21;
                time_mod_value = Math.round(100 * mods.income_tax_rate) + "%";
            } else {
                if (0 === mods.start_bypass_fee) {
                    time_mod = 10;
                    time_mod_value = "0";
                } else {
                    if (mods.start_bypass_fee > 0) {
                        time_mod = 20;
                        time_mod_value = this.state.formatMoney(mods.start_bypass_fee);
                    } else {
                        time_mod_value = this.state.formatMoney(this.state.storage.config.roundCash)
                    }
                }
            }
            return { time_mod, time_mod_value, game_time: window.parsers.parseTimeToString(this.vm_time.time_ingame), };
        }
        return {};
    }

    get next_time_modificators() {
        let start_bypass_fee = null, income_tax_rate = 0, time = 0;
        if (this.state.storage.is_ready) {
            const config = this.state.storage.config;
            let idx = config.roundTaxes.findIndex(tx => this.vm_time.time_ingame < tx.game_time);
            idx !== -1 && (time = config.roundTaxes[idx].game_time) && (start_bypass_fee = config.roundTaxes[idx].tax);
            // debug('idx1', idx, JSON.parse(JSON.stringify(config.roundTaxes)), this.vm_time.time_ingame)
            if (undefined !== config.incomeTaxes && start_bypass_fee === null) {
                idx = config.incomeTaxes.findIndex(tx => this.vm_time.time_ingame < tx.game_time);
                // debug('idx2', idx, JSON.parse(JSON.stringify(config.incomeTaxes)), this.vm_time.time_ingame)
                idx !== -1 && (time = config.incomeTaxes[idx].game_time) && (income_tax_rate = config.incomeTaxes[idx].tax_rate);
            }
        }
        return { start_bypass_fee, income_tax_rate, time };
    }

    get next_ticker() {
        if (this.state.storage.status) {
            const mods = this.next_time_modificators;
            let time_mod = 0,
                time_mod_value = "0";
            if (mods.income_tax_rate > 0) {
                time_mod = 21;
                time_mod_value = Math.round(100 * mods.income_tax_rate) + "%";
            } else {
                if (0 === mods.start_bypass_fee) {
                    time_mod = 10;
                    time_mod_value = "0";
                } else {
                    if (mods.start_bypass_fee > 0) {
                        time_mod = 20;
                        time_mod_value = this.state.formatMoney(mods.start_bypass_fee);
                    } else {
                        time_mod_value = this.state.formatMoney(this.state.storage.config.roundCash)
                    }
                }
            }
            return { time_mod, time_mod_value, game_time: window.parsers.parseTimeToString(mods.time - this.vm_time.time_ingame), time: mods.time };
        }
        return {};
    }
}

let initialWidth = 0;

export class GameStats {
    private jq: JQuery<Element>;
    private rootOrig: JQuery<HTMLElement>;
    private root: JQuery<HTMLElement>;
    private pool: JQuery<HTMLElement>;
    private chanceItems: ChanceItems;

    constructor(public base: Vue, private state: GameState) {
        this.jq = jQuery(base.$el);
        state.$watch('usersLoaded', () => {
            this.init();
        });
    }

    static fixTicker(base: Vue) {
        const old = base.$options.computed.ticker;
        merge(base.$options, {
            computed: {
                ticker: function () {
                    const tick: Ticker = (<any>old).apply(base);
                    return { ...tick, time_mod_value: tick.time_mod_value?.replace('k', '') };
                }
            }
        });
    }

    private init() {
        require('../../style/game/game-stats.less');

        const main = new MainStats({ propsData: { state: this.state, vm_time: this.base.vm_time } });

        this.root = jQuery('<div class="table-body-stats"/>').appendTo('div.table-body');
        this.root.append(main.$mount().$el);
        this.root.append('<div class="spacer"/>')
        this.pool = jQuery('<div class="TablePool-content"><div class="pool-title"><div class="ion-help" />Поле шанс</div></div>').appendTo(this.root).hide();
        this.loadCommonStatsElements();
        this.initExtraStatsTable();
        this.initContractsTab();
        this.observeTabSwitch();
        window.onresize = (e) => {
            this.renderCommonStats();
        };
        this.state.$watch('gameOver', v => v && this.root.hide() && debug('gameover'));

        if (this.state.storage.config.chance_cards) {
            debug('wait stats pool')
            this.state.$watch('chancePool', v => {
                debug('stats pool', JSON.parse(JSON.stringify(v)))
                if (!this.chanceItems && v) {
                    this.chanceItems = new ChanceItems({ propsData: { chanceCards: v, chanceCardsInit: this.state.storage.config.chance_cards, players: () => this.state.storage.status.players, party: this.state.party } });
                    this.pool.append(this.chanceItems.$mount().$el).show();
                }
            }, { immediate: true });
        }
    }

    private initContractsTab() {
        const tab = jQuery('<div class="_contracts">Договоры</div>').appendTo(jQuery('div.TableHelper-tabs', this.jq)).on('click', () => {
            this.base.tab = 2;
        });
        const content = jQuery(`<div><div class="TableHelper-content-contracts">
            <div class="TableHelper-content-contracts-head">
                <div>От</div>
                <div>Кому</div>
                <div>Результат</div>
                <div>Время</div>
            </div>
        </div></div>`).appendTo(jQuery('div.TableHelper-content', this.jq)).hide();
        this.state.$watch('contractEvents', (ce: Array<ContractInfo>) => {
            debug('got contracts', JSON.parse(JSON.stringify(ce)));
            content.find('div.TableHelper-content-contracts-row').remove();
            [...ce].reverse().forEach(ci => {
                jQuery(`<div class="TableHelper-content-contracts-row">
                    <div>${this.getPlayerInfo(ci.from)}</div>
                    <div>${this.getPlayerInfo(ci.to)}</div>
                    <div class="${this.getContractResult(ci.result)}"/>
                    <div>${window.parsers.parseTimeToString(Math.floor((ci.time - this.state.storage.time.ts_start) / 1000))}</div>
                </div>`).appendTo(content.find('>div')).on('click', () => {
                    this.state.ongoingContract = { ...ci };
                });
            });
        }, { deep: true, immediate: true });
        this.base.$watch('tab', v => {
            if (v === 2) {
                tab.addClass('_active');
                content.show();
            } else {
                tab.removeClass('_active');
                content.hide();
            }
        });
    }

    private getContractResult(res: number) {
        switch (res) {
            case 0: return 'ion-load-b';
            case 1: return 'ion-checkmark-round';
            case 2: return 'ion-close-round';
            default: return 'ion-help';
        }
    }

    private getPlayerInfo(id: number) {
        const player = this.state.users[id];
        return `<div>
            <div class="_avatar" style="background-image: url('${player.avatar}')" />
            <div class="_nick">${player.nick}</div>
        </div>`;
    }

    private initExtraStatsTable() {
        const table = this.rootOrig.find('div.TableHelper-content-players');
        table.find('div.TableHelper-content-players-head').append('<div>Прибыль</div>', '<div>Круги</div>');
        table.find('div.TableHelper-content-players-row').each((i, el) => {
            const pl = this.state.players[i];
            let [laps, profit]: Array<JQuery<HTMLElement>> = [];
            jQuery(el).append(
                profit = jQuery('<div/>'),
                laps = jQuery('<div/>')
            );
            this.state.$watch('settings.changeColor', change => {
                jQuery(el).removeClass(`player_border_${change ? pl.orderOrig : pl.order}`)
                    .addClass(`player_border_${change ? pl.order : pl.orderOrig}`);
            }, { immediate: true });
            this.state.$watch(`players.${i}.laps`, v => {
                laps.text(v);
            }, { immediate: true });
            this.state.$watch(() => pl.income - pl.expenses, v => {
                const positive = v >= 0;
                profit.attr('title', `+${pl.income} | -${pl.expenses}`)
                    .addClass(positive ? 'profit_pos' : 'profit_neg')
                    .removeClass(!positive ? 'profit_pos' : 'profit_neg')
                    .text(this.state.formatMoney(Math.abs(v)));
            }, { immediate: true });
        });
    }

    private loadCommonStatsElements() {
        initialWidth === 0 && (initialWidth = jQuery('div._shakehack').width());
        this.rootOrig = this.jq.find('div.TableHelper-content > div');
        this.renderCommonStats();
    }

    private observeTabSwitch() {
        this.base.$watch('tab', v => {
            switch (v) {
                case 0:
                    this.loadCommonStatsElements();
                    this.initExtraStatsTable();
                    break;
                case 1:
                    this.jq.find('div.TableHelper-content-options').append(
                        jQuery(`
                            <div class="form2-row">
                                <div class="form2-checkbox">
                                    <input type="checkbox" class="switcher" id="table-opt-split-common-stats"> <label for="table-opt-split-common-stats">Показывать общую статистику в отдельном блоке</label>
                                </div>
                            </div>
                            `)
                            .find('input').prop('checked', this.state.settings.splitCommonStats).on('change', (e) => {
                                this.state.settings.splitCommonStats = e.delegateTarget.checked;
                                this.renderCommonStats();
                            }).end(),
                        jQuery(`
                                <div class="form2-row">
                                    <div class="form2-checkbox">
                                        <input type="checkbox" class="switcher" id="table-opt-change-color"> <label for="table-opt-change-color">Свой цвет всегда красный</label>
                                    </div>
                                </div>
                                `)
                            .find('input').prop('checked', this.state.settings.changeColor).on('change', (e) => {
                                this.state.settings.changeColor = e.delegateTarget.checked;
                            }).end(),
                        jQuery(`
                                <div class="form2-row">
                                    <div class="form2-checkbox">
                                        <input type="checkbox" class="switcher" id="table-opt-show-live-contracts"> <label for="table-opt-show-live-contracts">Показывать чужие договоры (live)</label>
                                    </div>
                                </div>
                                `)
                            .find('input').prop('checked', this.state.settings.showLiveContracts).on('change', (e) => {
                                this.state.settings.showLiveContracts = e.delegateTarget.checked;
                            }).end()
                    )
                    break;
            }
        });
    }

    private renderCommonStats() {
        const renderSeparately = this.state.settings.splitCommonStats;
        renderSeparately && !this.state.gameOver && this.root.show() || this.root.hide();
        jQuery('div._shakehack').css('width', (i, val) => renderSeparately ? `${initialWidth + 200}px` : `${initialWidth}px`);
        window.tableResize(true);
    }
}