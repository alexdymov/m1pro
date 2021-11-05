import Vue from 'vue';
import Component from 'vue-class-component';
import { GameRoom } from '../shared/beans';
import { debug } from '../util/debug';

class FilterGroup {
    name: string;
    limited?: boolean = false;
    sub: { [key: string]: string }
}

enum FilterTriValue {
    Exclude = -1, Unset = 0, Include = 1
}

declare type Filters = { [key: string]: FilterGroup };
declare type Values = { [key: string]: FilterTriValue };
declare type RoomPredicate = (room: GameRoom) => boolean;

const filterTests: { [key: string]: RoomPredicate } = {
    friends: r => false,
    teams: r => r.game_2x2 === 1,
    no_timers: r => r.settings.game_timers === 0,
    regular: r => r.game_submode === 0,
    speddie: r => r.game_submode === 2,
    retro: r => r.game_submode === 4,
    disposition: r => r.flags?.disposition_mode > 0,
    roulette: r => r.game_submode === 3,
    park: r => r.settings.br_corner === 0,
    croulette: r => r.settings.br_corner === 1,
    jackpot: r => r.settings.br_corner === 2,
    wormhole: r => r.settings.br_corner === 3,
}

@Component({
    template: `
        <div class="_noicon dropdown">
            <div class="dropdown-icon"><icon name="filter"></icon></div>
            <div class="dropdown-list">
                <div class="dropdown-group-one" v-for="group in filters" :key="group.name">
                    <div class="filter-group">{{group.name}}</div>
                    <div class="_static dropdown-list-one" v-for="(value, name) in group.sub" :key="name">
                        <div class="col">{{value}}</div>
                        <div class="col">
                            <design-triway v-model="values[name]"></design-triway>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    watch: {
        values: {
            handler(vals: Values) {
                localStorage.setItem('gamebox-filter', JSON.stringify(vals));
            },
            deep: true
        }
    }
})
export default class GamesFilter extends Vue {
    filters: Filters = {
        purpose: {
            name: 'Общее',
            sub: {
                // friends: 'Друзья',
                teams: '2x2',
                no_timers: 'Без таймеров'
            }
        },
        type: {
            name: 'Тип',
            limited: true,
            sub: {
                regular: 'Обычная',
                speddie: 'Быстрая',
                retro: 'Ретро',
                disposition: 'Расклад',
                roulette: 'Русская рулетка'
            }
        },
        corner: {
            name: 'Угловое поле',
            limited: true,
            sub: {
                jackpot: 'Джекпот',
                wormhole: 'Портал',
                croulette: 'Рулетка',
                park: 'Парк'
            }
        }
    };
    values: Values = null;

    created() {
        this.values = JSON.parse(localStorage.getItem('gamebox-filter') || '{}');
        /* setInterval(() => {
            debug('filter watchers', (<any>this)._watchers?.length);
        }, 5000); */
    }

    checkRoom(v: Vue) {
        let show = true;
        const result: { [key: string]: boolean } = {};
        Object.entries(this.values).forEach(([type, value]) => {
            const matches = filterTests[type](v.room);
            result[type] = matches;
            switch (value) {
                case FilterTriValue.Exclude:
                    show = show && !matches;
                    break;
                case FilterTriValue.Include:
                    show = show && matches;
                    break;
            }
        });
        // debug(room.get(0), show, result);
        (<HTMLElement>v.$el).style.display = show ? 'block' : 'none';
    }
}