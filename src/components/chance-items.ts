import Component from "vue-class-component";
import Vue from 'vue';
import { ChanceCard, ChanceCardState, GamePlayer } from '../shared/beans';
import cloneDeep from 'lodash/cloneDeep';
import { debug } from '../util/debug';

class ChanceIncome {
    random: number
    birthday: number
}

class ChanceOutcome {
    random: number
    repair: number
    insurance: number
}

class ChanceValues {
    income: ChanceIncome
    outcome: ChanceOutcome
    teleport: number
    jail: number
    skip: number
    reverse: number
    disaster: number
    unknown: number
}

const ChanceItemsProps = Vue.extend({
    props: {
        chanceCards: {
            type: Array,
            default: []
        },
        chanceCardsInit: {
            type: Array,
            default: []
        },
        players: {
            type: Function
        },
        party: {
            type: Boolean,
            default: false
        }
    }
});

@Component<ChanceItems>({
    template: `
    <div class="pool-items" v-if="rendered">
        <div class="pool-item pool-multi" v-if="incomeAvail">
            <div class="ion-social-usd profit_pos" />
            <span class="pool-sub" v-if="chanceValues.income.random > 0">Рандом: {{chanceValues.income.random}}</span>
            <span class="pool-sub" v-if="chanceValues.income.birthday > 0">ДР: +{{chanceValues.income.birthday}}</span>
        </div>
        <div class="pool-item pool-multi" v-if="outcomeAvail">
            <div class="ion-social-usd profit_neg" />
            <span class="pool-sub" v-if="chanceValues.outcome.random > 0">Рандом: {{chanceValues.outcome.random}}</span>
            <span class="pool-sub" v-if="chanceValues.outcome.repair > 0">Ремонт: {{chanceValues.outcome.repair}}</span>
            <span class="pool-sub" v-if="chanceValues.outcome.insurance > 0">Страховка: -{{chanceValues.outcome.insurance}}</span>
        </div>
        <div class="pool-item" v-if="chanceValues.teleport > 0">
            <div class="pool-logo pool-teleport" /><span class="pool-count">{{chanceValues.teleport}}</span>
        </div>
        <div class="pool-item" v-if="chanceValues.jail > 0">
            <div class="pool-logo pool-jail" /><span class="pool-count">{{chanceValues.jail}}</span>
        </div>
        <div class="pool-item" v-if="chanceValues.skip > 0">
            <div class="pool-logo pool-skip img-skip-move" /><span class="pool-count">{{chanceValues.skip}}</span>
        </div>
        <div class="pool-item" v-if="chanceValues.reverse > 0">
            <div class="pool-logo pool-back img-back-move" /><span class="pool-count">{{chanceValues.reverse}}</span>
        </div>
        <div class="pool-item" v-if="chanceValues.disaster > 0">
            <div class="pool-logo pool-bomb img-bomb" /><span class="pool-count">{{chanceValues.disaster}}</span>
        </div>
        <div class="pool-item" v-if="chanceValues.unknown > 0">
            <div class="ion-help" /><span class="pool-count">{{chanceValues.unknown}}</span>
        </div>
    </div>
    `,
    watch: {
        chanceCards: {
            handler(val: Array<ChanceCardState>) {
                this.rendered = false;
                this.chanceValues = cloneDeep(this.chanceValuesInit);
                this.handleValues(val);
                this.$nextTick(() => {
                    this.rendered = true;
                });
            },
            deep: true
        },
        playerStatuses: {
            handler(val: Array<number>) {
                if (this.chanceValues.income?.birthday) {
                    this.rendered = false;
                    this.chanceValues.income.birthday = this.getBirthdaySum(this.chanceCardsInit.find((card: ChanceCard) => card.type === 'birthday'));
                    this.$nextTick(() => {
                        this.rendered = true;
                    });
                }
            },
            deep: true
        }
    }
})
export default class ChanceItems extends ChanceItemsProps {
    chanceValues = new ChanceValues();
    chanceValuesInit = new ChanceValues();
    rendered = true;

    created() {
        this.chanceCardsInit.forEach((card: ChanceCard) => {
            switch (card.type) {
                case 'cash_in':
                    !this.chanceValues.income && (this.chanceValues.income = new ChanceIncome());
                    this.chanceValues.income.random = 0;
                    break;
                case 'birthday':
                    !this.chanceValues.income && (this.chanceValues.income = new ChanceIncome());
                    this.chanceValues.income.birthday = 0;
                    break;
                case 'cash_out':
                    !this.chanceValues.outcome && (this.chanceValues.outcome = new ChanceOutcome());
                    this.chanceValues.outcome.random = 0;
                    break;
                case 'insurance':
                    !this.chanceValues.outcome && (this.chanceValues.outcome = new ChanceOutcome());
                    this.chanceValues.outcome.insurance = 0;
                    break;
                case 'repair':
                    !this.chanceValues.outcome && (this.chanceValues.outcome = new ChanceOutcome());
                    this.chanceValues.outcome.repair = 0;
                    break;
                case 'teleport':
                    this.chanceValues.teleport = 0;
                    break;
                case 'jail':
                    this.chanceValues.jail = 0;
                    break;
                case 'move_skip':
                    this.chanceValues.skip = 0;
                    break;
                case 'reverse':
                    this.chanceValues.reverse = 0;
                    break;
                case 'fields_disaster':
                    this.chanceValues.disaster = 0;
                    break;
                default:
                    this.chanceValues.unknown = 0;
                    break;
            }
        });
        this.chanceValuesInit = cloneDeep(this.chanceValues);
        this.handleValues(this.chanceCards as Array<ChanceCardState>);
    }

    handleValues(val: Array<ChanceCardState>) {
        val.forEach(card => {
            if (card.out) {
                return;
            }
            switch (card.type) {
                case 'cash_in':
                    this.chanceValues.income.random++;
                    break;
                case 'birthday':
                    this.chanceValues.income.birthday = this.getBirthdaySum(card);
                    break;
                case 'cash_out':
                    this.chanceValues.outcome.random++;
                    break;
                case 'insurance':
                    this.chanceValues.outcome.insurance = card.sum;
                    break;
                case 'repair':
                    this.chanceValues.outcome.repair++;
                    break;
                case 'teleport':
                    this.chanceValues.teleport++;
                    break;
                case 'jail':
                    this.chanceValues.jail++;
                    break;
                case 'move_skip':
                    this.chanceValues.skip++;
                    break;
                case 'reverse':
                    this.chanceValues.reverse++;
                    break;
                case 'fields_disaster':
                    this.chanceValues.disaster++;
                    break;
                default:
                    this.chanceValues.unknown++;
                    break;
            }
        });
        debug('cur cards', JSON.parse(JSON.stringify(this.chanceValues)))
    }

    private getBirthdaySum(card: ChanceCard): number {
        return card.sum * (this.players().filter((pl: GamePlayer) => pl.status !== -1).length - (this.party ? 2 : 1));
    }

    get playerStatuses() {
        return this.players().map((pl: GamePlayer) => pl.status);
    }

    get incomeAvail() {
        return this.chanceValues.income !== undefined && Object.values(this.chanceValues.income).filter(v => v > 0).length;
    }

    get outcomeAvail() {
        return this.chanceValues.outcome !== undefined && Object.values(this.chanceValues.outcome).filter(v => v > 0).length;
    }
}